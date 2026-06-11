import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <h1 className="text-2xl font-bold font-heading mb-1">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: 11 June 2026</p>

        <div className="space-y-6 text-sm leading-relaxed">

          <section>
            <h2 className="text-base font-semibold mb-2">1. Acceptance</h2>
            <p>
              By creating an account or using Smart Life App ("the App"), you agree to these Terms.
              If you do not agree, do not use the App. The App is operated by Dean Burt
              ("we", "us"), contactable at <a href="mailto:sean_bree@yahoo.com" className="text-accent underline">sean_bree@yahoo.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">2. Eligibility</h2>
            <p>
              You must be at least 13 years old to use the App. By using the App, you confirm that
              you meet this requirement. Users in the UK or EU must be at least 16 to consent to
              data processing independently under UK GDPR / GDPR.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">3. Account</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must not share your account or use the App to impersonate others.</li>
              <li>You must provide accurate information when registering.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-1">
              <li>Use the App for any unlawful purpose or in violation of any regulations.</li>
              <li>Upload or transmit harmful, offensive, or illegal content.</li>
              <li>Attempt to reverse-engineer, scrape, or exploit the App's infrastructure.</li>
              <li>Use the screen-mirroring feature to capture or share content you do not have rights to.</li>
              <li>Misuse the file conversion feature to process copyright-protected material without permission.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">5. Third-party services</h2>
            <p>
              The App integrates with third-party services including Google Firebase, Google Gemini,
              Twilio, Resend, Open-Meteo, and others. Your use of those services is subject to their
              own terms and privacy policies. We are not responsible for the availability or conduct
              of third-party services.
            </p>
            <p className="mt-2">
              The music discovery section links to third-party platforms. We do not host or distribute
              any music. Availability, licensing, and free-tier terms of those platforms may change
              without notice — verify the current terms on each platform before use.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">6. AI features</h2>
            <p>
              AI-generated responses (via Gemini, Chrome AI, or Ollama) are provided for convenience
              and may be inaccurate. Do not rely on AI output for medical, legal, financial, or
              safety-critical decisions. You are responsible for any actions you take based on
              AI-generated content.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">7. File conversion</h2>
            <p>
              File conversion is performed locally in your browser or via open-source libraries.
              We do not store your converted files. You are solely responsible for ensuring you have
              the right to convert and use any files you process through the App.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">8. TV remote &amp; screen mirroring</h2>
            <p>
              The TV remote feature communicates with devices on your local network via a local
              proxy you run on your own machine. We have no access to your local network or devices.
              Screen mirroring uses peer-to-peer WebRTC — content is transmitted directly between
              devices and is not stored or processed by us.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">9. Intellectual property</h2>
            <p>
              The App and its original code, design, and branding are owned by Dean Burt.
              Content you create in the App (notes, recordings, etc.) remains yours. You grant us a
              limited licence to store and serve your content solely to provide the App's functionality.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">10. Availability and changes</h2>
            <p>
              The App is provided on an "as is" basis. We do not guarantee uninterrupted availability.
              We may modify, suspend, or discontinue features at any time. We will give reasonable
              notice where possible.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">11. Limitation of liability</h2>
            <p>
              To the maximum extent permitted by law, we are not liable for any indirect, incidental,
              or consequential damages arising from your use of the App, including loss of data.
              Our total liability for any claim is limited to £100 or the amount you paid us in the
              12 months preceding the claim, whichever is greater. Nothing in these Terms limits
              liability for death, personal injury, or fraud.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">12. Governing law</h2>
            <p>
              These Terms are governed by the laws of England and Wales. Any disputes will be subject
              to the exclusive jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">13. Changes to these Terms</h2>
            <p>
              We may update these Terms. We will update the "Last updated" date and, for material
              changes, provide at least 14 days notice via an in-app notice or email before changes
              take effect. Continued use after the effective date constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-2">14. Contact</h2>
            <p>
              Questions about these Terms: <a href="mailto:sean_bree@yahoo.com" className="text-accent underline">sean_bree@yahoo.com</a>
            </p>
          </section>

        </div>

        <div className="mt-10 pt-6 border-t border-border flex gap-4 text-xs text-muted-foreground">
          <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
          <Link to="/settings" className="hover:text-foreground">Settings</Link>
        </div>
      </div>
    </div>
  );
}
