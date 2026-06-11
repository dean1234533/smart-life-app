import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold font-heading mb-1">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: 11 June 2026</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-2">1. Who we are</h2>
            <p>
              Smart Life App ("the App", "we", "us") is operated by Dean Burt. The App is a personal
              productivity and lifestyle tool available at smart-life-app.pages.dev. As data controller,
              we can be contacted at <a href="mailto:sean_bree@yahoo.com" className="text-accent underline">sean_bree@yahoo.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. What data we collect and why</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Data</th>
                  <th className="text-left py-2 pr-4 font-medium">Why</th>
                  <th className="text-left py-2 font-medium">Legal basis (UK GDPR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr><td className="py-2 pr-4">Email address, password hash</td><td className="py-2 pr-4">Account authentication</td><td className="py-2">Contract (Art. 6(1)(b))</td></tr>
                <tr><td className="py-2 pr-4">Notes, tasks, calendar events, expenses, recordings, contacts, recipes, fitness data</td><td className="py-2 pr-4">Core app functionality</td><td className="py-2">Contract (Art. 6(1)(b))</td></tr>
                <tr><td className="py-2 pr-4">Device location (GPS, on-device only)</td><td className="py-2 pr-4">Weather on Home screen</td><td className="py-2">Consent (Art. 6(1)(a))</td></tr>
                <tr><td className="py-2 pr-4">Booking page name &amp; calendar availability</td><td className="py-2 pr-4">Public booking link feature</td><td className="py-2">Contract (Art. 6(1)(b))</td></tr>
                <tr><td className="py-2 pr-4">AI conversation history (Gemini / local AI)</td><td className="py-2 pr-4">Contextual AI replies</td><td className="py-2">Contract (Art. 6(1)(b))</td></tr>
                <tr><td className="py-2 pr-4">WebRTC signalling data (temporary, &lt;1 hr TTL)</td><td className="py-2 pr-4">Screen mirroring handshake</td><td className="py-2">Legitimate interest (Art. 6(1)(f))</td></tr>
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Data storage and processors</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Firebase / Firestore</strong> (Google LLC) — primary database, hosted in the EU where possible. Google's DPA and SCCs apply.</li>
              <li><strong>Cloudflare Pages &amp; Workers</strong> (Cloudflare Inc.) — app hosting and backend Workers. Cloudflare DPA applies.</li>
              <li><strong>Google Gemini API</strong> (Google LLC) — AI processing when local AI is unavailable. Only the text you send is transmitted; see Google's Gemini API privacy terms.</li>
              <li><strong>Open-Meteo</strong> — weather data. No personal data is sent; only your approximate location coordinates.</li>
              <li><strong>Nominatim / OpenStreetMap Foundation</strong> — reverse geocoding. Only coordinates are sent.</li>
            </ul>
            <p className="mt-2">Your data is <strong>not sold</strong> to any third party.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. Cookies and local storage</h2>
            <p>
              The App uses browser <strong>localStorage</strong> to store settings (theme, AI preferences,
              TV device configuration) and Firebase offline cache. No third-party advertising or tracking
              cookies are set. The only cookie used is Firebase's authentication session cookie, which is
              strictly necessary.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Data retention</h2>
            <p>
              Your data is retained for as long as your account is active. If you delete your account
              (via Settings → Delete Account), all your Firestore data and Firebase Auth account are
              permanently erased within 30 days. Backups may retain data for up to 90 days after deletion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. Your rights (UK GDPR)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Access</strong> — request a copy of all data we hold about you.</li>
              <li><strong>Rectification</strong> — correct inaccurate data via the App or by contacting us.</li>
              <li><strong>Erasure (Art. 17)</strong> — delete your account and all associated data. Use Settings → Delete Account or email us.</li>
              <li><strong>Portability (Art. 20)</strong> — export your data as JSON via Settings → Export My Data.</li>
              <li><strong>Objection / Restriction</strong> — contact us to restrict processing.</li>
              <li><strong>Withdraw consent</strong> — revoke location permission at any time in your device settings.</li>
            </ul>
            <p className="mt-2">
              To exercise any right, email <a href="mailto:sean_bree@yahoo.com" className="text-accent underline">sean_bree@yahoo.com</a>.
              We will respond within 30 days. You also have the right to lodge a complaint with the
              <strong> Information Commissioner's Office (ICO)</strong> at ico.org.uk.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. Children</h2>
            <p>
              The App is not directed at children under 13. We do not knowingly collect personal data
              from anyone under 13. If you believe a child has provided us with personal data, please
              contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. Changes to this policy</h2>
            <p>
              We may update this policy. Material changes will be notified by updating the "Last updated"
              date above and, where appropriate, via an in-app notice. Continued use of the App after
              changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">9. Contact</h2>
            <p>
              For any privacy queries: <a href="mailto:sean_bree@yahoo.com" className="text-accent underline">sean_bree@yahoo.com</a>
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link to="/terms" className="hover:text-foreground">Terms of Service</Link>
          <Link to="/settings" className="hover:text-foreground">Settings</Link>
        </div>
      </div>
    </div>
  );
}
