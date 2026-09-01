import React from 'react';
import { COUNTER_DEFS } from '@/lib/dashboardData';
import BookingCounterCard from './BookingCounterCard';

export default function CounterGrid({ counter, bookings, onAdjust, onAddBooking, onRemoveBooking }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
      {COUNTER_DEFS.map((c) => (
        <BookingCounterCard
          key={c.field}
          def={c}
          locKey={counter ? counter.location : ''}
          counter={counter}
          bookings={bookings ? bookings[c.field] : []}
          onAdjust={onAdjust}
          onAddBooking={onAddBooking}
          onRemoveBooking={onRemoveBooking}
        />
      ))}
    </div>
  );
}