import React, { useState } from 'react';

export default function BookingCounterCard({ def, locKey, counter, bookings, onAdjust, onAddBooking, onRemoveBooking }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const count = counter ? counter[def.field] || 0 : 0;
  const list = bookings || [];

  const submit = () => {
    if (!name.trim()) return;
    onAddBooking(locKey, def.field, name.trim(), phone.trim());
    setName('');
    setPhone('');
    setOpen(false);
  };

  return (
    <div className="bg-white border border-[#ddd] rounded-[10px] px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex justify-between items-center">
        <span className="text-sm font-semibold text-[#333]">{def.name}</span>
        <span className="text-2xl font-bold text-[#006272]">{count}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onAdjust(locKey, def.field, -1)}
          className="flex-1 border-none rounded-lg py-2.5 text-base font-bold bg-[#E6EEEF] text-[#006272] cursor-pointer hover:bg-[#d3e2e4]"
        >
          −
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 border-none rounded-lg py-2.5 text-base font-bold bg-[#006272] text-white cursor-pointer hover:bg-[#004a56]"
        >
          + 1
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2 border-t border-[#eee] pt-2.5">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Patient name"
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="border border-[#ddd] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#006272]"
          />
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone number"
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
            className="border border-[#ddd] rounded-md px-2.5 py-1.5 text-[13px] outline-none focus:border-[#006272]"
          />
          <button
            onClick={submit}
            className="border-none rounded-md py-1.5 text-[13px] font-semibold bg-[#006272] text-white cursor-pointer hover:bg-[#004a56]"
          >
            Add
          </button>
        </div>
      )}

      {list.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-[#eee] pt-2 max-h-36 overflow-auto">
          {list.map((b) => (
            <div key={b.id} className="flex justify-between items-center text-xs gap-2">
              <span className="text-[#333] truncate">{b.name}{b.phone ? ` · ${b.phone}` : ''}</span>
              <button
                onClick={() => onRemoveBooking(b.id, locKey, def.field)}
                aria-label="Remove"
                className="border-none bg-transparent text-[#999] cursor-pointer text-[13px] px-1 hover:text-[#E87722] flex-shrink-0"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}