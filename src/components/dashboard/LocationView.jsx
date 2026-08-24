import React from 'react';
import { LOCATIONS, newTotal } from '@/lib/dashboardData';
import SummaryCards from './SummaryCards';
import CancellationsPanel from './CancellationsPanel';
import CounterGrid from './CounterGrid';
import ActivityLogBox from './ActivityLogBox';

export default function LocationView({
  locKey,
  cancellations,
  counter,
  logs,
  onAddPaste,
  onAddSingle,
  onToggle,
  onNote,
  onPhone,
  onRemove,
  onAdjust,
}) {
  const loc = LOCATIONS.find((l) => l.key === locKey);
  const carried = cancellations.length;
  const recoupedN = cancellations.filter((p) => p.recouped).length;
  const rate = carried ? Math.round((recoupedN / carried) * 100) : null;
  const ctr = counter || { phone: 0, whatsapp: 0, referral: 0, waitlist: 0, location: locKey };
  const total = newTotal(ctr);

  return (
    <>
      <SummaryCards
        items={[
          { label: 'Carried from yesterday', value: carried },
          { label: 'Recouped', value: recoupedN, orange: true },
          { label: 'Recoup rate', value: rate === null ? '—' : rate + '%', sub: rate !== null && rate >= 80 ? 'On target' : '' },
          { label: 'New appointments today', value: total, orange: true },
        ]}
      />

      <CancellationsPanel
        locKey={locKey}
        locName={loc.name}
        cancellations={cancellations}
        onAddPaste={onAddPaste}
        onAddSingle={onAddSingle}
        onToggle={onToggle}
        onNote={onNote}
        onPhone={onPhone}
        onRemove={onRemove}
      />

      <div className="text-sm font-bold text-[#006272] uppercase tracking-wide mt-6 mb-2.5">Tap to log</div>
      <CounterGrid counter={ctr} onAdjust={onAdjust} />

      <div className="text-sm font-bold text-[#006272] uppercase tracking-wide mt-6 mb-2.5">Activity log — {loc.name}</div>
      <ActivityLogBox logs={logs} />
    </>
  );
}