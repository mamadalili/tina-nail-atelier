import { salon, services, staffMembers } from '../../content/salon';
import { artistPortfolio, photoUrl, type Portfolio } from './portfolio';

type Artist = (typeof staffMembers)[number];
type Service = (typeof services)[number];
const numbers = new Intl.NumberFormat('fa-IR');

export function ArtistWork({ person, service, portfolio }: { person: Artist; service: Service; portfolio: Portfolio }) {
  const { photos, tariff } = artistPortfolio(portfolio, person.id, service.id);
  const title = service.name + ' با ' + person.name;
  const inquiry = (message: string) => salon.whatsapp + '?text=' + encodeURIComponent('سلام، ' + message);
  return <div className="artist-work">
    <h4>{person.name}</h4>
    {tariff && <p className="service-tariff">
      {numbers.format(tariff.minimum)}{tariff.maximum !== null && tariff.maximum !== tariff.minimum && ' تا ' + numbers.format(tariff.maximum)} تومان
    </p>}
    {photos.length > 0 && <figure className="service-photos">
      <div>{photos.map((photo, index) => <a key={photo.id} href={photoUrl(photo.id)} target="_blank" rel="noopener noreferrer">
        <img src={photoUrl(photo.id)} width={photo.width} height={photo.height} loading="lazy" decoding="async"
          alt={`نمونه‌کار ${service.name} از ${person.name}، عکس ${numbers.format(index + 1)}`} />
      </a>)}</div>
      <figcaption>نمونه‌کار {service.name} از {person.name}</figcaption>
    </figure>}
    <div className="artist-enquiries">
      <a href={inquiry('می‌خواهم تعرفهٔ ' + title + ' را بدانم.')} target="_blank" rel="noopener noreferrer"
        aria-label={'استعلام تعرفهٔ ' + title + ' در واتس‌اپ سالن'}>استعلام تعرفه</a>
      {photos.length === 0 && <a href={inquiry('لطفاً نمونه‌کار ' + service.name + ' از ' + person.name + ' را برایم بفرستید.')}
        target="_blank" rel="noopener noreferrer" aria-label={'درخواست نمونه‌کار ' + service.name + ' از ' + person.name + ' در واتس‌اپ سالن'}>
        درخواست نمونه‌کار {person.name}
      </a>}
    </div>
  </div>;
}
