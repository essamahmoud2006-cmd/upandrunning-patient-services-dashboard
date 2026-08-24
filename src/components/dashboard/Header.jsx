import React from 'react';
import { fmtDateHuman } from '@/lib/dashboardData';

export default function Header({ date, onShift, onDateChange, onToday }) {
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
            className="w-8 h-8 rounded-md border border-[#ddd] bg-white text-[#c0392b] text-base cursor-pointer hover:bg-[#fbeae7]"
          >
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="border border-[#ddd] rounded-md px-2.5 py-1.5 text-sm text-[#333]"
          />
          <button
            onClick={() => onShift(1)}
            aria-label="Next day"
            className="w-8 h-8 rounded-md border border-[#ddd] bg-white text-[#1e8449] text-base cursor-pointer hover:bg-[#e7f4ec]"
          >
            ›
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