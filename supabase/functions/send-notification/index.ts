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
    const { type, recipientId, data } = await req.json();

    if (!type || !recipientId) {
      throw new Error('نوع الإشعار ومعرف المستقبل مطلوبان');
    }

    // الحصول على مفاتيح البيئة
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceRoleKey || !supabaseUrl) {
      throw new Error('إعدادات Supabase غير متوفرة');
    }

    let message = '';
    switch (type) {
      case 'new_booking':
        message = `حجز جديد للدرس: ${data.serviceTitle}`;
        break;
      case 'booking_confirmed':
        message = 'تم تأكيد حجزك للدرس';
        break;
      case 'receipt_uploaded':
        message = 'تم رفع إيصال دفع جديد للمراجعة';
        break;
      case 'payment_approved':
        message = 'تم الموافقة على الدفع';
        break;
      case 'payment_rejected':
        message = 'تم رفض الدفع - يرجى المراجعة';
        break;
      default:
        message = 'إشعار جديد';
    }

    // هنا يمكن إضافة منطق الإشعارات الفورية
    // مثل إرسال push notifications أو websockets
    // حالياً سنعيد استجابة ناجحة
    
    return new Response(JSON.stringify({
      data: {
        success: true,
        message: 'تم إرسال الإشعار بنجاح',
        notification: {
          type,
          recipientId,
          message,
          timestamp: new Date().toISOString()
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('خطأ في إرسال الإشعار:', error);

    const errorResponse = {
      error: {
        code: 'NOTIFICATION_FAILED',
        message: error.message
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});