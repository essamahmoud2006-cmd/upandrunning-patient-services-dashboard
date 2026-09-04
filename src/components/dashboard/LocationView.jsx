import React from 'react';
import { LOCATIONS, newTotal } from '@/lib/dashboardData';
import SummaryCards from './SummaryCards';
import CounterGrid from './CounterGrid';
import ActivityLogBox from './ActivityLogBox';

export default function LocationView({
  locKey,
  cancellations,
  counter,
  logs,
  bookings,
  onAddPaste,
  onAddSingle,
  onToggle,
  onNote,
  onPhone,
  onRemove,
  onAdjust,
  onAddBooking,
  onRemoveBooking,
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
          { label: 'Recoup rate', value: rate === null ? '—' : rate + '%', tone: rate === null ? null : rate >= 80 ? 'green' : 'red', sub: rate !== null && rate >= 80 ? 'On target' : '' },
          { label: 'New appointments today', value: total, orange: true },
        ]}
      />

      <div className="text-sm font-bold text-[#006272] uppercase tracking-wide mt-6 mb-2.5">Tap to log</div>
      <CounterGrid counter={ctr} bookings={bookings} onAdjust={onAdjust} onAddBooking={onAddBooking} onRemoveBooking={onRemoveBooking} />

      <div className="text-sm font-bold text-[#006272] uppercase tracking-wide mt-6 mb-2.5">Activity log — {loc.name}</div>
      <ActivityLogBox logs={logs} />
    </>
  );
}