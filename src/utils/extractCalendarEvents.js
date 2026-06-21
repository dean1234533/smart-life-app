import { invokeGemini } from '@/services/geminiService';
import { calendarEventsService } from '@/lib/firestoreService';

export async function extractAndSaveCalendarEvents(text, sourceType, sourceId, uid = '', userApiKey = '') {
  if (!text?.trim()) return [];

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const currentTime = now.toTimeString().slice(0, 5);

  const prompt = `Today is ${today} and the current time is ${currentTime}. Extract EVERY planned activity, appointment, errand, trip, or commitment from the text below that has ANY date or time reference — no matter how casual.

Text: "${text}"

Be generous: "tomorrow at 12", "meeting Tuesday", "going to the shops at noon", "dentist Friday", "pay Dave at 3", "drinks tonight", "call her in the morning" are ALL valid events. Do not skip anything with a time or date.

For each event:
- Write a clear short title (e.g. "Shopping trip", "Pay Dave", "Dentist appointment")
- Convert relative times to absolute ISO datetime: "tomorrow at 12" → ${new Date(now.getTime() + 86400000).toISOString().split("T")[0]}T12:00:00, "tonight at 7" → ${today}T19:00:00, "noon" → 12:00:00
- Duration in minutes (default 60)
- Attendees if mentioned
- Location if mentioned
- Reminder in minutes before (default 30)

If no date or time is mentioned at all, skip it.`;

  const schema = {
    type: "object",
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            event_date: { type: "string", description: "ISO 8601 datetime" },
            duration_minutes: { type: "number" },
            attendees: { type: "array", items: { type: "string" } },
            location: { type: "string" },
            reminder_minutes: { type: "number" }
          }
        }
      }
    }
  };

  let result;
  try {
    result = await invokeGemini(prompt, schema, uid, userApiKey);
  } catch {
    return [];
  }

  if (!result?.events?.length || !uid) return [];

  const created = [];
  for (const ev of result.events) {
    if (!ev.title || !ev.event_date) continue;
    const eventDate = new Date(ev.event_date);
    if (isNaN(eventDate)) continue;

    const endDate = new Date(eventDate.getTime() + (ev.duration_minutes || 60) * 60000);

    try {
      const saved = await calendarEventsService.create(uid, {
        title: ev.title,
        event_date: eventDate.toISOString(),
        end_date: endDate.toISOString(),
        attendees: ev.attendees || [],
        location: ev.location || "",
        reminder_minutes: ev.reminder_minutes || 30,
        source_type: sourceType,
        source_id: sourceId || "",
        status: "confirmed",
      });
      created.push(saved);
    } catch { /* skip failed events */ }
  }

  return created;
}
