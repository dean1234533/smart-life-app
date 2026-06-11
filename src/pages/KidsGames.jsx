import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Shield } from 'lucide-react';

const CATEGORIES = ['All', 'Education', 'Reading', 'Coding', 'Creative', 'Science & Space'];

const GAMES = [
  // ── Education ──────────────────────────────────────────────────────────────
  {
    name: 'Khan Academy Kids',
    category: 'Education',
    ages: '2–8',
    desc: 'Maths, reading, social skills, and drawing — all in one app. Zero ads, zero cost, zero in-app purchases. Made by Khan Academy.',
    platforms: ['iOS', 'Android'],
    url: 'https://www.khanacademy.org/kids',
    color: 'bg-green-500/20',
    emoji: '🎓',
  },
  {
    name: 'PBS Kids Games',
    category: 'Education',
    ages: '2–8',
    desc: '50+ learning games with Curious George, Daniel Tiger, and Wild Kratts. Fully funded by public broadcasting — no ads ever.',
    platforms: ['iOS', 'Android', 'Web'],
    url: 'https://pbskids.org',
    color: 'bg-blue-500/20',
    emoji: '📺',
  },
  {
    name: 'Endless Alphabet',
    category: 'Education',
    ages: '3–6',
    desc: 'Silly monster characters teach vocabulary and spelling. Originator made the full app completely free in 2023.',
    platforms: ['iOS', 'Android'],
    url: 'https://www.originatorkids.com',
    color: 'bg-orange-500/20',
    emoji: '🔠',
  },
  {
    name: 'CBeebies Playtime Island',
    category: 'Education',
    ages: '2–6',
    desc: 'Games and activities featuring Bluey, Hey Duggee, and Bing. Made by the BBC — free with no ads or purchases.',
    platforms: ['iOS', 'Android'],
    url: 'https://www.bbc.co.uk/cbeebies',
    color: 'bg-purple-500/20',
    emoji: '🏝️',
  },
  {
    name: 'Lingokids',
    category: 'Education',
    ages: '2–8',
    desc: 'English learning through songs, games, and stories. Free tier gives access to core games with no ads.',
    platforms: ['iOS', 'Android'],
    url: 'https://lingokids.com',
    color: 'bg-yellow-500/20',
    emoji: '🌍',
  },

  // ── Reading ────────────────────────────────────────────────────────────────
  {
    name: 'Duolingo ABC',
    category: 'Reading',
    ages: '3–6',
    desc: 'Learn letters and phonics step by step. No ads, no in-app purchases — a completely free kids reading app from Duolingo.',
    platforms: ['iOS', 'Android'],
    url: 'https://www.duolingo.com/abc',
    color: 'bg-green-500/20',
    emoji: '🔤',
  },
  {
    name: 'Google Read Along',
    category: 'Reading',
    ages: '5–10',
    desc: 'Read books aloud with Diya the reading assistant — earns stars for correct reading. Free from Google, no ads.',
    platforms: ['Android'],
    url: 'https://readalong.google',
    color: 'bg-blue-500/20',
    emoji: '📖',
  },
  {
    name: 'Storyline Online',
    category: 'Reading',
    ages: '3–10',
    desc: 'Award-winning actors (including famous celebrities) read picture books aloud with animation. Completely free from the SAG-AFTRA Foundation.',
    platforms: ['iOS', 'Android', 'Web'],
    url: 'https://storylineonline.net',
    color: 'bg-pink-500/20',
    emoji: '📚',
  },
  {
    name: 'Starfall Learn to Read',
    category: 'Reading',
    ages: '4–8',
    desc: 'Phonics and early reading with interactive stories. The full learn-to-read programme is free on the website with no ads.',
    platforms: ['Web', 'iOS', 'Android'],
    url: 'https://www.starfall.com',
    color: 'bg-yellow-500/20',
    emoji: '⭐',
  },

  // ── Coding ─────────────────────────────────────────────────────────────────
  {
    name: 'ScratchJr',
    category: 'Coding',
    ages: '5–7',
    desc: 'Create interactive stories and games by snapping coding blocks together. Made by MIT Media Lab and Tufts University — completely free.',
    platforms: ['iOS', 'Android'],
    url: 'https://www.scratchjr.org',
    color: 'bg-orange-500/20',
    emoji: '🧩',
  },
  {
    name: 'Scratch',
    category: 'Coding',
    ages: '8–16',
    desc: 'Program your own games, stories, and animations — then share them with millions of other kids. Free from MIT, no ads.',
    platforms: ['Web', 'iOS'],
    url: 'https://scratch.mit.edu',
    color: 'bg-orange-500/20',
    emoji: '🐱',
  },
  {
    name: 'Code.org',
    category: 'Coding',
    ages: '6+',
    desc: 'Hour of Code activities with Minecraft, Star Wars, and Frozen — plus full programming courses. Free, no ads, no account needed.',
    platforms: ['Web', 'iOS', 'Android'],
    url: 'https://code.org',
    color: 'bg-blue-500/20',
    emoji: '💻',
  },
  {
    name: 'Blockly Games',
    category: 'Coding',
    ages: '8–14',
    desc: 'Puzzle games that teach programming concepts — from simple mazes to writing real code. Made by Google, web-based, no account needed.',
    platforms: ['Web'],
    url: 'https://blockly.games',
    color: 'bg-indigo-500/20',
    emoji: '🟦',
  },
  {
    name: 'Lightbot Hour of Code',
    category: 'Coding',
    ages: '4–8',
    desc: 'Guide a robot by programming its moves — teaches sequencing, loops, and functions through puzzles. Free Hour of Code edition.',
    platforms: ['Web', 'iOS', 'Android'],
    url: 'https://lightbot.com',
    color: 'bg-cyan-500/20',
    emoji: '🤖',
  },
  {
    name: 'Hopscotch',
    category: 'Coding',
    ages: '9–13',
    desc: 'Build games and apps on iPad using visual coding blocks. Free to play and create — no ads on the core experience.',
    platforms: ['iOS'],
    url: 'https://www.gethopscotch.com',
    color: 'bg-pink-500/20',
    emoji: '🏃',
  },

  // ── Creative ───────────────────────────────────────────────────────────────
  {
    name: 'Google Canvas',
    category: 'Creative',
    ages: '4+',
    desc: 'Simple, beautiful drawing app — just open your browser and draw. No sign-up, no ads, works offline.',
    platforms: ['Web'],
    url: 'https://canvas.apps.chrome',
    color: 'bg-red-500/20',
    emoji: '🎨',
  },
  {
    name: 'Make Music Day',
    category: 'Creative',
    ages: '5+',
    desc: 'Create music by tapping colourful instruments — no musical knowledge needed. Free, web-based, no ads.',
    platforms: ['Web'],
    url: 'https://makemusicday.org',
    color: 'bg-purple-500/20',
    emoji: '🎵',
  },
  {
    name: 'ABCya! (Free Games)',
    category: 'Creative',
    ages: '4–12',
    desc: 'Hundreds of educational games across grades. Many games are fully free on the website — filter by grade and subject.',
    platforms: ['Web'],
    url: 'https://www.abcya.com',
    color: 'bg-green-500/20',
    emoji: '🎮',
  },

  // ── Science & Space ────────────────────────────────────────────────────────
  {
    name: 'NASA Kids\' Club',
    category: 'Science & Space',
    ages: '6–12',
    desc: 'Space games, puzzles, and activities straight from NASA. 100% free, no account needed, no ads.',
    platforms: ['Web'],
    url: 'https://www.nasa.gov/learning-resources/for-kids-and-students/nasa-kids-club/',
    color: 'bg-blue-500/20',
    emoji: '🚀',
  },
  {
    name: 'Tinkercad',
    category: 'Science & Space',
    ages: '8+',
    desc: '3D design and basic coding from Autodesk. Free forever, web-based, no ads. Great for older kids who want to design real objects.',
    platforms: ['Web'],
    url: 'https://www.tinkercad.com',
    color: 'bg-orange-500/20',
    emoji: '🔧',
  },
  {
    name: 'National Geographic Kids',
    category: 'Science & Space',
    ages: '6–12',
    desc: 'Animal facts, quizzes, and activities from National Geographic. Free web content with no ads — learn about animals and nature.',
    platforms: ['Web'],
    url: 'https://kids.nationalgeographic.com',
    color: 'bg-yellow-500/20',
    emoji: '🦁',
  },
  {
    name: 'Smithsonian Learning Lab',
    category: 'Science & Space',
    ages: '8+',
    desc: 'Explore millions of artefacts, images, and interactive lessons from the Smithsonian museums. Completely free, no ads.',
    platforms: ['Web'],
    url: 'https://learninglab.si.edu',
    color: 'bg-amber-500/20',
    emoji: '🏛️',
  },
];

const PLATFORM_COLORS = {
  iOS: 'bg-blue-500/20 text-blue-400',
  Android: 'bg-green-500/20 text-green-400',
  Web: 'bg-muted text-muted-foreground',
};

export default function KidsGames() {
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = GAMES.filter(g => {
    const matchCat = activeCategory === 'All' || g.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch = !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q);
    return matchCat && matchSearch;
  });

  return (
    <div className="px-4 pt-12 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-display font-bold">Kids Games</h1>
          <p className="text-xs text-muted-foreground">100% free · 100% no ads · parent-verified</p>
        </div>
      </div>

      {/* Trust banner */}
      <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 mb-5">
        <Shield className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-300 leading-relaxed">
          Every game below is <strong>completely free to download and play</strong> with <strong>no advertisements</strong>. All come from established publishers (MIT, BBC, NASA, Google, Khan Academy, PBS). We recommend checking each app's current App Store listing before downloading.
        </p>
      </div>

      {/* Search */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search games..."
        className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/30 mb-4"
      />

      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-all ${
              activeCategory === cat
                ? 'bg-accent text-accent-foreground border-accent'
                : 'bg-card border-border/50 text-muted-foreground hover:text-foreground'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Count */}
      <p className="text-xs text-muted-foreground mb-4">{filtered.length} game{filtered.length !== 1 ? 's' : ''}</p>

      {/* Grid */}
      <div className="space-y-3">
        {filtered.map(game => (
          <a
            key={game.name}
            href={game.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-accent/30 transition-all active:scale-[0.98] group"
          >
            {/* Icon */}
            <div className={`w-12 h-12 rounded-xl ${game.color} flex items-center justify-center shrink-0 text-2xl`}>
              {game.emoji}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight">{game.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Ages {game.ages}</p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-colors shrink-0 mt-0.5" />
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed mb-2 line-clamp-2">{game.desc}</p>

              {/* Platforms */}
              <div className="flex flex-wrap gap-1">
                {game.platforms.map(p => (
                  <span key={p} className={`text-[10px] px-1.5 py-0.5 rounded-md ${PLATFORM_COLORS[p]}`}>{p}</span>
                ))}
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">No ads</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400">Free</span>
              </div>
            </div>
          </a>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">🎮</p>
            <p className="text-sm">No games match your search</p>
            <button onClick={() => { setSearch(''); setActiveCategory('All'); }} className="text-xs text-accent mt-1 hover:underline">
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="text-center text-[10px] text-muted-foreground mt-8 leading-relaxed px-4">
        App availability and free status may change. Always verify on the App Store or Google Play before downloading. We are not affiliated with any of these publishers.
      </p>
    </div>
  );
}
