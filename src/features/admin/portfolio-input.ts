import { normalizeDigits } from '../booking/model';

export class PortfolioInputError extends Error {}

export function parseTariffInput(minimumText: string, maximumText: string) {
  function amount(text: string) {
    const value = normalizeDigits(text.trim());
    if (!value) return null;
    if (!/^(?:\d{1,9}|\d{1,3}(?:[,٬]\d{3}){1,2})$/.test(value)) throw new PortfolioInputError('مبلغ را به تومان و با رقم‌های کامل وارد کن.');
    const parsed = Number(value.replace(/[,٬]/g, ''));
    if (parsed < 1) throw new PortfolioInputError('مبلغ تعرفه باید بیشتر از صفر باشد.');
    return parsed;
  }
  const minimum = amount(minimumText);
  const maximum = amount(maximumText);
  if (maximum !== null && (minimum === null || maximum < minimum)) throw new PortfolioInputError('کمترین تعرفه را وارد کن و سقف را برابر یا بیشتر از آن بگذار.');
  return { minimum, maximum };
}

export async function preparePortfolioPhoto(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size === 0) {
    throw new PortfolioInputError('عکس JPEG، PNG یا WebP انتخاب کن.');
  }
  if (file.size > 20 * 1024 * 1024) throw new PortfolioInputError('عکسی با حجم حداکثر ۲۰ مگابایت انتخاب کن.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new PortfolioInputError('عکس باز نشد. فایل دیگری انتخاب کن.'); }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new PortfolioInputError('مرورگر نتوانست عکس را آماده کند.');
    for (const longSide of [1280, 860]) {
      const scale = Math.min(1, longSide / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL('image/jpeg', 0.82);
      const prefix = 'data:image/jpeg;base64,';
      if (data.startsWith(prefix) && data.length - prefix.length <= 1000000) return data.slice(prefix.length);
    }
    throw new PortfolioInputError('حجم عکس زیاد است. عکس کوچک‌تری انتخاب کن.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
