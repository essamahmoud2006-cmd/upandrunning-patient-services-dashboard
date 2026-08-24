import React from 'react';
import { LOCATIONS } from '@/lib/dashboardData';

export default function ImportSummaryBanner({ summary, onDismiss }) {
  if (!summary) return null;
  return (
    <div className="bg-[#E6EEEF] border border-[#bcdadd] rounded-[10px] px-4 py-3 mb-4 text-[13px]">
      {summary.error ? (
        <>
          <div className="text-[#E87722] font-semibold mb-1">Import did not run</div>
          <div>{summary.error}</div>
        </>
      ) : (
        <>
          <div className="font-bold text-[#006272] mb-1.5">Import complete</div>
          <div>
            {summary.totalNew} patient{summary.totalNew === 1 ? '' : 's'} added
            {summary.totalDup ? `, ${summary.totalDup} already on today's list (skipped)` : ''}.
          </div>
          {summary.perLocationNew && Object.keys(summary.perLocationNew).length > 0 && (
            <div className="mt-1 text-[#777]">
              {Object.keys(summary.perLocationNew).map((k) => {
                const loc = LOCATIONS.find((l) => l.key === k);
                return (loc ? loc.name : k) + ': ' + summary.perLocationNew[k];
              }).join(' · ')}
            </div>
          )}
          {summary.unmapped && Object.keys(summary.unmapped).length > 0 && (
            <>
              <div className="mt-2 text-[#E87722] font-semibold">Not imported — unrecognized center name</div>
              <div className="text-[#E87722]">
                {Object.keys(summary.unmapped).map((k) => k + ' (' + summary.unmapped[k] + ')').join(', ')}
              </div>
            </>
          )}
        </>
      )}
      <button
        onClick={onDismiss}
        className="mt-2 border-none bg-transparent text-[#006272] text-xs font-semibold cursor-pointer p-0"
      >
        Dismiss
      </button>
    </div>
  );
}