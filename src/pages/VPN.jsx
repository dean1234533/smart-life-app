import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, ChevronDown, ExternalLink, Lock, Info } from 'lucide-react';

const VPNS = [
  {
    id: 'warp',
    name: 'Cloudflare WARP',
    tagline: 'Unlimited · 300+ cities · Browser extension available',
    shortDesc: 'Powered by Cloudflare — one of the largest networks on the internet. WARP encrypts all your traffic and uses the ultra-fast 1.1.1.1 DNS. Completely free with no data cap.',
    trustReason: 'Cloudflare is a publicly listed company (NYSE: NET) with a transparent privacy policy. They publish annual transparency reports and have a strong business incentive NOT to sell data — their paying customers are businesses, not advertisers.',
    freeData: 'Unlimited',
    servers: '300+ cities worldwide',
    speed: 'Very fast (Cloudflare\'s own global network)',
    logs: 'No browsing logs. Aggregated performance metrics only.',
    openSource: true,
    platforms: ['iOS', 'Android', 'Windows', 'Mac', 'Linux', 'Browser Extension'],
    color: 'bg-orange-500/20',
    textColor: 'text-orange-400',
    emoji: '☁️',
    links: {
      ios: 'https://apps.apple.com/app/id1423538627',
      android: 'https://play.google.com/store/apps/details?id=com.cloudflare.onedotonedotonedotone',
      windows: 'https://1.1.1.1/WARP/clients/WARP/latest?platform=win',
      mac: 'https://1.1.1.1/WARP/clients/WARP/latest?platform=mac',
      chrome: 'https://chrome.google.com/webstore/detail/1111-with-warp/nenlahapcbofgnanklpelkaejcehkggg',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/1dot1dot1dot1/',
      website: 'https://one.one.one.one',
    },
    steps: [
      { title: 'Download the app', detail: 'Tap your platform button below. On mobile, search "1.1.1.1" in the App Store or Google Play.' },
      { title: 'Open the app', detail: 'You\'ll see a simple toggle button. No account needed for the free version.' },
      { title: 'Tap the toggle to connect', detail: 'The button turns orange when connected. All your traffic is now encrypted through Cloudflare.' },
      { title: 'Optional: enable WARP+', detail: 'WARP+ routes traffic through Cloudflare\'s Argo network for even faster speeds (paid). The free WARP is already excellent.' },
      { title: 'Browser extension (alternative)', detail: 'If you only want it for your browser, install the Chrome or Firefox extension — no app needed.' },
    ],
    note: 'WARP is technically a DNS + traffic encryption tool rather than a full VPN, so your IP may not always appear to change. It\'s best for encrypting public Wi-Fi and improving DNS privacy.',
  },
  {
    id: 'proton',
    name: 'ProtonVPN Free',
    tagline: 'Unlimited data · 3 server locations · Swiss privacy law',
    shortDesc: 'Made by the team behind ProtonMail. Based in Switzerland with some of the strongest privacy laws in the world. The free tier has unlimited bandwidth — just slower speeds and 3 locations.',
    trustReason: 'ProtonVPN is open source and has been independently audited by SEC Consult. They are a Swiss non-profit foundation with a legally enforceable no-logs policy. They have fought court orders and won. No VC investors or ad revenue — funded entirely by premium subscribers.',
    freeData: 'Unlimited',
    servers: '3 locations (USA, Netherlands, Japan) on free tier',
    speed: 'Good on free (limited during peak times)',
    logs: 'Strict no-logs — independently audited and legally enforced.',
    openSource: true,
    platforms: ['iOS', 'Android', 'Windows', 'Mac', 'Linux'],
    color: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    emoji: '🔐',
    links: {
      ios: 'https://apps.apple.com/app/id1437005085',
      android: 'https://play.google.com/store/apps/details?id=ch.protonvpn.android',
      windows: 'https://protonvpn.com/download-windows',
      mac: 'https://protonvpn.com/download-macos',
      linux: 'https://protonvpn.com/download-linux',
      website: 'https://protonvpn.com/free-vpn',
    },
    steps: [
      { title: 'Create a free Proton account', detail: 'Go to proton.me and sign up — it\'s free and also gives you an encrypted ProtonMail inbox. No payment required.' },
      { title: 'Download ProtonVPN', detail: 'Tap your platform button below. Search "ProtonVPN" in your app store.' },
      { title: 'Sign in with your Proton account', detail: 'Use the same email and password you created in step 1.' },
      { title: 'Select a free server', detail: 'Tap "Free" in the server list to see the 3 free locations. Tap any country to connect.' },
      { title: 'You\'re protected', detail: 'Your IP is now hidden and all traffic is encrypted with AES-256. Your internet provider cannot see what you\'re doing.' },
    ],
    note: 'The free tier only has 3 country locations. If you need more countries, Windscribe (below) has 10+ on its free tier.',
  },
  {
    id: 'windscribe',
    name: 'Windscribe Free',
    tagline: '10 GB/month · 10+ server locations · Browser extension',
    shortDesc: 'Canadian VPN with a generous free tier — 10 locations, browser extensions, and a built-in ad/tracker blocker. 10 GB per month free (15 GB if you confirm your email).',
    trustReason: 'Windscribe is open source, has published independent audit results, and runs a clear no-logs policy. They are a small independent company with no outside investors. The founder actively engages with the privacy community and has been open about how the service works.',
    freeData: '10 GB/month (15 GB with verified email)',
    servers: '10+ locations (US, UK, Canada, Germany, Netherlands, France, Switzerland, Hong Kong, Turkey, Romania)',
    speed: 'Good — shared with premium users on same infrastructure',
    logs: 'No logs policy. Audited.',
    openSource: true,
    platforms: ['iOS', 'Android', 'Windows', 'Mac', 'Linux', 'Browser Extension'],
    color: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    emoji: '💨',
    links: {
      ios: 'https://apps.apple.com/app/id1129435228',
      android: 'https://play.google.com/store/apps/details?id=re.windscribe.vpnapp',
      windows: 'https://windscribe.com/download',
      mac: 'https://windscribe.com/download',
      chrome: 'https://chrome.google.com/webstore/detail/windscribe-free-vpn-and-a/hnmpcagpplmpfojmgmnngilcnanddlhb',
      firefox: 'https://addons.mozilla.org/en-US/firefox/addon/windscribe/',
      website: 'https://windscribe.com/signup',
    },
    steps: [
      { title: 'Create a free account', detail: 'Go to windscribe.com/signup — no credit card or payment needed. Confirm your email to get 15 GB instead of 10 GB.' },
      { title: 'Download the app', detail: 'Tap your platform below. The browser extension works without the desktop app if you only need browser-level VPN.' },
      { title: 'Sign in', detail: 'Use the username and password from your Windscribe account.' },
      { title: 'Choose a server location', detail: 'In the app, expand the free server list. You have 10+ countries to choose from — pick the one closest to you for the best speed.' },
      { title: 'Enable ROBERT (optional)', detail: 'ROBERT is Windscribe\'s built-in ad and tracker blocker. Enable it in Settings for extra privacy.' },
    ],
    note: 'The 10 GB monthly limit is enough for general browsing and light streaming. For heavy use, ProtonVPN\'s unlimited free tier is a better choice.',
  },
  {
    id: 'psiphon',
    name: 'Psiphon',
    tagline: 'Unlimited · Thousands of servers · Anti-censorship focus',
    shortDesc: 'Open-source tool designed for people in countries with internet censorship (Iran, China, Russia etc.) but available to everyone. Uses a combination of VPN, SSH, and HTTP proxy to bypass restrictions.',
    trustReason: 'Psiphon is funded by the US State Department, the UK Foreign Office, and democracy organisations specifically because it helps people in censored countries access the free internet. Their incentive is the opposite of selling your data. It\'s open source and has been reviewed by academic and security researchers.',
    freeData: 'Unlimited',
    servers: 'Thousands of rotating servers globally',
    speed: 'Variable — can be slower during peak times',
    logs: 'Minimal aggregated stats (no individual user logs). Transparent privacy policy.',
    openSource: true,
    platforms: ['iOS', 'Android', 'Windows'],
    color: 'bg-green-500/20',
    textColor: 'text-green-400',
    emoji: '🛡️',
    links: {
      ios: 'https://apps.apple.com/app/id1276263909',
      android: 'https://play.google.com/store/apps/details?id=com.psiphon3',
      windows: 'https://psiphon.ca/en/download.html',
      website: 'https://psiphon.ca',
    },
    steps: [
      { title: 'Download the app', detail: 'No account needed at all. Just download and open — Psiphon is the simplest VPN to set up on this list.' },
      { title: 'Tap Connect', detail: 'Psiphon automatically finds the best available server for you. Connection is usually fast.' },
      { title: 'Select a region (optional)', detail: 'You can choose a specific country in Settings if you need a particular location.' },
      { title: 'That\'s it', detail: 'No sign-up, no account, no configuration. Psiphon is intentionally the simplest option for people who just need it to work.' },
    ],
    note: 'Best for bypassing geo-restrictions and censorship. For maximum privacy, ProtonVPN or Windscribe have stronger privacy guarantees. But for simplicity and anti-censorship, Psiphon is unmatched.',
  },
];

const PLATFORM_ICONS = {
  iOS: '🍎',
  Android: '🤖',
  Windows: '🪟',
  Mac: '💻',
  Linux: '🐧',
  'Browser Extension': '🌐',
};

function DownloadButton({ label, url }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-muted hover:bg-accent/10 hover:text-accent border border-border/50 transition-colors"
    >
      <ExternalLink className="w-3 h-3" />
      {label}
    </a>
  );
}

function VPNCard({ vpn }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-12 h-12 rounded-xl ${vpn.color} flex items-center justify-center text-2xl shrink-0`}>
            {vpn.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold">{vpn.name}</h2>
              {vpn.openSource && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">Open source</span>
              )}
            </div>
            <p className={`text-[11px] mt-0.5 ${vpn.textColor}`}>{vpn.tagline}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{vpn.shortDesc}</p>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Free data</p>
            <p className="text-xs font-medium">{vpn.freeData}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Servers</p>
            <p className="text-xs font-medium leading-tight">{vpn.servers.split(' (')[0]}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Logs</p>
            <p className="text-xs font-medium text-emerald-400 leading-tight">No logs</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Speed</p>
            <p className="text-xs font-medium leading-tight">{vpn.speed.split(' (')[0]}</p>
          </div>
        </div>

        {/* Download buttons */}
        <div className="flex flex-wrap gap-1.5">
          {vpn.links.ios && <DownloadButton label="iOS" url={vpn.links.ios} />}
          {vpn.links.android && <DownloadButton label="Android" url={vpn.links.android} />}
          {vpn.links.windows && <DownloadButton label="Windows" url={vpn.links.windows} />}
          {vpn.links.mac && <DownloadButton label="Mac" url={vpn.links.mac} />}
          {vpn.links.linux && <DownloadButton label="Linux" url={vpn.links.linux} />}
          {vpn.links.chrome && <DownloadButton label="Chrome ext" url={vpn.links.chrome} />}
          {vpn.links.firefox && <DownloadButton label="Firefox ext" url={vpn.links.firefox} />}
          <DownloadButton label="Website" url={vpn.links.website} />
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-border/50 hover:bg-muted/30 transition-colors text-xs text-muted-foreground"
      >
        <span>{expanded ? 'Hide' : 'Show'} setup guide &amp; why we trust it</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/30">

          {/* Why trust it */}
          <div className="mt-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <p className="text-xs font-medium text-emerald-400">Why we trust this VPN</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{vpn.trustReason}</p>
          </div>

          {/* Setup steps */}
          <div>
            <p className="text-xs font-medium mb-2">Setup guide</p>
            <div className="space-y-2">
              {vpn.steps.map((step, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-accent/20 text-accent text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-xs font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Note */}
          {vpn.note && (
            <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">{vpn.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function VPN() {
  const navigate = useNavigate();

  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold">Free VPN</h1>
          <p className="text-xs text-muted-foreground">Trusted · No data selling · No ads</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-3 mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-400 shrink-0" />
          <p className="text-xs font-medium text-blue-300">How we chose these VPNs</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Most "free" VPNs <strong>make money by selling your browsing data</strong> to advertisers. Every VPN on this page is open source, independently audited, and has a clear business model that doesn't involve selling your data. We've included setup guides and exactly why each one can be trusted.
        </p>
      </div>

      {/* Quick compare */}
      <div className="rounded-2xl bg-card border border-border/50 p-4 mb-5">
        <p className="text-xs font-medium mb-3">Quick comparison</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span className="text-muted-foreground w-32 shrink-0">Best overall free</span>
            <span className="font-medium">☁️ Cloudflare WARP — unlimited, no account</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span className="text-muted-foreground w-32 shrink-0">Most private</span>
            <span className="font-medium">🔐 ProtonVPN — Swiss law, audited, unlimited</span>
          </div>
          <div className="flex items-center justify-between py-1.5 border-b border-border/30">
            <span className="text-muted-foreground w-32 shrink-0">Most locations</span>
            <span className="font-medium">💨 Windscribe — 10+ countries on free tier</span>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground w-32 shrink-0">Simplest setup</span>
            <span className="font-medium">🛡️ Psiphon — no account, one tap</span>
          </div>
        </div>
      </div>

      {/* VPN cards */}
      <div className="space-y-4">
        {VPNS.map(vpn => (
          <VPNCard key={vpn.id} vpn={vpn} />
        ))}
      </div>

      {/* Warning about other "free" VPNs */}
      <div className="mt-6 rounded-2xl bg-destructive/5 border border-destructive/20 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs font-medium text-destructive">VPNs to avoid</p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong>Hola VPN</strong> — sells your bandwidth to third parties as a botnet. <strong>SuperVPN, TurboVPN, VPN Master</strong> — found to contain malware or sell logs. <strong>Betternet, HotSpot Shield (free)</strong> — inject ads into browsing. If a free VPN isn't on this page and isn't open source, be very cautious.
        </p>
      </div>

      <p className="text-center text-[10px] text-muted-foreground mt-8 leading-relaxed px-4">
        VPN app availability and free tiers may change. Always verify current terms on the official website. We are not affiliated with any of these services.
      </p>
    </div>
  );
}
