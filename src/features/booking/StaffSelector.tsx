'use client';
import { staffMembers, type StaffId } from '@/content/salon';
import './staff-selector.css';

export function StaffSelector({ value, onChange, disabled = false, name = 'booking-staff', legend = 'وقت با', error }: { value: StaffId; onChange: (staff: StaffId) => void; disabled?: boolean; name?: string; legend?: string; error?: string }) {
  const errorId = `${name}-error`;
  return <fieldset className="staff-picker" disabled={disabled} tabIndex={error ? -1 : undefined} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined}>
    <legend>{legend}</legend>
    {error && <p className="field-error" id={errorId}>{error}</p>}
    <div>{staffMembers.map(person => <label key={person.id} className={value === person.id ? 'staff-option selected' : 'staff-option'}>
      <input type="radio" name={name} value={person.id} checked={value === person.id} onChange={() => onChange(person.id)} />
      <span>{person.name}</span><span aria-hidden="true" className="staff-indicator">{value === person.id ? '✓' : ''}</span>
    </label>)}</div>
  </fieldset>;
}
