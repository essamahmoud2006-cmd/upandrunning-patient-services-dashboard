import React, { useState } from 'react';
import { useDashboardData, todayStr } from '@/lib/dashboardData';
import { base44 } from '@/api/base44Client';
import Header from '@/components/dashboard/Header';
import LocationTabs from '@/components/dashboard/LocationTabs';
import AllLocationsView from '@/components/dashboard/AllLocationsView';
import LocationView from '@/components/dashboard/LocationView';

export default function Dashboard() {
  const [date, setDate] = useState(todayStr());
  const [activeTab, setActiveTab] = useState('all');
  const [uploading, setUploading] = useState(false);
  const dash = useDashboardData(date);

  const shiftDate = (days) => {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };
  const goToday = () => setDate(todayStr());

  const handleImportFile = async (file) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.csv') && !lower.endsWith('.txt') && !lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      dash.setImportSummary({ error: "That file type isn't supported. Use the .csv or .xlsx export from Insta HMS." });
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.functions.invoke('importCancellationsReport', { file_url, date, file_name: file.name });
      dash.setImportSummary(res.data);
      await dash.reload();
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || 'Import failed. Try re-exporting the report, or paste it in instead.';
      dash.setImportSummary({ error: msg });
    }
    setUploading(false);
  };

  if (dash.loading) {
    return <div className="text-center text-[#777] py-20 text-sm">Loading dashboard…</div>;
  }

  return (
    <div className="max-w-[1100px] mx-auto px-5 pb-16">
      <Header date={date} onShift={shiftDate} onDateChange={(v) => v && setDate(v)} onToday={goToday} />
      <LocationTabs active={activeTab} onChange={setActiveTab} />
      {activeTab === 'all' ? (
        <AllLocationsView
          date={date}
          cancellations={dash.cancellations}
          counters={dash.counters}
          importSummary={dash.importSummary}
          onImportFile={handleImportFile}
          onImportPaste={dash.importCsvReport}
          onDismissSummary={() => dash.setImportSummary(null)}
          uploading={uploading}
        />
      ) : (
        <LocationView
          locKey={activeTab}
          cancellations={dash.cancellations.filter((p) => p.location === activeTab)}
          counter={dash.counters[activeTab]}
          logs={dash.logs[activeTab] || []}
          onAddPaste={dash.addPatientsFromText}
          onAddSingle={dash.addPatientsFromText}
          onToggle={dash.toggleRecouped}
          onNote={dash.updatePatientNote}
          onPhone={dash.updatePatientPhone}
          onRemove={dash.removePatient}
          onAdjust={dash.adjustCounter}
        />
      )}
      <div className="mt-7 text-center text-xs text-[#777]">
        Shared dashboard — visible to all Patient Services staff. Changes save automatically.
      </div>
    </div>
  );
}