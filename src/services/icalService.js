function fmt(isoString) {
  return new Date(isoString).toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
}

function esc(str) {
  return (str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

export function generateICS(events) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smart Life App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Smart Life',
    'X-WR-TIMEZONE:UTC',
  ];

  for (const ev of events) {
    if (!ev.event_date && !ev.date) continue;
    const start = ev.event_date || ev.date;
    const end = ev.end_date || new Date(new Date(start).getTime() + 60 * 60 * 1000).toISOString();
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.id}@smart-life-app.pages.dev`,
      `DTSTAMP:${fmt(new Date().toISOString())}`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${esc(ev.title)}`,
      ev.description ? `DESCRIPTION:${esc(ev.description)}` : null,
      ev.location ? `LOCATION:${esc(ev.location)}` : null,
      'END:VEVENT',
    ).filter(Boolean);
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(events, filename = 'smart-life.ics') {
  const content = generateICS(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openInAppleCalendar(event) {
  const content = generateICS([event]);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
