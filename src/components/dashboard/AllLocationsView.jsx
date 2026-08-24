import React, { useMemo } from 'react';
import { LOCATIONS, newTotal } from '@/lib/dashboardData';
import SummaryCards from './SummaryCards';
import ImportPanel from './ImportPanel';
import ImportSummaryBanner from './ImportSummaryBanner';

function recoupCount(cancs) {
  return cancs.filter((p) => p.recouped).length;
}
function recoupRate(cancs) {
  const total = cancs.length;
  if (!total) return null;
  return Math.round((recoupCount(cancs) / total) * 100);
}

export default function AllLocationsView({
  date,
  cancellations,
  counters,
  importSummary,
  onImportFile,
  onImportPaste,
  onDismissSummary,
  onResetImported,
  uploading,
}) {
  const { rows, totals } = useMemo(() => {
    let tCarried = 0, tRecouped = 0, tPhone = 0, tWA = 0, tRef = 0, tWL = 0;
    const rows = LOCATIONS.map((loc) => {
      const cancs = cancellations.filter((p) => p.location === loc.key);
      const ctr = counters[loc.key] || { phone: 0, whatsapp: 0, referral: 0, waitlist: 0 };
      const carried = cancs.length;
      const recoupedN = recoupCount(cancs);
      const rate = recoupRate(cancs);
      const nt = newTotal(ctr);
      tCarried += carried;
      tRecouped += recoupedN;
      tPhone += ctr.phone || 0;
      tWA += ctr.whatsapp || 0;
      tRef += ctr.referral || 0;
      tWL += ctr.waitlist || 0;
      return { loc, carried, recoupedN, rate, phone: ctr.phone || 0, whatsapp: ctr.whatsapp || 0, referral: ctr.referral || 0, waitlist: ctr.waitlist || 0, nt };
    });
    const totals = {
      carried: tCarried, recouped: tRecouped,
      rate: tCarried ? Math.round((tRecouped / tCarried) * 100) : null,
      phone: tPhone, whatsapp: tWA, referral: tRef, waitlist: tWL,
      nt: tPhone + tWA + tRef + tWL,
    };
    return { rows, totals };
  }, [cancellations, counters]);

  return (
    <>
      <ImportSummaryBanner summary={importSummary} onDismiss={onDismissSummary} />
      <ImportPanel date={date} onImportFile={onImportFile} onImportPaste={onImportPaste} uploading={uploading} />
      {cancellations.length > 0 && (
        <div className="flex justify-end mb-3">
          <button
            onClick={() => { if (window.confirm('Remove ALL imported cancellations for this date? This cannot be undone.')) onResetImported(); }}
            className="text-[12px] font-semibold text-[#c0392b] border border-[#e6b8b0] bg-white rounded-md px-3 py-1.5 cursor-pointer hover:bg-[#fbeae7]"
          >
            Reset imported data
          </button>
        </div>
      )}

      <SummaryCards
        items={[
          { label: 'Carried from yesterday', value: totals.carried },
          { label: 'Recouped', value: totals.recouped, orange: true },
          { label: 'Recoup rate', value: totals.rate === null ? '—' : totals.rate + '%' },
          { label: 'New appointments today', value: totals.nt, orange: true },
        ]}
      />

      <div className="text-sm font-bold text-[#006272] uppercase tracking-wide mt-6 mb-2.5">By location</div>
      <div className="w-full border border-[#ddd] rounded-[10px] overflow-hidden">
        <table className="w-full border-collapse bg-white">
          <thead>
            <tr className="bg-[#006272] text-white">
              {['Location', 'Carried', 'Recouped', 'Recoup rate', 'Phone', 'WhatsApp', 'Referral', 'Waitlist', 'New total'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide first:text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.loc.key} className="border-b border-[#f0f0f0] text-[13px] hover:bg-[#fafafa]">
                <td className="px-3 py-2.5 text-left">{r.loc.name}</td>
                <td className="px-3 py-2.5 text-center">{r.carried}</td>
                <td className="px-3 py-2.5 text-center">{r.recoupedN}</td>
                <td className="px-3 py-2.5 text-center">{r.rate === null ? '—' : r.rate + '%'}</td>
                <td className="px-3 py-2.5 text-center">{r.phone}</td>
                <td className="px-3 py-2.5 text-center">{r.whatsapp}</td>
                <td className="px-3 py-2.5 text-center">{r.referral}</td>
                <td className="px-3 py-2.5 text-center">{r.waitlist}</td>
                <td className="px-3 py-2.5 text-center">{r.nt}</td>
              </tr>
            ))}
            <tr className="bg-[#E6EEEF] font-bold text-[13px]">
              <td className="px-3 py-2.5 text-left">All locations</td>
              <td className="px-3 py-2.5 text-center">{totals.carried}</td>
              <td className="px-3 py-2.5 text-center">{totals.recouped}</td>
              <td className="px-3 py-2.5 text-center">{totals.rate === null ? '—' : totals.rate + '%'}</td>
              <td className="px-3 py-2.5 text-center">{totals.phone}</td>
              <td className="px-3 py-2.5 text-center">{totals.whatsapp}</td>
              <td className="px-3 py-2.5 text-center">{totals.referral}</td>
              <td className="px-3 py-2.5 text-center">{totals.waitlist}</td>
              <td className="px-3 py-2.5 text-center">{totals.nt}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}