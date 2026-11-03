'use client';

import { useState } from 'react';
import { services } from '@/content/salon';
import { Icon } from '@/components/Icon';

export function ServiceIndex() {
  const [selected, setSelected] = useState<string | null>('manicure');
  return <div className="service-index">{services.map(service => <article className={selected === service.id ? 'service-row expanded' : 'service-row'} key={service.id}>
    <h3><button type="button" id={`service-${service.id}`} aria-expanded={selected === service.id} aria-controls={`service-panel-${service.id}`} onClick={() => setSelected(selected === service.id ? null : service.id)}>
      <span className="service-name">{service.name}<small>{service.subtitle}</small></span><span className="service-english" lang="en" dir="ltr">{service.english}</span><span className="service-expander"><Icon name="plus" /></span>
    </button></h3>
    <div id={`service-panel-${service.id}`} role="region" aria-labelledby={`service-${service.id}`} hidden={selected !== service.id} className="service-panel"><p>{service.description}</p><a href="#booking" onClick={() => { window.dispatchEvent(new CustomEvent('select-service', { detail: service.id })); }}>برای {service.name} وقت می‌خواهم <Icon name="arrow" size={18} /></a></div>
  </article>)}</div>;
}
