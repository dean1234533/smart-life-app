import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar, CheckCircle2, Zap, Brain, BarChart3, Users,
  ArrowRight, Shield, Clock, Menu, X, Dumbbell
} from 'lucide-react';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://smart-life-calendar.deanburt1308.workers.dev';
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://smart-life-app.pages.dev';

const FEATURES = [
  {
    icon: Calendar,
    title: 'Smart Booking Links',
    description: 'Share a link with clients that shows only your genuinely free slots, synced live with Google Calendar. No double bookings, no back-and-forth.',
  },
  {
    icon: Brain,
    title: 'AI Smart Agent',
    description: 'Your own AI assistant that summarises your day, surfaces follow-ups, and helps you stay on top of notes, tasks, and client interactions.',
  },
  {
    icon: CheckCircle2,
    title: 'Tasks & Notes',
    description: 'Capture everything in one place. Tasks with reminders, rich notes with voice recording, and a timeline that keeps it all connected.',
  },
  {
    icon: Dumbbell,
    title: 'Fitness Tracking',
    description: 'Log workouts, track progress, and build programmes. Built by a PT, for PTs and anyone serious about their fitness.',
  },
  {
    icon: Users,
    title: 'Client Management',
    description: 'Follow-ups, contacts, and meeting summaries in one place. Always know where each client relationship stands.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Your data stays in your own account. No third-party sharing, no ads — just a clean tool that works entirely for you.',
  },
];

const PLANS = {
  monthly: [
    {
      id: 'monthly_starter',
      name: 'Starter',
      price: '£9',
      period: 'per month',
      description: 'For individuals getting organised',
      features: [
        'Notes, tasks & timeline',
        '1 booking link',
        'Google Calendar sync',
        'Fitness & expense tracking',
        'Works offline (PWA)',
      ],
      cta: 'Get Starter — £9/mo',
      popular: false,
    },
    {
      id: 'monthly_pro',
      name: 'Pro',
      price: '£19',
      period: 'per month',
      description: 'For professionals & personal trainers',
      features: [
        'Everything in Starter',
        'Unlimited booking links',
        'AI smart agent',
        'Voice recording & transcription',
        'Contacts, follow-ups & meetings',
        'Push notifications',
        'Priority support',
      ],
      cta: 'Get Pro — £19/mo',
      popular: true,
    },
  ],
  annual: [
    {
      id: 'annual_starter',
      name: 'Starter',
      price: '£89',
      period: 'per year',
      description: 'For individuals getting organised',
      features: [
        'Notes, tasks & timeline',
        '1 booking link',
        'Google Calendar sync',
        'Fitness & expense tracking',
        'Works offline (PWA)',
      ],
      cta: 'Get Starter — £89/yr',
      popular: false,
      saving: 'Save £19',
    },
    {
      id: 'annual_pro',
      name: 'Pro',
      price: '£179',
      period: 'per year',
      description: 'For professionals & personal trainers',
      features: [
        'Everything in Starter',
        'Unlimited booking links',
        'AI smart agent',
        'Voice recording & transcription',
        'Contacts, follow-ups & meetings',
        'Push notifications',
        'Priority support',
      ],
      cta: 'Get Pro — £179/yr',
      popular: true,
      saving: 'Save £49',
    },
  ],
};

const serif = "'IBM Plex Serif', 'Libre Baskerville', Georgia, serif";

export default function LandingPage() {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,700;1,400&display=swap';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const handleSelect = async (planId) => {
    setError('');
    setLoading(planId);
    try {
      const successUrl = `${APP_ORIGIN}/register?plan=${planId}&checkout=success`;
      const cancelUrl = `${APP_ORIGIN}/landing#pricing`;
      const resp = await fetch(`${WORKER_URL}/stripe/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, successUrl, cancelUrl }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start checkout');
      }
      const { url } = await resp.json();
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(null);
    }
  };

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', fontFamily: serif, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* ── NAV ──────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="https://dbworkouts.co.uk" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <span style={{ fontFamily: serif, fontWeight: 700, fontSize: 18, color: '#fff', letterSpacing: '0.01em' }}>DB's Workouts</span>
          </a>

          {/* Desktop */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }} className="landing-desktop-nav">
            <a href="#features" style={navLinkStyle}>Features</a>
            <a href="#pricing" style={navLinkStyle}>Pricing</a>
            <Link to="/login" style={navLinkStyle}>Sign in</Link>
            <a href="#pricing" style={btnRedStyle}>Get Started</a>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}
            className="landing-mobile-toggle"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {mobileOpen && (
          <div style={{ background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <a href="#features" style={navLinkStyle} onClick={() => setMobileOpen(false)}>Features</a>
            <a href="#pricing" style={navLinkStyle} onClick={() => setMobileOpen(false)}>Pricing</a>
            <Link to="/login" style={navLinkStyle} onClick={() => setMobileOpen(false)}>Sign in</Link>
            <a href="#pricing" style={{ ...btnRedStyle, textAlign: 'center' }} onClick={() => setMobileOpen(false)}>Get Started</a>
          </div>
        )}
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────── */}
      <section style={{ paddingTop: 140, paddingBottom: 100, paddingLeft: 20, paddingRight: 20, textAlign: 'center', position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 700px 350px at 50% 40%, rgba(179,0,24,0.12), transparent)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: '0.22em', color: '#b30018', textTransform: 'uppercase', marginBottom: 16 }}>
            Built for personal trainers & busy professionals
          </p>
          <h1 style={{ fontFamily: serif, fontSize: 'clamp(40px,6vw,60px)', fontWeight: 700, lineHeight: 1.1, marginBottom: 24 }}>
            Run your business.<br />
            <span style={{ color: '#b30018' }}>Own your time.</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px,2vw,20px)', color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, maxWidth: 580, margin: '0 auto 40px', fontWeight: 400 }}>
            Bookings, clients, tasks, AI assistant, fitness and more — one app that runs your PT business and personal life without the chaos.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <a href="#pricing" style={btnRedStyle}>
              Start today <ArrowRight size={16} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
            </a>
            <Link to="/login" style={btnOutlineStyle}>Sign in to your account</Link>
          </div>
          <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>
            {['Cancel anytime', 'Works offline', 'Google Calendar sync'].map(t => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                <CheckCircle2 size={14} style={{ color: '#b30018' }} /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" style={{ padding: '80px 20px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: '0.22em', color: '#b30018', textTransform: 'uppercase', marginBottom: 12 }}>What's included</p>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700 }}>Everything you need to stay ahead</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} style={{
                background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '28px 24px',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 6, background: 'rgba(179,0,24,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Icon size={20} color="#b30018" />
                </div>
                <h3 style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────── */}
      <section id="pricing" style={{ padding: '80px 20px', background: '#0a0a0a' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: '0.22em', color: '#b30018', textTransform: 'uppercase', marginBottom: 12 }}>Pricing</p>
            <h2 style={{ fontFamily: serif, fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, marginBottom: 8 }}>Simple, transparent pricing</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.45)', marginBottom: 32 }}>No hidden fees. Cancel anytime.</p>

            {/* Toggle */}
            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 4 }}>
              {['monthly', 'annual'].map(b => (
                <button key={b} onClick={() => setBilling(b)} style={{
                  background: billing === b ? 'rgba(255,255,255,0.1)' : 'none',
                  border: 'none', color: billing === b ? '#fff' : 'rgba(255,255,255,0.4)',
                  padding: '8px 20px', borderRadius: 4, cursor: 'pointer',
                  fontFamily: serif, fontSize: 14, fontWeight: 600, textTransform: 'capitalize',
                }}>
                  {b === 'annual' ? 'Annual  (save 20%)' : 'Monthly'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginBottom: 24, padding: '14px 20px', borderRadius: 6, border: '1px solid rgba(179,0,24,0.4)', background: 'rgba(179,0,24,0.1)', color: '#ff6b6b', textAlign: 'center', fontSize: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {PLANS[billing].map(plan => (
              <div key={plan.id} style={{
                position: 'relative', display: 'flex', flexDirection: 'column',
                background: plan.popular ? '#1a0305' : '#1a1a1a',
                border: `2px solid ${plan.popular ? '#b30018' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 8, padding: '32px 28px',
              }}>
                {plan.popular && (
                  <div style={{ position: 'absolute', top: -13, left: '50%', transform: 'translateX(-50%)', background: '#b30018', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '5px 14px', borderRadius: 3 }}>
                    Most popular
                  </div>
                )}
                {plan.saving && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(179,0,24,0.2)', color: '#b30018', border: '1px solid rgba(179,0,24,0.3)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 3 }}>
                    {plan.saving}
                  </div>
                )}
                <p style={{ fontFamily: serif, fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: 8 }}>{plan.name}</p>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontFamily: serif, fontSize: 48, fontWeight: 700, lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{plan.period}</span>
                </div>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginBottom: 24 }}>{plan.description}</p>
                <ul style={{ flex: 1, listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                      <CheckCircle2 size={15} style={{ color: '#b30018', flexShrink: 0, marginTop: 2 }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelect(plan.id)}
                  disabled={!!loading}
                  style={{
                    ...(plan.popular ? btnRedStyle : btnOutlineStyle),
                    width: '100%', textAlign: 'center', cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading && loading !== plan.id ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  {loading === plan.id ? (
                    <>
                      <span style={{ width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                      Redirecting…
                    </>
                  ) : plan.cta}
                </button>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,0.25)', marginTop: 24 }}>
            Secure payment via Stripe · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── CTA BANNER ───────────────────────────────────────────── */}
      <section style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto', borderTop: '3px solid #b30018', background: '#0d0d0d', padding: '60px 32px', borderRadius: 0 }}>
          <Clock size={36} color="#b30018" style={{ marginBottom: 16 }} />
          <h2 style={{ fontFamily: serif, fontSize: 'clamp(26px,4vw,36px)', fontWeight: 700, marginBottom: 16 }}>
            Stop managing your life in your head
          </h2>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
            One app for your bookings, clients, tasks, and fitness. Built for trainers who take their business seriously.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center' }}>
            <a href="#pricing" style={btnRedStyle}>
              Get started today <ArrowRight size={15} style={{ display: 'inline', verticalAlign: 'middle', marginLeft: 6 }} />
            </a>
            <Link to="/login" style={btnOutlineStyle}>Sign in</Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────── */}
      <footer style={{ background: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '40px 20px 24px', fontFamily: serif, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 24, marginBottom: 32 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 4 }}>DB's Workouts</p>
            <p style={{ margin: 0 }}>Outdoor PT · East London</p>
            <p style={{ margin: 0 }}>★★★★★ 5.0 · 69 Reviews</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: 0 }}>Pages</p>
            <a href="https://dbworkouts.co.uk" style={footerLinkStyle}>Home</a>
            <a href="https://dbworkouts.co.uk/pricing" style={footerLinkStyle}>Services & Pricing</a>
            <a href="https://dbworkouts.co.uk/contact" style={footerLinkStyle}>Contact</a>
            <Link to="/login" style={footerLinkStyle}>App Login</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', margin: 0 }}>Contact</p>
            <a href="https://wa.me/447752300937" target="_blank" rel="noopener" style={footerLinkStyle}>WhatsApp</a>
            <a href="mailto:dbs_workouts@yahoo.com" style={footerLinkStyle}>dbs_workouts@yahoo.com</a>
            <a href="https://www.instagram.com/dbs_workouts" target="_blank" rel="noopener" style={footerLinkStyle}>Instagram</a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 20, textAlign: 'center', fontSize: 12 }}>
          © 2026 DB's Workouts · Dean Burt ·{' '}
          <Link to="/privacy" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Privacy</Link> ·{' '}
          <Link to="/terms" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'underline' }}>Terms</Link>
        </div>
      </footer>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .landing-mobile-toggle { display: none !important; }
        @media (max-width: 768px) {
          .landing-desktop-nav { display: none !important; }
          .landing-mobile-toggle { display: block !important; }
        }
      `}</style>
    </div>
  );
}

const btnRedStyle = {
  display: 'inline-block', padding: '13px 26px',
  background: '#b30018', color: '#fff',
  border: '2px solid #b30018', borderRadius: 4,
  fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
  transition: 'background 0.2s ease',
};

const btnOutlineStyle = {
  display: 'inline-block', padding: '13px 26px',
  background: 'none', color: '#fff',
  border: '2px solid rgba(255,255,255,0.25)', borderRadius: 4,
  fontSize: 13, fontWeight: 700, letterSpacing: '0.1em',
  textTransform: 'uppercase', textDecoration: 'none', cursor: 'pointer',
};

const navLinkStyle = {
  fontSize: 14, color: 'rgba(255,255,255,0.6)',
  textDecoration: 'none', fontWeight: 500,
};

const footerLinkStyle = {
  color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 13,
};
