import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import * as XLSX from 'npm:xlsx@0.18.5';

const CENTER_MAP = {
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
  return String(h || '').toLowerCase().replace(/[^a-z]/g, '');
}

function cleanName(n) {
  return String(n || '').replace(/^(mrs|miss|mr|ms|dr)\.?\s*/i, '').replace(/\s+/g, ' ').trim();
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const fileUrl = body.file_url;
    const date = body.date;
    const fileName = body.file_name || '';
    if (!fileUrl || !date) return Response.json({ error: 'Missing file_url or date' }, { status: 400 });

    const dl = await fetch(fileUrl);
    if (!dl.ok) return Response.json({ error: 'Could not download the uploaded file. Please try again.' }, { status: 422 });

    const lower = fileName.toLowerCase();
    let rows = [];
    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const buf = await dl.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    } else {
      const text = await dl.text();
      rows = text.split(/\r?\n/).filter((l) => l.trim().length).map(parseCsvLine);
    }

    let headerIdx = -1;
    let headerFields = null;
    for (let i = 0; i < rows.length; i++) {
      const fields = rows[i].map((f) => (f == null ? '' : String(f)).trim());
      if (fields.some((f) => normalizeHeader(f) === 'patientname')) { headerIdx = i; headerFields = fields; break; }
    }
    if (headerIdx === -1) {
      return Response.json({ error: 'Could not find a "Patient Name" column in that file. Make sure it is the Insta HMS cancellations export with its header row intact.' }, { status: 422 });
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

    const existing = await base44.entities.Cancellation.filter({ date }, '-created_date', 2000);
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
      if (!name) continue;
      const mrNo = col.mrno >= 0 ? (fields[col.mrno] || '').trim() : '';
      const consultant = col.consultant >= 0 ? (fields[col.consultant] || '').trim() : '';
      const reason = col.reason >= 0 ? (fields[col.reason] || '').trim() : '';
      const phone = col.phone >= 0 ? (fields[col.phone] || '').trim() : '';
      const bookingStatus = (fields[col.lastIdx] || '').trim().toLowerCase();
      const recouped = bookingStatus === 'booked';

      const isDup = existing.some((p) => (mrNo && p.mrNo ? p.mrNo === mrNo : p.name.toLowerCase() === name.toLowerCase()));
      if (isDup) { perLocationDup[locKey] = (perLocationDup[locKey] || 0) + 1; totalDup++; continue; }

      toCreate.push({ date, location: locKey, name, mrNo, consultant, reason, phone, note: '', recouped });
      perLocationNew[locKey] = (perLocationNew[locKey] || 0) + 1;
      totalNew++;
    }

    if (toCreate.length) {
      await base44.entities.Cancellation.bulkCreate(toCreate);
    }
    const logCreates = Object.keys(perLocationNew).map((locKey) => ({
      date,
      location: locKey,
      label: 'Imported ' + perLocationNew[locKey] + ' patient' + (perLocationNew[locKey] > 1 ? 's' : '') + ' from cancellations report',
      timestamp: new Date().toISOString(),
    }));
    if (logCreates.length) {
      await base44.entities.ActivityLog.bulkCreate(logCreates);
    }

    return Response.json({ totalNew, totalDup, totalUnmapped, perLocationNew, perLocationDup, unmapped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}