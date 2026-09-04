import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { base44 } from '@/api/base44Client';
import { fmtDateHuman, todayStr } from '@/lib/dashboardData';

function daysBetween(a, b) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((da - db) / 86400000);
}
function signed(n) {
  if (n > 0) return `+${n}`;
  return `${n}`;
}
function toDisplay(iso) {
  const [y, m, d] = (iso || '').split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}
function parseDisplay(text) {
  const t = (text || '').trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}

export default function Header({ date, onShift, onDateChange, onToday }) {
  const offset = daysBetween(date, todayStr());
  const backLabel = offset < 0 ? signed(offset) : '';
  const fwdLabel = offset > 0 ? signed(offset) : '';
  const [text, setText] = useState(toDisplay(date));
  const [calOpen, setCalOpen] = useState(false);
  const [dataDates, setDataDates] = useState([]);

  useEffect(() => {
    setText(toDisplay(date));
  }, [date]);

  useEffect(() => {
    (async () => {
      try {
        const recs = await base44.entities.Cancellation.list('-created_date', 2000);
        const set = new Set(recs.map((r) => r.date).filter(Boolean));
        setDataDates([...set].map((s) => {const [y, m, d] = s.split('-').map(Number);return new Date(y, m - 1, d);}));
      } catch (e) {/* ignore */}
    })();
  }, []);

  const calDate = (() => {
    const [y, m, d] = (date || '').split('-').map(Number);
    if (!y || !m || !d) return new Date();
    return new Date(y, m - 1, d);
  })();

  const commit = () => {
    const iso = parseDisplay(text);
    if (iso) onDateChange(iso);else
    setText(toDisplay(date));
  };

  return (
    <>
      <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
        <div className="leading-tight">
          <img
            src="https://media.base44.com/images/public/6a8be71cffb7591e161675e6/ccebb5acb_Untitleddesign.png"
            alt="UPANDRUNNING"
            className="h-20 w-auto object-contain pr-1" />
          
          <div className="text-[#777] text-[13px] tracking-wide uppercase mt-1">Patient Services Daily Dashboard</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShift(-1)}
            aria-label="Previous day"
            className="h-8 px-2 rounded-md border border-[#ddd] bg-white text-[#c0392b] text-sm font-bold cursor-pointer hover:bg-[#fbeae7] flex items-center gap-1">
            
            <span className="text-base leading-none">‹</span>
            {backLabel && <span>{backLabel}</span>}
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={text}
            placeholder="DD/MM/YYYY"
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {if (e.key === 'Enter') {e.currentTarget.blur();}}}
            className={`border border-[#ddd] rounded-md px-2.5 py-1.5 text-sm font-semibold w-[130px] focus:outline-none focus:border-[#006272] text-center ${offset < 0 ? 'text-[#c0392b]' : offset > 0 ? 'text-[#1e8449]' : 'text-[#333]'}`} />
          
          <button
            onClick={() => onShift(1)}
            aria-label="Next day"
            className="h-8 px-2 rounded-md border border-[#ddd] bg-white text-[#1e8449] text-sm font-bold cursor-pointer hover:bg-[#e7f4ec] flex items-center gap-1">
            
            <span className="text-base leading-none">›</span>
            {fwdLabel && <span>{fwdLabel}</span>}
          </button>
          <button
            onClick={onToday}
            className="border border-[#006272] text-[#006272] bg-white rounded-md px-2.5 py-1.5 text-[13px] cursor-pointer hover:bg-[#E6EEEF]">
            
            Today
          </button>
          <Popover open={calOpen} onOpenChange={setCalOpen}>
            <PopoverTrigger asChild>
              <button
                aria-label="Pick date"
                className="h-8 w-8 rounded-md border border-[#ddd] bg-white text-[#006272] cursor-pointer hover:bg-[#E6EEEF] flex items-center justify-center">
                
                <CalendarIcon className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={calDate}
                modifiers={{ hasData: dataDates }}
                modifiersClassNames={{ hasData: 'bg-[#fff3cd] !text-[#7a5c00] font-semibold' }}
                onSelect={(d) => {if (d) {const y = d.getFullYear();const m = String(d.getMonth() + 1).padStart(2, '0');const day = String(d.getDate()).padStart(2, '0');onDateChange(`${y}-${m}-${day}`);setCalOpen(false);}}} />
              
            </PopoverContent>
          </Popover>
        </div>
      </div>
      <div className="text-[13px] text-[#777] mb-3.5">{fmtDateHuman(date)}</div>
    </>);

}