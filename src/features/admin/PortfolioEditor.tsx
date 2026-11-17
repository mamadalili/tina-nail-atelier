import { useEffect, useRef, useState } from 'react';
import { services, staffMembers, type ServiceId, type StaffId } from '../../content/salon';
import { artistPortfolio, photoUrl, portfolioSchema, readPortfolio, type Portfolio } from '../services/portfolio';
import { parseTariffInput, PortfolioInputError, preparePortfolioPhoto } from './portfolio-input';
import './portfolio-editor.css';

type RequestPanel = (action: string, body?: object, signal?: AbortSignal) => Promise<unknown>;
type Mutation = (body: () => object | Promise<object>, success: string) => Promise<boolean>;

export function PortfolioEditor({ staff, request }: { staff: StaffId; request: RequestPanel }) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [service, setService] = useState<ServiceId>('manicure');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean } | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const person = staffMembers.find(item => item.id === staff)!;

  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    const active = new AbortController();
    setLoading(true);
    setFeedback(null);
    readPortfolio(active.signal).then(data => {
      if (!active.signal.aborted) setPortfolio(data);
    }).catch(() => {
      if (!active.signal.aborted) {
        setPortfolio(null);
        setFeedback({ error: true, message: 'تعرفه و نمونه‌کارها دریافت نشد. دوباره تلاش کن.' });
      }
    }).finally(() => { if (!active.signal.aborted) setLoading(false); });
    return () => active.abort();
  }, [refresh]);

  const mutate: Mutation = async (body, success) => {
    if (mutation.current || loading) return false;
    const active = new AbortController();
    mutation.current = active;
    setBusy(true);
    setFeedback(null);
    try {
      const payload = await body();
      // Resizing can outlast logout. Only submit while the initiating editor is mounted.
      if (active.signal.aborted) return false;
      const result = await request('portfolio', { ...payload, staff }, active.signal);
      if (active.signal.aborted) return false;
      setPortfolio(portfolioSchema.parse(result));
      setFeedback({ message: success });
      return true;
    } catch (error) {
      if (active.signal.aborted) return false;
      const message = error instanceof PortfolioInputError || (error instanceof Error && 'status' in error) ? error.message
        : 'نتیجهٔ تغییر دریافت نشد. فهرست را تازه کن و وضعیت انتشار را ببین.';
      setFeedback({ message, error: true });
      return false;
    } finally {
      mutation.current = null;
      if (!active.signal.aborted) setBusy(false);
    }
  };

  return <section className="admin-performance portfolio-editor" aria-labelledby="portfolio-heading">
    <header><h2 id="portfolio-heading">تعرفه و نمونه‌کارهای {person.name}</h2>
      <button type="button" className="admin-text-button" disabled={busy || loading} onClick={() => setRefresh(value => value + 1)}>تازه‌کردن فهرست</button></header>
    {loading ? <p role="status">در حال دریافت نمونه‌کارها…</p> : portfolio && <>
      <label className="portfolio-service">انتخاب خدمت
        <select value={service} disabled={busy} onChange={event => { setService(event.target.value as ServiceId); setFeedback(null); }}>
          {services.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <OfferingEditor key={service} portfolio={portfolio} staff={staff} service={service} mutate={mutate} busy={busy} />
    </>}
    {feedback && <p className={'admin-feedback' + (feedback.error ? ' error' : '')} role={feedback.error ? 'alert' : 'status'}>{feedback.message}</p>}
  </section>;
}

function OfferingEditor({ portfolio, staff, service, mutate, busy }: {
  portfolio: Portfolio; staff: StaffId; service: ServiceId; mutate: Mutation; busy: boolean;
}) {
  const { photos, tariff } = artistPortfolio(portfolio, staff, service);
  const [minimum, setMinimum] = useState(String(tariff?.minimum ?? ''));
  const [maximum, setMaximum] = useState(String(tariff?.maximum ?? ''));
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const serviceName = services.find(item => item.id === service)!.name;
  const artistName = staffMembers.find(item => item.id === staff)!.name;

  async function publishPhoto(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;
    const saved = await mutate(async () => ({ type: 'photo', service, jpeg: await preparePortfolioPhoto(file) }), 'عکس در نمونه‌کارهای ' + serviceName + ' منتشر شد.');
    if (saved) { setFile(null); if (fileInput.current) fileInput.current.value = ''; }
  }
  function publishTariff(event: React.FormEvent) {
    event.preventDefault();
    void mutate(() => ({ type: 'tariff', service, ...parseTariffInput(minimum, maximum) }),
      minimum.trim() ? 'تعرفهٔ ' + serviceName + ' در سایت به‌روز شد.' : 'تعرفه از سایت برداشته شد.');
  }

  return <div className="portfolio-edit-grid">
    <form onSubmit={publishTariff}>
      <h3>تعرفهٔ {serviceName}</h3>
      <p>برای قیمت ثابت فقط مبلغ اول را بنویس. با خالی گذاشتن هر دو مبلغ، مهمان می‌تواند تعرفه را از سالن بپرسد.</p>
      <div className="portfolio-prices">
        <label>قیمت یا حداقل (تومان)<input dir="ltr" type="text" inputMode="numeric" maxLength={12} value={minimum}
          disabled={busy} onChange={event => setMinimum(event.target.value)} /></label>
        <label>حداکثر (اختیاری)<input dir="ltr" type="text" inputMode="numeric" maxLength={12} value={maximum}
          disabled={busy} onChange={event => setMaximum(event.target.value)} /></label>
      </div>
      <button className="admin-button secondary" disabled={busy}>ذخیرهٔ تعرفه</button>
    </form>
    <div className="portfolio-photo-editor">
      <h3>عکس‌های {serviceName} از {artistName}</h3>
      {photos.length > 0 && <div className="portfolio-thumbnails">{photos.map((photo, index) => <div key={photo.id}>
        <a href={photoUrl(photo.id)} target="_blank" rel="noopener noreferrer"><img src={photoUrl(photo.id)} width={photo.width} height={photo.height}
          alt={`نمونه‌کار ${serviceName} از ${artistName}، عکس ${(index + 1).toLocaleString('fa-IR')}`} /></a>
        <button type="button" disabled={busy} className="admin-text-button danger-text" aria-label={'برداشتن عکس ' + (index + 1).toLocaleString('fa-IR') + ' از سایت'}
          onClick={() => { if (window.confirm('این عکس از نمونه‌کارهای سایت برداشته شود؟')) void mutate(() => ({ type: 'remove', service, id: photo.id }), 'عکس از سایت برداشته شد.'); }}>
          برداشتن
        </button>
      </div>)}</div>}
      {photos.length < 3 ? <form onSubmit={publishPhoto}>
        <label>عکس نمونه‌کار
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
            onChange={event => setFile(event.target.files?.[0] ?? null)} aria-describedby="portfolio-photo-hint" />
        </label>
        <p id="portfolio-photo-hint">عکس کار خودت را با اجازهٔ انتشار انتخاب کن. تا سه عکس JPEG، PNG یا WebP برای هر خدمت.</p>
        <button className="admin-button secondary" disabled={!file || busy}>{busy && file ? 'در حال ثبت…' : 'انتشار عکس در سایت'}</button>
      </form> : <p>برای جایگزینی، ابتدا یکی از سه عکس را بردار.</p>}
    </div>
  </div>;
}
