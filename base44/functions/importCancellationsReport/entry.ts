import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
    if (!fileUrl || !date) return Response.json({ error: 'Missing file_url or date' }, { status: 400 });

    const schema = {
      type: 'object',
      properties: {
        cancellations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              patient_name: { type: 'string' },
              mr_no: { type: 'string' },
              consultant: { type: 'string' },
              center_name: { type: 'string' },
              cancel_reason: { type: 'string' },
              phone: { type: 'string' },
              booking_status: { type: 'string' },
            },
          },
        },
      },
    };

    const extraction = await base44.asServiceRole.integrations.Core.ExtractDataFromUploadedFile({
      file_url: fileUrl,
      json_schema: schema,
    });

    let rows = [];
    if (extraction && extraction.status === 'success' && extraction.output) {
      const out = extraction.output;
      rows = Array.isArray(out) ? out : out.cancellations || [];
    } else {
      return Response.json({ error: (extraction && extraction.details) || 'Could not extract data from file' }, { status: 422 });
    }

    const existing = await base44.entities.Cancellation.filter({ date }, '-created_date', 2000);
    const perLocationNew = {};
    const perLocationDup = {};
    const unmapped = {};
    let totalNew = 0, totalDup = 0, totalUnmapped = 0;
    const toCreate = [];

    for (const row of rows) {
      const patientRaw = String(row.patient_name || '').trim();
      if (!patientRaw) continue;
      const centerRaw = String(row.center_name || '').trim();
      const locKey = CENTER_MAP[centerRaw.toLowerCase()];
      if (!locKey) {
        if (centerRaw) { unmapped[centerRaw] = (unmapped[centerRaw] || 0) + 1; totalUnmapped++; }
        continue;
      }
      const name = cleanName(patientRaw);
      if (!name) continue;
      const mrNo = String(row.mr_no || '').trim();
      const consultant = String(row.consultant || '').trim();
      const reason = String(row.cancel_reason || '').trim();
      const phone = String(row.phone || '').trim();
      const bookingStatus = String(row.booking_status || '').trim().toLowerCase();
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