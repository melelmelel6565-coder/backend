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
    const { imageData, fileName, bookingId, amount } = await req.json();

    if (!imageData || !fileName || !bookingId) {
      throw new Error('بيانات الصورة واسم الملف ومعرف الحجز مطلوبة');
    }

    // الحصول على مفاتيح البيئة
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('إعدادات Supabase غير متوفرة');
    }

    // استخراج البيانات من base64
    const base64Data = imageData.split(',')[1];
    const mimeType = imageData.split(';')[0].split(':')[1];

    // تحويل base64 إلى binary
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // رفع الصورة إلى Supabase Storage
    const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/payment-receipts/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': mimeType,
        'x-upsert': 'true'
      },
      body: binaryData
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      throw new Error(`فشل في الرفع: ${errorText}`);
    }

    // الحصول على الرابط العام
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/payment-receipts/${fileName}`;

    // الحصول على المستخدم من رأس التفويض
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('رأس التفويض غير موجود');
    }

    const token = authHeader.replace('Bearer ', '');

    // التحقق من صحة الرمز والحصول على المستخدم
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': serviceRoleKey
      }
    });

    if (!userResponse.ok) {
      throw new Error('رمز غير صالح');
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    // حفظ بيانات الإيصال في قاعدة البيانات
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/payment_receipts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        booking_id: bookingId,
        student_id: userId,
        receipt_url: publicUrl,
        amount: amount,
        status: 'pending'
      })
    });

    if (!insertResponse.ok) {
      const errorText = await insertResponse.text();
      throw new Error(`فشل في إدراج قاعدة البيانات: ${errorText}`);
    }

    const receiptData = await insertResponse.json();

    return new Response(JSON.stringify({
      data: {
        publicUrl,
        receipt: receiptData[0]
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('خطأ في رفع الإيصال:', error);

    const errorResponse = {
      error: {
        code: 'RECEIPT_UPLOAD_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});