import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

export const LOCATIONS = [
  { key: 'alwasl', name: 'Al Wasl Road' },
  { key: 'difc', name: 'DIFC' },
  { key: 'egc', name: 'Emirates Golf Club' },
  { key: 'jge', name: 'Jumeirah Golf Estates' },
  { key: 'szr', name: 'SZR Studio Republik' },
];

export const COUNTER_DEFS = [
  { field: 'phone', name: 'New booking — Phone' },
  { field: 'whatsapp', name: 'New booking — WhatsApp' },
  { field: 'referral', name: 'Referral booked' },
  { field: 'waitlist', name: 'Waiting list slot filled' },
];

export const CENTER_MAP = {
  sports: 'alwasl',
  'al wasl': 'alwasl',
  'al wasl road': 'alwasl',
  difc: 'difc',
  egc: 'egc',
  'emirates golf club': 'egc',
  jge: 'jge',
  'jumeirah golf estates': 'jge',
  szr: 'szr',
  'szr studio republik': 'szr',
  'studio republik': 'szr',
};

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDateHuman(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

export function newTotal(rec) {
  return (rec.phone || 0) + (rec.whatsapp || 0) + (rec.referral || 0) + (rec.waitlist || 0);
}

function emptyCounter(locKey, date) {
  return { date, location: locKey, phone: 0, whatsapp: 0, referral: 0, waitlist: 0 };
}

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { result.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  result.push(cur);
  return result.map((s) => s.trim());
}

function normalizeHeader(h) {
  return h.toLowerCase().replace(/[^a-z]/g, '');
}

export function cleanName(n) {
  return n.replace(/^(mrs|miss|mr|ms|dr)\.?\s*/i, '').replace(/\s+/g, ' ').trim();
}

function rowsFromCsvText(text) {
  return text.split(/\r?\n/).filter((l) => l.trim().length).map(parseCsvLine);
}

export function useDashboardData(date) {
  const [cancellations, setCancellations] = useState([]);
  const [counters, setCounters] = useState({});
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const [importSummary, setImportSummary] = useState(null);

  const fetchAll = useCallback(async () => {
    const [c, ctr, l] = await Promise.all([
      base44.entities.Cancellation.filter({ date }, '-created_date', 2000),
      base44.entities.DailyCounter.filter({ date }, '-created_date', 100),
      base44.entities.ActivityLog.filter({ date }, '-created_date', 1000),
    ]);
    const ctrMap = {};
    ctr.forEach((r) => { ctrMap[r.location] = r; });
    const missing = LOCATIONS.filter((loc) => !ctrMap[loc.key]);
    if (missing.length) {
      const created = await base44.entities.DailyCounter.bulkCreate(
        missing.map((loc) => emptyCounter(loc.key, date))
      );
      created.forEach((r) => { ctrMap[r.location] = r; });
    }
    setCounters(ctrMap);
    setCancellations(c);
    const logMap = {};
    l.forEach((r) => { (logMap[r.location] = logMap[r.location] || []).push(r); });
    Object.values(logMap).forEach((arr) => arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
    setLogs(logMap);
  }, [date]);

  const load = useCallback(async () => {
    setLoading(true);
    try { await fetchAll(); } catch (e) { console.error('load failed', e); }
    setLoading(false);
  }, [fetchAll]);

  useEffect(() => { load(); }, [load]);

  const addLog = async (locKey, label) => {
    const rec = await base44.entities.ActivityLog.create({ date, location: locKey, label, timestamp: new Date().toISOString() });
    setLogs((prev) => {
      const arr = prev[locKey] ? [rec, ...prev[locKey]] : [rec];
      return { ...prev, [locKey]: arr.slice(0, 60) };
    });
  };

  const adjustCounter = async (locKey, field, delta) => {
    const existing = counters[locKey];
    if (!existing) return;
    const newVal = Math.max(0, (existing[field] || 0) + delta);
    const updated = await base44.entities.DailyCounter.update(existing.id, { [field]: newVal });
    setCounters((prev) => ({ ...prev, [locKey]: updated }));
    if (delta > 0) {
      const def = COUNTER_DEFS.find((c) => c.field === field);
      addLog(locKey, (def ? def.name : field) + ' +1');
    }
  };

  const addPatientsFromText = async (locKey, text) => {
    const names = text.split('\n').map((s) => s.trim()).filter(Boolean).map(cleanName).filter(Boolean);
    if (!names.length) return;
    const created = await base44.entities.Cancellation.bulkCreate(
      names.map((name) => ({ date, location: locKey, name, mrNo: '', consultant: '', reason: '', phone: '', note: '', recouped: false }))
    );
    setCancellations((prev) => [...created, ...prev]);
    addLog(locKey, 'Added ' + names.length + ' patient' + (names.length > 1 ? 's' : '') + ' from cancellations report');
  };

  const toggleRecouped = async (patientId) => {
    const p = cancellations.find((x) => x.id === patientId);
    if (!p) return;
    const updated = await base44.entities.Cancellation.update(patientId, { recouped: !p.recouped });
    setCancellations((prev) => prev.map((x) => (x.id === patientId ? updated : x)));
    addLog(p.location, (updated.recouped ? 'Recouped — ' : 'Unmarked — ') + p.name);
  };

  const updatePatientNote = async (patientId, note) => {
    const p = cancellations.find((x) => x.id === patientId);
    if (!p) return;
    const updated = await base44.entities.Cancellation.update(patientId, { note });
    setCancellations((prev) => prev.map((x) => (x.id === patientId ? updated : x)));
  };

  const updatePatientPhone = async (patientId, phone) => {
    const p = cancellations.find((x) => x.id === patientId);
    if (!p) return;
    const updated = await base44.entities.Cancellation.update(patientId, { phone });
    setCancellations((prev) => prev.map((x) => (x.id === patientId ? updated : x)));
  };

  const removePatient = async (patientId) => {
    const p = cancellations.find((x) => x.id === patientId);
    if (!p) return;
    await base44.entities.Cancellation.delete(patientId);
    setCancellations((prev) => prev.filter((x) => x.id !== patientId));
    addLog(p.location, 'Removed — ' + p.name);
  };

  const importCsvReport = async (text) => {
    const rows = rowsFromCsvText(text);
    let headerIdx = -1;
    let headerFields = null;
    for (let i = 0; i < rows.length; i++) {
      const fields = rows[i].map((f) => (f == null ? '' : String(f)).trim());
      if (fields.some((f) => normalizeHeader(f) === 'patientname')) { headerIdx = i; headerFields = fields; break; }
    }
    if (headerIdx === -1) {
      setImportSummary({ error: 'Could not find a “Patient Name” column in that data. Make sure it includes the header row from the Insta HMS export.' });
      return;
    }
    const norm = headerFields.map(normalizeHeader);
    const phoneIdx = norm.findIndex((h) => h.indexOf('mobile') >= 0 || h.indexOf('phone') >= 0 || h.indexOf('contact') >= 0 || h.indexOf('tel') >= 0);
    const col = {
      center: norm.indexOf('centername'),
      mrno: norm.indexOf('mrno'),
      consultant: norm.indexOf('consultant'),
      patient: norm.indexOf('patientname'),
      reason: norm.indexOf('cancelreason'),
      phone: phoneIdx,
      lastIdx: headerFields.length - 1,
    };
    const perLocationNew = {};
    const perLocationDup = {};
    const unmapped = {};
    let totalNew = 0, totalDup = 0, totalUnmapped = 0;
    const toCreate = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const fields = rows[i].map((f) => (f == null ? '' : String(f)).trim());
      if (fields.length < 2 || fields.every((f) => !f)) continue;
      const centerRaw = (fields[col.center] || '').trim();
      const patientRaw = (fields[col.patient] || '').trim();
      if (!patientRaw) continue;
      const locKey = CENTER_MAP[centerRaw.toLowerCase()];
      if (!locKey) { if (centerRaw) { unmapped[centerRaw] = (unmapped[centerRaw] || 0) + 1; totalUnmapped++; } continue; }
      const name = cleanName(patientRaw);
      const mrNo = col.mrno >= 0 ? (fields[col.mrno] || '').trim() : '';
      const consultant = col.consultant >= 0 ? (fields[col.consultant] || '').trim() : '';
      const reason = col.reason >= 0 ? (fields[col.reason] || '').trim() : '';
      const phone = col.phone >= 0 ? (fields[col.phone] || '').trim() : '';
      const bookingStatus = (fields[col.lastIdx] || '').trim().toLowerCase();
      const recouped = bookingStatus === 'booked';
      const isDup = cancellations.some((p) => (mrNo && p.mrNo ? p.mrNo === mrNo : p.name.toLowerCase() === name.toLowerCase()));
      if (isDup) { perLocationDup[locKey] = (perLocationDup[locKey] || 0) + 1; totalDup++; continue; }
      toCreate.push({ date, location: locKey, name, mrNo, consultant, reason, phone, note: '', recouped });
      perLocationNew[locKey] = (perLocationNew[locKey] || 0) + 1;
      totalNew++;
    }
    if (toCreate.length) {
      const created = await base44.entities.Cancellation.bulkCreate(toCreate);
      setCancellations((prev) => [...created, ...prev]);
      const logCreates = Object.keys(perLocationNew).map((locKey) => ({
        date, location: locKey,
        label: 'Imported ' + perLocationNew[locKey] + ' patient' + (perLocationNew[locKey] > 1 ? 's' : '') + ' from cancellations report',
        timestamp: new Date().toISOString(),
      }));
      if (logCreates.length) {
        const createdLogs = await base44.entities.ActivityLog.bulkCreate(logCreates);
        setLogs((prev) => {
          const next = { ...prev };
          createdLogs.forEach((r) => {
            const arr = next[r.location] ? [r, ...next[r.location]] : [r];
            next[r.location] = arr.slice(0, 60);
          });
          return next;
        });
      }
    }
    setImportSummary({ totalNew, totalDup, totalUnmapped, perLocationNew, unmapped });
  };

  return {
    loading,
    cancellations,
    counters,
    logs,
    importSummary,
    setImportSummary,
    reload: fetchAll,
    adjustCounter,
    addPatientsFromText,
    toggleRecouped,
    updatePatientNote,
    updatePatientPhone,
    removePatient,
    importCsvReport,
  };
}