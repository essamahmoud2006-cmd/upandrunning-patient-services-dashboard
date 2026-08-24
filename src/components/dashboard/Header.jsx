import React from 'react';
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

export default function Header({ date, onShift, onDateChange, onToday }) {
  const offset = daysBetween(date, todayStr());
  const backLabel = offset < 0 ? signed(offset) : '';
  const fwdLabel = offset > 0 ? signed(offset) : '';
  return (
    <>
      <div className="flex justify-between items-start flex-wrap gap-3 mb-4">
        <div className="leading-tight">
          <div className="font-extrabold tracking-wide text-[#006272] text-xl">UPANDRUNNING</div>
          <div className="text-[#777] text-[13px] tracking-wide uppercase mt-0.5">Patient Services Daily Dashboard</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onShift(-1)}
            aria-label="Previous day"
            className="h-8 px-2 rounded-md border border-[#ddd] bg-white text-[#c0392b] text-sm font-bold cursor-pointer hover:bg-[#fbeae7] flex items-center gap-1"
          >
            <span className="text-base leading-none">‹</span>
            {backLabel && <span>{backLabel}</span>}
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="border border-[#ddd] rounded-md px-2.5 py-1.5 text-sm text-[#333] w-[150px] focus:outline-none focus:border-[#006272]"
          />
          <button
            onClick={() => onShift(1)}
            aria-label="Next day"
            className="h-8 px-2 rounded-md border border-[#ddd] bg-white text-[#1e8449] text-sm font-bold cursor-pointer hover:bg-[#e7f4ec] flex items-center gap-1"
          >
            <span className="text-base leading-none">›</span>
            {fwdLabel && <span>{fwdLabel}</span>}
          </button>
          <button
            onClick={onToday}
            className="border border-[#006272] text-[#006272] bg-white rounded-md px-2.5 py-1.5 text-[13px] cursor-pointer hover:bg-[#E6EEEF]"
          >
            Today
          </button>
        </div>
      </div>
      <div className="text-[13px] text-[#777] mb-3.5">{fmtDateHuman(date)}</div>
    </>
  );
}