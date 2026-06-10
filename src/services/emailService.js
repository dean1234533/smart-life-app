// Email service via Resend API (called from a Cloudflare Worker or Pages Function)
// Set VITE_RESEND_WORKER_URL to your Cloudflare Worker endpoint

const WORKER_URL = import.meta.env.VITE_RESEND_WORKER_URL || '/api/send-email';

export async function sendBookingConfirmation({ bookerName, bookerEmail, ownerEmail, slot, timezone, meetingTitle, duration }) {
  const slotDate = new Date(slot);
  const formatted = slotDate.toLocaleString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: timezone,
  });

  await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: bookerEmail,
      subject: `Booking Confirmed: ${meetingTitle}`,
      html: `
        <h2>Your booking is confirmed</h2>
        <p>Hi ${bookerName},</p>
        <p>Your meeting <strong>${meetingTitle}</strong> has been confirmed.</p>
        <p><strong>Date &amp; Time:</strong> ${formatted} (${timezone})</p>
        <p><strong>Duration:</strong> ${duration} minutes</p>
        <p>We look forward to speaking with you.</p>
      `,
    }),
  });

  // Also notify the calendar owner
  if (ownerEmail) {
    await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: ownerEmail,
        subject: `New booking: ${meetingTitle}`,
        html: `
          <h2>New booking received</h2>
          <p><strong>From:</strong> ${bookerName} (${bookerEmail})</p>
          <p><strong>Meeting:</strong> ${meetingTitle}</p>
          <p><strong>Date &amp; Time:</strong> ${formatted} (${timezone})</p>
        `,
      }),
    });
  }
}
