import React, { useRef, useState } from 'react';
import { fmtDateHuman } from '@/lib/dashboardData';

export default function ImportPanel({ date, onImportFile, onImportPaste, uploading }) {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    await onImportFile(file);
  };

  const submitPaste = async () => {
    if (!pasteText.trim()) return;
    await onImportPaste(pasteText);
    setPasteText('');
  };

  return (
    <div className="bg-white border border-[#ddd] rounded-[10px] px-4 py-3.5 mb-5">
      <div className="flex justify-between items-center mb-2.5">
        <span className="text-[13px] font-bold text-[#006272] uppercase tracking-wide">Import daily cancellations report</span>
        {uploading && <span className="text-xs text-[#777]">Uploading…</span>}
      </div>
      <div className="flex gap-3 items-center mb-2 flex-wrap">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.txt,.xlsx,.xls"
          className="hidden"
          onChange={handleFile}
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="border-none bg-[#006272] text-white rounded-md px-4 py-2 text-[13px] font-semibold cursor-pointer hover:bg-[#004a56]"
        >
          Choose file
        </button>
        <span className="text-xs text-[#777]">{fileName || 'No file chosen'}</span>
      </div>
      <div className="text-[11px] text-[#777] mb-3">
        Download the cancellations report from Insta HMS (.csv or .xlsx) and choose it here — no need to open it first. Patients are sorted into the right location automatically, anyone already showing as Booked is pre-ticked as recouped, and a phone number is pulled in automatically if the report includes one. Imports go into {fmtDateHuman(date)}.
      </div>
      <details className="mt-1" open={pasteOpen} onToggle={(e) => setPasteOpen(e.currentTarget.open)}>
        <summary className="text-xs text-[#006272] cursor-pointer">Or paste the report text instead</summary>
        <div className="flex gap-2 mt-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste the full report here, including its header row"
            className="flex-1 border border-[#ddd] rounded-md px-2.5 py-2 text-[13px] min-h-[70px] resize-y"
          />
          <button
            onClick={submitPaste}
            className="border-none bg-[#006272] text-white rounded-md px-4 text-[13px] font-semibold cursor-pointer hover:bg-[#004a56]"
          >
            Import
          </button>
        </div>
      </details>
    </div>
  );
}