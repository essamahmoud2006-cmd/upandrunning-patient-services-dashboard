import React from 'react';
import { fmtTime } from '@/lib/dashboardData';

export default function ActivityLogBox({ logs }) {
  return (
    <div className="bg-white border border-[#ddd] rounded-[10px] px-4 max-h-[260px] overflow-y-auto">
      {logs && logs.length ? (
        logs.map((entry) => (
          <div key={entry.id} className="flex gap-3 py-2 border-b border-[#f0f0f0] last:border-b-0 text-[13px]">
            <div className="text-[#777] min-w-[52px]">{fmtTime(entry.timestamp)}</div>
            <div className="text-[#333]">{entry.label}</div>
          </div>
        ))
      ) : (
        <div className="text-[#777] text-[13px] py-4 text-center">No activity logged yet today.</div>
      )}
    </div>
  );
}