import React, { useState, useEffect } from 'react';

export default function PatientRow({ patient, onToggle, onNote, onPhone, onRemove }) {
  const meta = [patient.mrNo, patient.consultant, patient.reason].filter(Boolean).join(' · ');
  const phoneDigits = (patient.phone || '').replace(/[^0-9+]/g, '');

  const [note, setNote] = useState(patient.note || '');
  const [phone, setPhone] = useState(patient.phone || '');

  useEffect(() => { setNote(patient.note || ''); }, [patient.id, patient.note]);
  useEffect(() => { setPhone(patient.phone || ''); }, [patient.id, patient.phone]);

  const commitNote = () => { if (note !== (patient.note || '')) onNote(patient.id, note); };
  const commitPhone = () => { if (phone !== (patient.phone || '')) onPhone(patient.id, phone); };

  return (
    <div
      className={`flex items-start gap-2.5 px-2.5 py-2 border rounded-lg ${
        patient.recouped ? 'bg-[#E6EEEF] border-[#bcdadd]' : 'bg-[#FAFAFA] border-[#ddd]'
      }`}
    >
      <input
        type="checkbox"
        checked={!!patient.recouped}
        onChange={() => onToggle(patient.id)}
        aria-label="Mark recouped"
        className="w-[18px] h-[18px] cursor-pointer flex-shrink-0 mt-0.5"
      />
      <span className="flex-1">
        <div className={`text-[13px] font-semibold ${patient.recouped ? 'line-through text-[#777]' : 'text-[#333]'}`}>
          {patient.name}
        </div>
        {meta && <div className="text-[11px] text-[#777] mt-0.5">{meta}</div>}
      </span>
      <input
        type="text"
        placeholder="Phone number"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        onBlur={commitPhone}
        className="text-xs text-[#333] w-[118px] flex-shrink-0 px-1.5 py-1 rounded-md border border-transparent bg-transparent hover:border-[#ddd] hover:bg-white focus:border-[#ddd] focus:bg-white outline-none"
      />
      {phoneDigits && (
        <a
          href={`tel:${phoneDigits}`}
          aria-label={`Call ${patient.name}`}
          className="flex-shrink-0 w-[26px] h-[26px] rounded-full bg-[#006272] text-white flex items-center justify-center text-[13px] no-underline hover:bg-[#004a56]"
        >
          ☎
        </a>
      )}
      <input
        type="text"
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={commitNote}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="text-xs text-[#777] w-[160px] flex-shrink-0 border-transparent bg-transparent outline-none"
      />
      <button
        onClick={() => onRemove(patient.id)}
        aria-label="Remove"
        className="border-none bg-transparent text-[#777] cursor-pointer text-[15px] px-1 flex-shrink-0 hover:text-[#E87722]"
      >
        ✕
      </button>
    </div>
  );
}