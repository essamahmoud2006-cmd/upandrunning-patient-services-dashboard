import React from 'react';
import { LOCATIONS } from '@/lib/dashboardData';

export default function LocationTabs({ active, onChange }) {
  const tabClass = (isActive) =>
    `px-3.5 py-2 rounded-full text-[13px] font-semibold cursor-pointer whitespace-nowrap border ${
      isActive
        ? 'bg-[#006272] border-[#006272] text-white'
        : 'bg-white border-[#ddd] text-[#777] hover:bg-[#E6EEEF]'
    }`;
  return (
    <div className="flex flex-wrap gap-1.5 mb-5 border-b-2 border-[#ddd] pb-2.5">
      <div className={tabClass(active === 'all')} onClick={() => onChange('all')}>All Locations</div>
      {LOCATIONS.map((loc) => (
        <div key={loc.key} className={tabClass(active === loc.key)} onClick={() => onChange(loc.key)}>
          {loc.name}
        </div>
      ))}
    </div>
  );
}