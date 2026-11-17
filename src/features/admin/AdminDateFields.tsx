import { faNumber, monthCells, months } from '../../lib/jalali';
import { validDateChange } from './model';

export function AdminDateFields({ title, date, years, onChange }: {
  title: string; date: string; years: number[]; onChange: (date: string) => void;
}) {
  const [year, month, day] = date.split('-').map(Number);
  return <fieldset className="admin-date-fields">
    <legend>{title}</legend>
    <label>روز<select value={day} onChange={event => onChange(validDateChange(date, 'day', Number(event.target.value)))}>
      {monthCells(year, month).filter(value => value !== null).map(value => <option key={value} value={value}>{faNumber(value)}</option>)}
    </select></label>
    <label>ماه<select value={month} onChange={event => onChange(validDateChange(date, 'month', Number(event.target.value)))}>
      {months.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
    </select></label>
    <label>سال<select value={year} onChange={event => onChange(validDateChange(date, 'year', Number(event.target.value)))}>
      {years.map(value => <option key={value} value={value}>{faNumber(value)}</option>)}
    </select></label>
  </fieldset>;
}
