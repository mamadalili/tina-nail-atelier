'use client';

import { useEffect, useState } from 'react';
import { services, staffMembers, type ServiceId } from '@/content/salon';
import { Icon } from '@/components/Icon';
import { ArtistWork } from './ArtistWork';
import { emptyPortfolio, readPortfolio } from './portfolio';

export function ServiceIndex() {
  const [selected, setSelected] = useState<ServiceId | null>('manicure');
  const [portfolio, setPortfolio] = useState(emptyPortfolio);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_BOOKING_ADAPTER !== 'shared-host') return;
    const controller = new AbortController();
    readPortfolio(controller.signal).then(value => {
      if (!controller.signal.aborted) setPortfolio(value);
    }).catch(() => { /* The same service and artist enquiry links work offline. */ });
    return () => controller.abort();
  }, []);

  return <div className="service-index">{services.map(service => <article className={selected === service.id ? 'service-row expanded' : 'service-row'} key={service.id}>
    <h3><button type="button" id={`service-${service.id}`} aria-expanded={selected === service.id} aria-controls={`service-panel-${service.id}`} onClick={() => setSelected(selected === service.id ? null : service.id)}>
      <span className="service-name">{service.name}<small>{service.subtitle}</small></span><span className="service-english" lang="en" dir="ltr">{service.english}</span><span className="service-expander"><Icon name="plus" /></span>
    </button></h3>
    <div id={`service-panel-${service.id}`} role="region" aria-labelledby={`service-${service.id}`} hidden={selected !== service.id} className="service-panel service-details">
      <div className="service-intro"><p>{service.description}</p><span className="service-duration">زمان نوبت <strong>۲ ساعت</strong></span></div>
      <div className="service-artists">{staffMembers.map(person => <ArtistWork key={person.id} person={person} service={service} portfolio={portfolio} />)}</div>
      <a className="service-reserve" href="#appointment-form" onClick={() => { window.dispatchEvent(new CustomEvent('select-service', { detail: service.id })); }}>
        رزرو {service.name} <Icon name="arrow" size={18} />
      </a>
    </div>
  </article>)}</div>;
}
