// Thèmes visuels : chaque œuvre en choisit un (ou il est deviné à partir de son univers).
export type ThemeId = 'classique' | 'postapo' | 'fantasy' | 'darkfantasy' | 'scifi' | 'cyberpunk' | 'horreur' | 'romance' | 'steampunk' | 'noir';

export interface Theme {
  id: ThemeId;
  name: string;
  tagline: string;
  /** Familles Google Fonts (paramètre family=) à charger. */
  fonts: string[];
  /** Polices à attendre avant de mettre le livre en page. */
  faces: string[];
  /** Multiplicateur de taille du texte du livre (certaines polices sont plus larges). */
  textScale: number;
  /** Couvertures générées : [fond, fond sombre, couleur des titres] */
  palettes: [string, string, string][];
  motifs: string[];
  /** Aperçu dans le sélecteur : [fond, papier, accent] */
  swatch: [string, string, string];
  keywords: RegExp;
}

const CLASSIC_FACES = ['400 16px "EB Garamond"', 'italic 400 16px "EB Garamond"', '600 16px "EB Garamond"', '600 16px "Cormorant Garamond"', 'italic 600 16px "Cormorant Garamond"', '400 16px "Cinzel"', '600 16px "Cinzel"', '700 16px "Cinzel"'];

export const THEMES: Theme[] = [
  {
    id: 'classique', name: 'Classique', tagline: 'Reliure cuir et papier crème',
    fonts: [], faces: [], textScale: 1,
    palettes: [['#5b1d1d', '#2a0c0c', '#d9b26a'], ['#1f3a3a', '#0c1d1d', '#d8c08a'], ['#22304f', '#0e1529', '#e0c27c'], ['#3c2a4d', '#1b1124', '#e3c48b'], ['#2f3d22', '#141c0d', '#d6bd7a'], ['#4a3320', '#1f140a', '#e6c88f']],
    motifs: ['✦', '❧', '✷', '❖', '☙', '✺'], swatch: ['#241a14', '#f6efe0', '#d6ae62'], keywords: /^$/,
  },
  {
    id: 'postapo', name: 'Post-apocalyptique', tagline: 'Rapports tapés à la machine, rouille et radiations',
    fonts: ['Special+Elite', 'Courier+Prime:ital,wght@0,400;0,700;1,400;1,700', 'Black+Ops+One'],
    faces: ['16px "Special Elite"', '400 16px "Courier Prime"', 'italic 400 16px "Courier Prime"', '700 16px "Courier Prime"', 'italic 700 16px "Courier Prime"', '16px "Black Ops One"'],
    textScale: 0.9,
    palettes: [['#4b4a2a', '#1d1c0e', '#f2c230'], ['#5a3a22', '#21140a', '#f0b43a'], ['#3d4636', '#161a12', '#e8d36a'], ['#58412b', '#1e150c', '#e9c46a']],
    motifs: ['☢', '⚠', '☣', '✇'], swatch: ['#1d1e15', '#e6dcbc', '#f2c230'],
    keywords: /fallout|post[- ]?apo|apocalyp|wasteland|metro ?20|stalker|last of us|mad ?max|walking dead|day ?z|rage|borderlands|frostpunk|nucl[ée]aire|zombie/i,
  },
  {
    id: 'fantasy', name: 'Fantasy', tagline: 'Parchemin enluminé, or et forêts anciennes',
    fonts: ['Cinzel+Decorative:wght@400;700', 'IM+Fell+English:ital@0;1', 'Alegreya:ital,wght@0,400;0,500;0,700;1,400'],
    faces: ['400 16px "Cinzel Decorative"', '700 16px "Cinzel Decorative"', '16px "IM Fell English"', 'italic 16px "IM Fell English"', '400 16px "Alegreya"', 'italic 400 16px "Alegreya"', '700 16px "Alegreya"'],
    textScale: 1,
    palettes: [['#1f4a34', '#0b1f15', '#e8c66b'], ['#5b2a1a', '#24100a', '#f0cf7a'], ['#23395d', '#0d1830', '#e9cf8a'], ['#4d2f5e', '#1d1027', '#ecd08c']],
    motifs: ['⚜', '❦', '✠', '♔', '❧'], swatch: ['#14251b', '#f1e2bd', '#d4a93c'],
    keywords: /seigneur des anneaux|lotr|tolkien|hobbit|harry potter|poudlard|zelda|skyrim|elder scrolls|narnia|fantasy|fantastique|dragon age|baldur|donjons|d&d|dungeons|eragon|percy jackson|wakfu|dofus|final fantasy|kingdom hearts|genshin/i,
  },
  {
    id: 'darkfantasy', name: 'Dark fantasy', tagline: 'Grimoire noir, sang et lettres gothiques',
    fonts: ['Pirata+One', 'UnifrakturMaguntia'],
    faces: ['16px "Pirata One"', '16px "UnifrakturMaguntia"', '400 16px "EB Garamond"', 'italic 400 16px "EB Garamond"'],
    textScale: 1,
    palettes: [['#2a0b0e', '#080304', '#c9a46a'], ['#1b1b1f', '#050506', '#b51e2b'], ['#2b2420', '#0b0908', '#a88f62'], ['#1d1424', '#07040a', '#c23a3a']],
    motifs: ['✠', '†', '⚔', '☠', '⛧'], swatch: ['#0b0909', '#26211d', '#a3161f'],
    keywords: /dark ?fantasy|dark souls|elden ring|bloodborne|berserk|warhammer|game of thrones|tr[ôo]ne de fer|witcher|sorceleur|diablo|castlevania|vampire|sekiro|demon|d[ée]mon|lies of p/i,
  },
  {
    id: 'scifi', name: 'Science-fiction', tagline: 'Journal de bord, étoiles et interfaces',
    fonts: ['Orbitron:wght@500;700;800', 'Exo+2:ital,wght@0,400;0,500;0,600;1,400'],
    faces: ['500 16px "Orbitron"', '700 16px "Orbitron"', '800 16px "Orbitron"', '400 16px "Exo 2"', 'italic 400 16px "Exo 2"', '600 16px "Exo 2"'],
    textScale: 0.95,
    palettes: [['#0c1f3a', '#02060f', '#7fe3ff'], ['#1a1440', '#05030f', '#a9b8ff'], ['#0d2b2f', '#020a0b', '#6ff5d2'], ['#2a1430', '#090310', '#ffb36b']],
    motifs: ['✦', '◈', '⟡', '✧', '⌬'], swatch: ['#070d1c', '#eef3f8', '#36c5f0'],
    keywords: /star wars|star trek|mass effect|halo|dune|warframe|sci[- ]?fi|science[- ]fiction|stargate|expanse|starfield|no man'?s sky|alien|avatar|interstellar|destiny|doctor who|space|espace|stellaris|portal/i,
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', tagline: 'Néons, pluie acide et écrans fissurés',
    fonts: ['Audiowide', 'Chakra+Petch:ital,wght@0,400;0,600;1,400', 'Share+Tech+Mono'],
    faces: ['16px "Audiowide"', '400 16px "Chakra Petch"', 'italic 400 16px "Chakra Petch"', '600 16px "Chakra Petch"', '16px "Share Tech Mono"'],
    textScale: 0.97,
    palettes: [['#1a0b2e', '#05010c', '#ff2a6d'], ['#071a2b', '#01060c', '#05d9e8'], ['#1e0f24', '#060208', '#f9f871'], ['#0b1b17', '#020705', '#39ff14']],
    motifs: ['◢', '⟁', '▲', '⌁', '◎'], swatch: ['#0b0614', '#120d1f', '#ff2a6d'],
    keywords: /cyberpunk|cyber|ghost in the shell|deus ex|blade runner|matrix|watch ?dogs|neuromancer|akira|edgerunners|shadowrun|detroit/i,
  },
  {
    id: 'horreur', name: 'Horreur', tagline: 'Pages tachées, griffures et murmures',
    fonts: ['Creepster', 'Crimson+Pro:ital,wght@0,400;0,600;1,400', 'Special+Elite'],
    faces: ['16px "Creepster"', '400 16px "Crimson Pro"', 'italic 400 16px "Crimson Pro"', '600 16px "Crimson Pro"', '16px "Special Elite"'],
    textScale: 1.03,
    palettes: [['#2a0606', '#080101', '#e8d9b8'], ['#14181a', '#030404', '#c11b1b'], ['#2c2a1c', '#0a0906', '#d8c8a0'], ['#1a0f14', '#050204', '#b31217']],
    motifs: ['☠', '✝', '⛧', '☽', '👁'], swatch: ['#0d0807', '#e2d6b5', '#9b0f0f'],
    keywords: /horreur|horror|resident evil|silent hill|lovecraft|cthulhu|stephen king|creepypasta|fnaf|five nights|outlast|amnesia|until dawn|scp|stranger things|it |dead space|evil within/i,
  },
  {
    id: 'romance', name: 'Romance', tagline: 'Papier rosé, calligraphie et fleurs séchées',
    fonts: ['Great+Vibes', 'Lora:ital,wght@0,400;0,500;0,600;1,400'],
    faces: ['16px "Great Vibes"', '400 16px "Lora"', 'italic 400 16px "Lora"', '600 16px "Lora"'],
    textScale: 0.97,
    palettes: [['#7a2e45', '#3a1020', '#f7d6c9'], ['#e7b7c0', '#b97a89', '#6b2238'], ['#3e2a4f', '#1a0f24', '#f3c7d3'], ['#8a4b5a', '#4a1f2b', '#fbe3d6']],
    motifs: ['❀', '♡', '❦', '✿', '❥'], swatch: ['#2b141c', '#fbf0ee', '#d9798f'],
    keywords: /romance|romantique|bridgerton|twilight|orgueil|pride|love|amour|fluff|otome|mariage|valentin/i,
  },
  {
    id: 'steampunk', name: 'Steampunk', tagline: 'Laiton, engrenages et vapeur',
    fonts: ['Rye', 'Libre+Baskerville:ital,wght@0,400;0,700;1,400', 'IM+Fell+English+SC'],
    faces: ['16px "Rye"', '400 16px "Libre Baskerville"', 'italic 400 16px "Libre Baskerville"', '700 16px "Libre Baskerville"', '16px "IM Fell English SC"'],
    textScale: 0.92,
    palettes: [['#4a2c17', '#1c0f06', '#e2b45f'], ['#2d3b36', '#0e1412', '#d39b4a'], ['#5a2a1c', '#200d07', '#f0c27a'], ['#3a2f25', '#14100c', '#c9944a']],
    motifs: ['⚙', '⛭', '✇', '❂', '⌘'], swatch: ['#1e140c', '#ecdcb8', '#c48a3a'],
    keywords: /steampunk|arcane|bioshock|dishonored|fullmetal|victorien|victorian|jules verne|sherlock holmes|professor layton|thief|machinarium/i,
  },
  {
    id: 'noir', name: 'Noir / Polar', tagline: 'Noir et blanc, fumée et trench-coat',
    fonts: ['Bebas+Neue', 'Playfair+Display:ital,wght@0,600;0,800;1,500', 'Libre+Caslon+Text:ital,wght@0,400;0,700;1,400'],
    faces: ['16px "Bebas Neue"', '600 16px "Playfair Display"', '800 16px "Playfair Display"', 'italic 500 16px "Playfair Display"', '400 16px "Libre Caslon Text"', 'italic 400 16px "Libre Caslon Text"', '700 16px "Libre Caslon Text"'],
    textScale: 0.94,
    palettes: [['#151515', '#000000', '#e8e2d4'], ['#2a2a2a', '#070707', '#d1242f'], ['#e9e4d8', '#9c968a', '#151515'], ['#1d1b18', '#050505', '#c9a227']],
    motifs: ['◆', '♠', '✕', '◉', '▲'], swatch: ['#0c0c0c', '#f1efe9', '#c4161c'],
    keywords: /noir|polar|d[ée]tective|sherlock|batman|gotham|mafia|l\.?a\.? noire|max payne|parrain|godfather|enqu[êe]te|crime|peaky blinders|gta/i,
  },
];

export const themeById = (id?: string | null): Theme => THEMES.find((t) => t.id === id) || THEMES[0];

/** Devine un thème à partir de l'univers, du titre et des tags. */
export function guessTheme(...parts: (string | string[] | undefined | null)[]): ThemeId {
  const text = parts.flat().filter(Boolean).join(' ');
  // Ordre : les thèmes les plus spécifiques d'abord.
  for (const id of ['cyberpunk', 'darkfantasy', 'postapo', 'horreur', 'steampunk', 'scifi', 'noir', 'romance', 'fantasy'] as ThemeId[]) {
    if (themeById(id).keywords.test(text)) return id;
  }
  return 'classique';
}

export function resolveTheme(w: { theme?: string; fandom?: string; title?: string; tags?: string[] }): ThemeId {
  return w.theme && THEMES.some((t) => t.id === w.theme) ? (w.theme as ThemeId) : guessTheme(w.fandom, w.title, w.tags);
}

const loaded = new Map<string, Promise<void>>();

/** Charge les polices d'un thème (une seule fois) et attend qu'elles soient prêtes. */
export function ensureThemeFonts(id: string): Promise<void> {
  const t = themeById(id);
  if (loaded.has(t.id)) return loaded.get(t.id)!;
  const p = (async () => {
    if (t.fonts.length) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?${t.fonts.map((f) => `family=${f}`).join('&')}&display=block`;
      await new Promise<void>((ok) => { link.onload = () => ok(); link.onerror = () => ok(); document.head.appendChild(link); });
    }
    const sample = 'Aaéèàçœ’«»—…ÉÀ0123';
    await Promise.all([...CLASSIC_FACES, ...t.faces].map((f) => document.fonts.load(f, sample).catch(() => [])));
    await document.fonts.ready;
  })();
  loaded.set(t.id, p);
  return p;
}

/** Applique le thème à toute la page tant que le composant est affiché. */
export function applyDocumentTheme(id: string) {
  document.documentElement.dataset.theme = id;
  ensureThemeFonts(id);
}

/** Les polices calligraphiées sont illisibles en MAJUSCULES : « FALLOUT: LAZARUS » → « Fallout: Lazarus ». */
export function themeTitle(title: string, theme: string): string {
  if (theme !== 'romance' || !/\p{L}/u.test(title) || title !== title.toUpperCase()) return title;
  return title.toLowerCase().replace(/(^|[\s\-'’:(«"])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
}
