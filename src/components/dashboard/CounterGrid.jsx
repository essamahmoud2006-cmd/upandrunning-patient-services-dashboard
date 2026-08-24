import React from 'react';
import { COUNTER_DEFS } from '@/lib/dashboardData';

export default function CounterGrid({ counter, onAdjust }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {COUNTER_DEFS.map((c) => (
        <div key={c.field} className="bg-white border border-[#ddd] rounded-[10px] px-4 py-3.5 flex flex-col gap-2.5">
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold text-[#333]">{c.name}</span>
            <span className="text-2xl font-bold text-[#006272]">{counter ? counter[c.field] || 0 : 0}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onAdjust(counter.location, c.field, -1)}
              className="flex-1 border-none rounded-lg py-2.5 text-base font-bold bg-[#E6EEEF] text-[#006272] cursor-pointer hover:bg-[#d3e2e4]"
            >
              −
            </button>
            <button
              onClick={() => onAdjust(counter.location, c.field, 1)}
              className="flex-1 border-none rounded-lg py-2.5 text-base font-bold bg-[#006272] text-white cursor-pointer hover:bg-[#004a56]"
            >
              + 1
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}