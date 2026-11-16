export const salon = {
  name: 'تینا حسین‌زاده',
  latinName: 'Tina Hosseinzadeh',
  phone: '09353155852',
  internationalPhone: '+989353155852',
  whatsapp: 'https://wa.me/989353155852',
  address: 'ستارخان، حبیب‌الله شمالی',
  phoneLink: 'tel:+989353155852',
  smsLink: 'sms:+989353155852',
} as const;

export const services = [
  {
    id: 'manicure', name: 'خدمات دست', english: 'Hand Care', subtitle: 'رسیدگی به ناخن‌های دست',
    description: 'فرم، رنگ و طرح ناخن‌های دستت را با هم انتخاب می‌کنیم. اگر مدلی در ذهن داری، پیش از نوبتت عکسش را برایم بفرست.',
    detail: 'هزینه و جزئیات طرح را پیش از مراجعه هماهنگ می‌کنیم.',
  },
  {
    id: 'pedicure', name: 'خدمات پا', english: 'Foot Care', subtitle: 'رسیدگی به ناخن‌های پا',
    description: 'وقتی برای رسیدگی به ناخن‌های پا و انتخاب رنگ دلخواهت. برای هماهنگی، روز و بازهٔ دوساعتهٔ مناسب خودت را انتخاب کن.',
    detail: 'جزئیات خدمات پا و هزینه را پیش از مراجعه هماهنگ می‌کنیم.',
  },
] as const;

export type ServiceId = typeof services[number]['id'];
export const staffMembers = [{ id: 'tina', name: 'تینا' }, { id: 'sonia', name: 'سونیا' }] as const;
export type StaffId = typeof staffMembers[number]['id'];
export const manicureOptions = [
  { id: 'gel', label: 'ژلیش' },
  { id: 'extensions', label: 'کاشت' },
] as const;
export type ManicureType = typeof manicureOptions[number]['id'];
export const periods = [
  { id: '10-12', label: '۱۰ تا ۱۲', startHour: 10 },
  { id: '12-14', label: '۱۲ تا ۱۴', startHour: 12 },
  { id: '14-16', label: '۱۴ تا ۱۶', startHour: 14 },
  { id: '16-18', label: '۱۶ تا ۱۸', startHour: 16 },
] as const;

export type PeriodId = typeof periods[number]['id'];
