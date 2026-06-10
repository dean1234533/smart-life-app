import { invokeGemini } from '@/services/geminiService';
import { calendarEventsService } from '@/lib/firestoreService';

export async function extractAndSaveCalendarEvents(text, sourceType, sourceId, uid = '', userApiKey = '') {
  if (!text?.trim()) return [];

  const today = new Date().toISOString().split("T")[0];

  const prompt = `Today's date is ${today}. Analyze the following text and extract any meetings, appointments, events, or deadlines that have a specific date/time mentioned.

Text: "${text}"

For each event found, determine:
- The event title/description
- The exact date and time (convert relative expressions like "today", "tomorrow", "next Monday", "at noon" to absolute ISO datetime using today as ${today})
- Duration in minutes (default 60 if not mentioned)
- Who is involved (attendees)
- Location if mentioned
- A reminder time in minutes before the event (default 30)

Only extract events with a clear date/time reference. Ignore vague future references with no time.`;

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
