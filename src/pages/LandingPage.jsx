import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Calendar, CheckCircle2, Zap, Brain, BarChart3, Users,
  ArrowRight, Sparkles, Shield, Clock, Menu, X
} from 'lucide-react';

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://smart-life-calendar.deanburt1308.workers.dev';
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://smart-life-app.pages.dev';

const FEATURES = [
  {
    icon: Brain,
    title: 'AI-Powered Intelligence',
    description: 'Smart agent learns your patterns, summarises your day, and surfaces what matters — notes, follow-ups, and priorities automatically surfaced.',
  },
  {
    icon: Calendar,
    title: 'Booking & Availability',
    description: 'Share booking links with clients that show only your genuinely free slots, synced live with your Google Calendar. No double bookings, ever.',
  },
  {
    icon: CheckCircle2,
    title: 'Tasks & Notes',
    description: 'Capture everything in one place. Tasks with reminders, rich notes with voice recording, and a timeline that connects it all.',
  },
  {
    icon: BarChart3,
    title: 'Fitness & Expenses',
    description: 'Track workouts, log expenses, manage shopping lists and recipes. Everything about your life, in one beautifully organised hub.',
  },
  {
    icon: Users,
    title: 'Client Management',
    description: 'Follow-ups, contacts, and meeting summaries — know exactly where each relationship stands without digging through email threads.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Your data lives in your own Firebase account. No third-party sharing, no ads — just a clean tool that works for you.',
  },
];

const PLANS = {
  monthly: [
    {
      id: 'monthly_starter',
      name: 'Starter',
      price: '£9',
      period: 'per month',
      description: 'Perfect for individuals getting organised',
      features: [
        'Notes, tasks & timeline',
        '1 booking link',
        'Google Calendar sync',
        'Fitness & expense tracking',
        'PWA — works offline',
      ],
      cta: 'Start for £9/mo',
      popular: false,
    },
    {
      id: 'monthly_pro',
      name: 'Pro',
      price: '£19',
      period: 'per month',
      description: 'For professionals who want every feature',
      features: [
        'Everything in Starter',
        'Unlimited booking links',
        'AI smart agent',
        'Voice recording & transcription',
        'Contacts, follow-ups & meetings',
        'Push notifications',
        'Priority support',
      ],
      cta: 'Start for £19/mo',
      popular: true,
    },
  ],
  annual: [
    {
      id: 'annual_starter',
      name: 'Starter',
      price: '£89',
      period: 'per year',
      description: 'Perfect for individuals getting organised',
      features: [
        'Notes, tasks & timeline',
        '1 booking link',
        'Google Calendar sync',
        'Fitness & expense tracking',
        'PWA — works offline',
      ],
      cta: 'Start for £89/yr',
      popular: false,
      saving: 'Save £19',
    },
    {
      id: 'annual_pro',
      name: 'Pro',
      price: '£179',
      period: 'per year',
      description: 'For professionals who want every feature',
      features: [
        'Everything in Starter',
        'Unlimited booking links',
        'AI smart agent',
        'Voice recording & transcription',
        'Contacts, follow-ups & meetings',
        'Push notifications',
        'Priority support',
      ],
      cta: 'Start for £179/yr',
      popular: true,
      saving: 'Save £49',
    },
  ],
};

function NavBar({ mobileOpen, setMobileOpen }) {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 backdrop-blur-xl bg-[#0d1520]/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#33e6ff] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#0d1520]" />
          </div>
          <span className="font-bold text-lg text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            MindFlow
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</a>
          <Link
            to="/login"
            className="text-sm font-medium text-white/80 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <a
            href="#pricing"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#33e6ff] text-[#0d1520] hover:bg-[#5befff] transition-colors"
          >
            Get started
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden text-white/60 hover:text-white"
          onClick={() => setMobileOpen(o => !o)}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#0d1520] px-4 py-4 flex flex-col gap-4">
          <a href="#features" className="text-sm text-white/60" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#pricing" className="text-sm text-white/60" onClick={() => setMobileOpen(false)}>Pricing</a>
          <Link to="/login" className="text-sm text-white/80">Sign in</Link>
          <a
            href="#pricing"
            className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#33e6ff] text-[#0d1520] text-center"
            onClick={() => setMobileOpen(false)}
          >
            Get started
          </a>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-32 pb-24 px-4 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#33e6ff]/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#33e6ff]/30 bg-[#33e6ff]/10 text-[#33e6ff] text-xs font-medium mb-6">
          <Sparkles className="w-3 h-3" />
          AI-powered life management
        </div>

        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-white leading-tight mb-6"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Your life,{' '}
          <span className="text-[#33e6ff]">intelligently</span>
          <br />organised.
        </h1>

        <p className="text-lg text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
          Notes, tasks, calendar bookings, AI assistant, fitness, expenses — one beautifully
          designed app that works offline and keeps everything in sync.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#33e6ff] text-[#0d1520] font-semibold text-base hover:bg-[#5befff] transition-colors"
          >
            Get started
            <ArrowRight className="w-4 h-4" />
          </a>
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white text-base font-medium hover:bg-white/5 transition-colors"
          >
            Sign in to your account
          </Link>
        </div>

        <div className="mt-10 flex items-center justify-center gap-6 text-sm text-white/40">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#33e6ff]/60" /> No credit card to try
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#33e6ff]/60" /> Cancel anytime
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#33e6ff]/60" /> Works offline
          </span>
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Everything you need, nothing you don't
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Built for people who take their time seriously.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="group p-6 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-[#33e6ff]/20 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-[#33e6ff]/15 flex items-center justify-center mb-4 group-hover:bg-[#33e6ff]/25 transition-colors">
                <Icon className="w-5 h-5 text-[#33e6ff]" />
              </div>
              <h3 className="font-semibold text-white mb-2" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                {title}
              </h3>
              <p className="text-sm text-white/50 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan, onSelect, loading }) {
  return (
    <div
      className={`relative flex flex-col rounded-2xl border p-8 transition-all duration-300 ${
        plan.popular
          ? 'border-[#33e6ff]/40 bg-[#33e6ff]/6 ring-1 ring-[#33e6ff]/20'
          : 'border-white/10 bg-white/3 hover:border-white/20'
      }`}
    >
      {plan.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#33e6ff] text-[#0d1520]">
            Most popular
          </span>
        </div>
      )}

      {plan.saving && (
        <div className="absolute top-4 right-4">
          <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/20">
            {plan.saving}
          </span>
        </div>
      )}

      <div className="mb-6">
        <p className="text-sm font-medium text-white/50 mb-1">{plan.name}</p>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-4xl font-bold text-white" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            {plan.price}
          </span>
          <span className="text-white/40 text-sm mb-1">{plan.period}</span>
        </div>
        <p className="text-sm text-white/40">{plan.description}</p>
      </div>

      <ul className="flex-1 space-y-3 mb-8">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
            <CheckCircle2 className="w-4 h-4 text-[#33e6ff] flex-shrink-0 mt-0.5" />
            {f}
          </li>
        ))}
      </ul>

      <button
        onClick={() => onSelect(plan.id)}
        disabled={loading === plan.id}
        className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
          plan.popular
            ? 'bg-[#33e6ff] text-[#0d1520] hover:bg-[#5befff] disabled:opacity-70'
            : 'border border-white/20 text-white hover:bg-white/8 disabled:opacity-70'
        }`}
      >
        {loading === plan.id ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Redirecting…
          </span>
        ) : (
          plan.cta
        )}
      </button>
    </div>
  );
}

function PricingSection() {
  const [billing, setBilling] = useState('monthly');
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

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
    <section id="pricing" className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h2
            className="text-3xl sm:text-4xl font-bold text-white mb-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Simple, transparent pricing
          </h2>
          <p className="text-white/50 text-lg mb-8">Start free, upgrade when you're ready.</p>

          {/* Billing toggle */}
          <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'monthly'
                  ? 'bg-white/12 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === 'annual'
                  ? 'bg-white/12 text-white'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              Annual
              <span className="ml-1.5 text-xs text-green-400">Save up to 20%</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS[billing].map(plan => (
            <PricingCard key={plan.id} plan={plan} onSelect={handleSelect} loading={loading} />
          ))}
        </div>

        <p className="text-center text-sm text-white/30 mt-8">
          Secure payment via Stripe · Cancel anytime · No hidden fees
        </p>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto text-center">
        <div className="relative rounded-3xl border border-[#33e6ff]/20 bg-[#33e6ff]/5 p-12 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#33e6ff]/8 rounded-full blur-3xl" />
          </div>
          <div className="relative">
            <Clock className="w-10 h-10 text-[#33e6ff] mx-auto mb-4" />
            <h2
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Take back control of your time
            </h2>
            <p className="text-white/50 mb-8 max-w-lg mx-auto">
              Join people using MindFlow to stay on top of their work, their health, and their relationships.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#pricing"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#33e6ff] text-[#0d1520] font-semibold hover:bg-[#5befff] transition-colors"
              >
                Get started today
                <ArrowRight className="w-4 h-4" />
              </a>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-white/20 text-white font-medium hover:bg-white/5 transition-colors"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div
      className="min-h-screen text-white"
      style={{ backgroundColor: '#0d1520', fontFamily: "'Inter', sans-serif" }}
    >
      <NavBar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <CtaSection />

      <footer className="border-t border-white/8 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#33e6ff] flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-[#0d1520]" />
            </div>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif" }}>MindFlow</span>
          </div>
          <div className="flex items-center gap-6">
            <Link to="/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link to="/login" className="hover:text-white/60 transition-colors">Sign in</Link>
          </div>
          <span>© {new Date().getFullYear()} MindFlow</span>
        </div>
      </footer>
    </div>
  );
}
