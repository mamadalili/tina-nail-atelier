'use client';

import { useState } from 'react';

const colours = [
  { name: 'سبز سلطنتی', english: 'Imperial green', hex: '#164c3c', note: 'عمیق، آرام و کمی متفاوت؛ برای جزئیاتی که لازم نیست بلند حرف بزنند.' },
  { name: 'زرشکی', english: 'Burgundy', hex: '#75283e', note: 'غنی و کلاسیک؛ رنگی که حتی در ساده‌ترین فرم هم دیده می‌شود.' },
  { name: 'طوسی مرواریدی', english: 'Pearl grey', hex: '#a9b0aa', note: 'روشن و مینیمال؛ برای وقتی که فرم ناخن را به رنگ ترجیح می‌دهی.' },
];

export function ColourStudy() {
  const [active, setActive] = useState(0);
  const [finish, setFinish] = useState<'gloss' | 'matte'>('gloss');
  const [shape, setShape] = useState<'almond' | 'square' | 'short'>('almond');
  const colour = colours[active];
  return <div className="colour-studio" style={{ '--lacquer': colour.hex } as React.CSSProperties}>
    <div className="lacquer-preview" data-finish={finish} data-shape={shape}>
      <span className="preview-word" aria-hidden="true" lang="en" dir="ltr">Colour.</span>
      <div className="sample-fan" aria-hidden="true">{[-2, -1, 0, 1, 2].map((position, index) => <span className="nail-sample" key={position} style={{ '--turn': `${position * 12}deg`, '--offset': `${position * 48}px`, '--lift': `${Math.abs(position) * 13}px`, '--sample-order': index } as React.CSSProperties} />)}</div>
      <div className="preview-caption"><span lang="en" dir="ltr">{colour.english}</span><span>{finish === 'gloss' ? 'جلوهٔ براق' : 'جلوهٔ مات'}</span></div>
    </div>
    <div className="colour-description"><div className="colour-title"><h3>{colour.name}</h3><span lang="en" dir="ltr">{colour.english}</span></div><p aria-live="polite">{colour.note}</p>
      <div className="colour-controls"><div className="swatches" role="group" aria-label="انتخاب رنگ پیشنهادی">{colours.map((item, index) => <button key={item.name} type="button" aria-label={item.name} aria-pressed={active === index} className={active === index ? 'swatch selected' : 'swatch'} onClick={() => setActive(index)} style={{ '--swatch': item.hex } as React.CSSProperties}><span />{active === index && <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 10 3 3 7-7" /></svg>}</button>)}</div><div className="finish-switch" role="group" aria-label="انتخاب جلوهٔ لاک"><button type="button" aria-pressed={finish === 'gloss'} onClick={() => setFinish('gloss')}>براق</button><button type="button" aria-pressed={finish === 'matte'} onClick={() => setFinish('matte')}>مات</button></div></div>
      <div className="shape-switch" role="group" aria-label="انتخاب فرم نمونه"><span>فرم نمونه</span>{([['almond', 'بادامی'], ['square', 'نیمه‌مربعی'], ['short', 'کوتاه']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={shape === value} onClick={() => setShape(value)}>{label}</button>)}</div>
      <small className="quiet-note">پیش‌نمایش برای الهام از رنگ و فرم است؛ انتخاب نهایی را با هم هماهنگ می‌کنیم.</small>
    </div>
  </div>;
}
