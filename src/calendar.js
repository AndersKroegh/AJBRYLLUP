// Bygger "Tilføj til kalender"-links ud fra bryllupsdata.
// Tider behandles som "flydende" lokal tid (Europe/Copenhagen) for at undgå
// tidszone-fejl, uanset hvor gæsten åbner kalenderen.

const pad = (n) => String(n).padStart(2, '0');

// "2027-07-10T13:00:00" -> komponenter (uden tidszone-forskydning)
function parseEventDate(iso) {
  const m = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso || '');
  if (!m) return null;
  return {
    y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5],
  };
}

// Formatér et flydende tidsstempel som YYYYMMDDTHHMMSS
function floatStamp(ms) {
  const dt = new Date(ms);
  return (
    `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}` +
    `T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00`
  );
}

function icsEscape(s = '') {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

// Returnerer { title, location, start, end, googleUrl, ics } eller null.
export function buildCalendar(data, durationHours = 10) {
  const p = parseEventDate(data?.eventDate);
  if (!p) return null;

  // Byg som UTC for nem +timer-beregning, formatér derefter som flydende tid.
  const startMs = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  const endMs = startMs + durationHours * 3600 * 1000;
  const start = floatStamp(startMs);
  const end = floatStamp(endMs);

  const title = `${data.names} — Bryllup`;
  const location = [data.venueName, data.venueAddress].filter(Boolean).join(', ');
  const details = `Vi glæder os til at fejre dagen sammen med jer!`;

  const googleUrl =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${start}/${end}` +
    `&details=${encodeURIComponent(details)}` +
    `&location=${encodeURIComponent(location)}` +
    '&ctz=Europe/Copenhagen';

  const nowStamp = floatStamp(Date.now());
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AJ Bryllup//DA',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:aj-wedding-${start}@ajbryllup`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(location)}`,
    `DESCRIPTION:${icsEscape(details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  return { title, location, start, end, googleUrl, ics };
}

// Trigger download af en .ics-fil (Apple Kalender / Outlook).
export function downloadIcs(ics, filename = 'bryllup.ics') {
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
