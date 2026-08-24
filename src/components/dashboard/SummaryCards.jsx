import React from 'react';

export default function SummaryCards({ items }) {
  return (
    <div className="grid gap-3 mb-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
      {items.map((c, i) => (
        <div key={i} className="bg-white border border-[#ddd] rounded-[10px] px-4 py-3.5">
          <div className="text-xs text-[#777] uppercase tracking-wide mb-1.5">{c.label}</div>
          <div className={`text-[28px] font-bold ${c.orange ? 'text-[#E87722]' : 'text-[#006272]'}`}>{c.value}</div>
          {c.sub ? <div className="text-xs text-[#777] mt-1">{c.sub}</div> : null}
        </div>
      ))}
    </div>
  );
}