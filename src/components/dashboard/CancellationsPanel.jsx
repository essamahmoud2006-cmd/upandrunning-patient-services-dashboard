import React, { useState } from 'react';
import PatientRow from './PatientRow';

export default function CancellationsPanel({ locKey, locName, cancellations, onAddPaste, onAddSingle, onToggle, onNote, onPhone, onRemove }) {
  const [pasteText, setPasteText] = useState('');
  const [single, setSingle] = useState('');

  const submitPaste = async () => {
    if (!pasteText.trim()) return;
    await onAddPaste(locKey, pasteText);
    setPasteText('');
  };
  const submitSingle = async () => {
    if (!single.trim()) return;
    await onAddSingle(locKey, single);
    setSingle('');
  };

  return (
    <div className="bg-white border border-[#ddd] rounded-[10px] px-4 py-3.5 mb-5">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[13px] font-bold text-[#006272] uppercase tracking-wide">
          Cancellations / no-shows — {locName}
        </span>
      </div>
      <div className="flex gap-2 mb-3">
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="Paste patient names from today's cancellations report, one per line"
          className="flex-1 border border-[#ddd] rounded-md px-2.5 py-2 text-[13px] min-h-[40px] resize-y"
        />
        <button
          onClick={submitPaste}
          className="border-none bg-[#006272] text-white rounded-md px-4 text-[13px] font-semibold cursor-pointer hover:bg-[#004a56]"
        >
          Add list
        </button>
      </div>
      <div className="text-[11px] text-[#777] -mt-2 mb-3">
        Copy the patient name column from your daily cancellations report and paste above, or add one at a time below.
      </div>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={single}
          onChange={(e) => setSingle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submitSingle(); }}
          placeholder="Patient name"
          className="flex-1 border border-[#ddd] rounded-md px-2.5 py-2 text-[13px]"
        />
        <button
          onClick={submitSingle}
          className="border-none bg-[#006272] text-white rounded-md px-4 text-[13px] font-semibold cursor-pointer hover:bg-[#004a56]"
        >
          Add
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {cancellations.length ? (
          cancellations.map((p) => (
            <PatientRow
              key={p.id}
              patient={p}
              onToggle={onToggle}
              onNote={onNote}
              onPhone={onPhone}
              onRemove={onRemove}
            />
          ))
        ) : (
          <div className="text-[13px] text-[#777] text-center py-3">No cancellations or no-shows added for this location yet today.</div>
        )}
      </div>
    </div>
  );
}