Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'false'
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { bookingId, teacherId, serviceTitle } = await req.json();

    if (!bookingId || !teacherId) {
      throw new Error('معرف الحجز ومعرف المعلم مطلوبان');
    }

    // توليد معرف فريد للغرفة
    const roomId = `lesson-${bookingId}-${Date.now()}`;
    
    // الحصول على مفاتيح البيئة
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('إعدادات Supabase غير متوفرة');
    }

    // تحديث معرف الغرفة في الحجز
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        jitsi_room_id: roomId,
        updated_at: new Date().toISOString()
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      throw new Error(`فشل في تحديث الحجز: ${errorText}`);
    }

    // إنشاء جلسة غرفة جديدة
    const sessionResponse = await fetch(`${supabaseUrl}/rest/v1/room_sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        booking_id: bookingId,
        jitsi_room_id: roomId
      })
    });

    if (!sessionResponse.ok) {
      const errorText = await sessionResponse.text();
      console.error('خطأ في إنشاء جلسة الغرفة:', errorText);
      // لا نفشل العملية بالكامل إذا فشل إنشاء الجلسة
    }

    return new Response(JSON.stringify({
      data: {
        roomId,
        jitsiUrl: `https://meet.jit.si/${roomId}`,
        roomConfig: {
          roomName: roomId,
          displayName: serviceTitle || 'درس خصوصي',
          moderator: teacherId
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('خطأ في توليد الغرفة:', error);

    const errorResponse = {
      error: {
        code: 'ROOM_GENERATION_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});