export const APP_LOCALE = 'ar-SA';

const statusLabels: Record<string, string> = {
  queued: 'في الانتظار',
  submitted_to_hi3d: 'تم الإرسال إلى Hi3D',
  hi3d_created: 'تم إنشاء المهمة',
  hi3d_queueing: 'في طابور Hi3D',
  hi3d_processing: 'قيد المعالجة',
  downloading_result: 'جارِ تنزيل النتيجة',
  completed: 'مكتمل',
  failed: 'فشل',
  result_download_failed: 'فشل تنزيل النتيجة',
  cancelled: 'أُلغي',
  expired: 'منتهي',
};

const eventLabels: Record<string, string> = {
  job_queued: 'أُضيفت المهمة إلى الطابور',
  submit_started: 'بدأ تجهيز الإرسال',
  submitted_to_hi3d: 'تم الإرسال إلى Hi3D',
  hi3d_created: 'أنشأ Hi3D المهمة',
  hi3d_queueing: 'المهمة في طابور Hi3D',
  hi3d_processing: 'Hi3D يعالج النموذج',
  hi3d_success: 'أعاد Hi3D النتيجة',
  job_failed: 'فشلت المهمة',
  download_started: 'بدأ تنزيل النتيجة',
  download_failed: 'فشل تنزيل النتيجة',
  job_completed: 'اكتمل التوليد',
  callback_created: 'وصل إشعار إنشاء المهمة',
  callback_queueing: 'وصل إشعار وضع المهمة في الطابور',
  callback_processing: 'وصل إشعار بدء المعالجة',
  callback_success: 'وصل إشعار نجاح المعالجة',
  callback_failed: 'وصل إشعار فشل المعالجة',
  job_retried: 'أُعيدت محاولة المهمة',
};

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString(APP_LOCALE);
}

export function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(APP_LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatStatusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll('_', ' ');
}

export function formatEventLabel(eventType: string) {
  return eventLabels[eventType] ?? eventType.replaceAll('_', ' ');
}
