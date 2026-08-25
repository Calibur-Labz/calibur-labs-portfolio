export type Service = {
  id: string
  icon: string
  title: string
  description: string
}

export type Project = {
  id: string
  title: string
  category: 'Web' | 'Mobile' | 'Design'
  image: string
  tags: string[]
  url?: string
}

export type TechItem = {
  name: string
  icon: string
}

export type Testimonial = {
  quote: string
  author: string
  title: string
  company: string
  avatar: string
  rating?: number
}

export const services: Service[] = [
  {
    id: 'web',
    icon: '⬡',
    title: 'Web Development',
    description: 'Scalable, performant web applications built with modern frameworks, from MVPs to enterprise grade platforms.',
  },
  {
    id: 'mobile',
    icon: '◈',
    title: 'Mobile Apps',
    description: 'Native and cross-platform iOS & Android apps that deliver seamless user experiences across devices.',
  },
  {
    id: 'design',
    icon: '◉',
    title: 'UI/UX Design',
    description: 'Research-driven design systems and interfaces that convert. Beautiful, functional, and accessible.',
  },
  {
    id: 'cloud',
    icon: '◬',
    title: 'Cloud & DevOps',
    description: 'Reliable cloud infrastructure, CI/CD pipelines, and deployment automation that keeps your product running smoothly.',
  },
  {
    id: 'ai',
    icon: '◎',
    title: 'AI Integration',
    description: 'Embed intelligent features into your product from LLM-powered workflows to custom ML model deployment.',
  },
  {
    id: 'business-systems',
    icon: '▦',
    title: 'CMS, ERP & POS Solutions',
    description: 'End-to-end business systems including CMS, ERP, and POS solutions that streamline content management, operations, inventory, sales, and financial workflows in one integrated ecosystem.',
  },
]

export const projects: Project[] = [
  {
    id: '1',
    title: 'Premo Heritage Villa',
    category: 'Web',
    image: '/images/premoCard.jpeg',
    tags: ['Booking System', 'Availability Calendar', 'Responsive Design'],
    url: 'https://premoheritage.com',
  },
  {
    id: '2',
    title: 'SBB Oxygen House',
    category: 'Web',
    image: '/images/projects/sbb.png',
    tags: ['Custom CMS', 'eCommerce Site', 'Online Product Ordering', 'Sales Analytics'],
    url: 'https://www.sbboxygen.com',
  },
  // {
  //   id: '2',
  //   title: 'Project Two',
  //   category: 'Mobile',
  //   image: '/images/projects/project-2.jpg',
  //   tags: ['Flutter', 'Firebase', 'Dart'],
  // },
  // {
  //   id: '3',
  //   title: 'Project Three',
  //   category: 'Design',
  //   image: '/images/projects/project-3.jpg',
  //   tags: ['Figma', 'Design System', 'Prototyping'],
  // },
  // {
  //   id: '4',
  //   title: 'Project Four',
  //   category: 'Web',
  //   image: '/images/projects/project-4.jpg',
  //   tags: ['React', 'Node.js', 'AWS'],
  // },
  // {
  //   id: '5',
  //   title: 'Project Five',
  //   category: 'Mobile',
  //   image: '/images/projects/project-5.jpg',
  //   tags: ['React Native', 'Stripe', 'MongoDB'],
  // },
  // {
  //   id: '6',
  //   title: 'Project Six',
  //   category: 'Web',
  //   image: '/images/projects/project-6.jpg',
  //   tags: ['Next.js', 'Tailwind', 'Supabase'],
  // },
]

export const techStack: TechItem[] = [
  { name: 'React', icon: '/icons/react.svg' },
  { name: 'Next.js', icon: '/icons/nextjs.svg' },
  { name: 'TypeScript', icon: '/icons/typescript.svg' },
  { name: 'Node.js', icon: '/icons/nodejs.svg' },
  { name: 'Python', icon: '/icons/python.svg' },
  { name: 'PostgreSQL', icon: '/icons/postgresql.svg' },
  { name: 'MongoDB', icon: '/icons/mongodb.svg' },
  { name: 'Docker', icon: '/icons/docker.svg' },
  { name: 'AWS', icon: '/icons/amazonaws.svg' },
  { name: 'Figma', icon: '/icons/figma.svg' },
  { name: 'Tailwind', icon: '/icons/tailwindcss.svg' },
  { name: 'Flutter', icon: '/icons/flutter.svg' },
  { name: 'Firebase', icon: '/icons/firebase.svg' },
  { name: 'Supabase', icon: '/icons/supabase.svg' },
]

export const testimonials: Testimonial[] = [
{
    quote:
      "xCalibur Labz played a key role in shaping our brand identity and improving our digital presence. Their team conducted in-depth research into our business model and provided valuable design ideas tailored to our needs. We also gained strong technical insights throughout the process, along with a smooth and professional experience. Their pricing was very reasonable considering the value delivered, which made it an easy decision to continue working with them.",
    author: 'Preminda Kalansooriya',
    title: 'Founder',
    company: 'Premo Heritage Villa',
    avatar: '/images/premo.png',
  },
  // {
  //   quote: "From design to deployment, the Calibur Labz team delivered beyond our expectations. Our app launch was the smoothest we've ever had.",
  //   author: 'Sarah Chen',
  //   title: 'Founder',
  //   company: 'Bloom Health',
  //   avatar: '/images/avatars/client-2.jpg',
  // },
  // {
  //   quote: "Working with Calibur Labz felt like having a world-class engineering team in-house. They understood our business goals and built accordingly.Working with Calibur Labz felt like having a world-class engineering team in-house. They understood our business goals and built accordingly.",
  //   author: 'Marcus Williams',
  //   title: 'Head of Product',
  //   company: 'Forge Analytics',
  //   avatar: '/images/avatars/client-3.jpg',
  // },
]

/* ── Products ──────────────────────────────────────────────────────────── */

/** The three tiers, in order. A tier includes every group at or below it. */
export const ORBI_TIERS = ['Core', 'Guide', 'Intelligence'] as const

export type OrbiTier = (typeof ORBI_TIERS)[number]

/** The tier each one builds on, or `undefined` for the entry tier. */
const TIER_BELOW: Record<OrbiTier, OrbiTier | undefined> = {
  Core: undefined,
  Guide: 'Core',
  Intelligence: 'Guide',
}

/** A themed group of ORBI capabilities, owned by the lowest tier that has it. */
export type ProductFeatureGroup = {
  id: string
  icon: string
  title: string
  description: string
  items: string[]
  tier: OrbiTier
}

/**
 * Every capability ORBI has, described exactly once.
 *
 * The pricing cards and ORBI's own knowledge base are both derived from this
 * list, so a tier can never advertise something the groups do not describe,
 * and the answer he gives about a package cannot drift from the card.
 */
export const orbiFeatureGroups: ProductFeatureGroup[] = [
  {
    id: 'presence',
    icon: '\u25c9',
    title: 'Presence',
    description: 'How he arrives and holds a room without taking it over.',
    tier: 'Core',
    items: [
      'Scripted entrance that introduces him once, then never again',
      'Idle flight, corner docking and a footer perch',
      'Cursor-aware gaze with priority-resolved eye targets',
      'Blinking, micro-expressions and small body language',
      'Environment docking \u2014 he moves off your buttons and forms',
    ],
  },
  {
    id: 'awareness',
    icon: '\u25c8',
    title: 'Page awareness',
    description: 'He reads the page the way a visitor does.',
    tier: 'Core',
    items: [
      'Per-section reactions driven by one shared scroll system',
      'Direction-aware glances and a startled beat on fast flicks',
      'Progress sense \u2014 a quiet aside at halfway, another at the end',
      'Cinematic moves that inspect your hero, work and diagrams',
    ],
  },
  {
    id: 'foundations',
    icon: '\u25a6',
    title: 'Foundations',
    description: 'What decides whether he is an asset or a liability.',
    tier: 'Core',
    items: [
      'Full reduced-motion path \u2014 every beat survives without travel',
      'Mobile behaviour tuned separately, not just scaled down',
      'No layout shift; he never sits in the document flow',
      'One animation loop, no polling, no extra observers',
      'Everything deterministic and covered by automated tests',
    ],
  },
  {
    id: 'guidance',
    icon: '\u25ac',
    title: 'Guidance',
    description: 'The part people actually use.',
    tier: 'Guide',
    items: [
      'Guide Mode menu listing every destination on the page',
      'Guided trips that scroll at a readable pace, cancellable any time',
      'Arrival beats handed to the destination section cleanly',
      'Contact-form companion: field focus, submit and a success sequence',
    ],
  },
  {
    id: 'personality',
    icon: '\u2b21',
    title: 'Personality',
    description: 'Why people poke him instead of closing the tab.',
    tier: 'Guide',
    items: [
      'Drowsiness, dozing, deep sleep, snoring and Z particles',
      'Wake, stretch and a startled flinch when someone returns',
      'Rare idle beats and curious glances on a randomized cadence',
      'Hidden reactions for visitors who go looking',
      'Sound design with a visitor-facing mute control',
    ],
  },
  {
    id: 'intelligence',
    icon: '\u25ce',
    title: 'Intelligence',
    description: 'He stops guessing what you meant and answers.',
    tier: 'Intelligence',
    items: [
      'Ask ORBI panel with streamed, plain-text answers',
      'Claude or Gemini, or bring your own API key',
      'Knowledge base built from your own pages and documents',
      'Action buttons that take the visitor where the answer points',
      'Tone, guardrails and refusal rules you control',
    ],
  },
]

/** Every group a tier includes — its own, and everything below it. */
export function groupsForTier(tier: OrbiTier): ProductFeatureGroup[] {
  const ceiling = ORBI_TIERS.indexOf(tier)
  return orbiFeatureGroups.filter(
    (group) => ORBI_TIERS.indexOf(group.tier) <= ceiling,
  )
}

/** The groups a tier adds on top of the one below it. */
function groupsAddedBy(tier: OrbiTier): ProductFeatureGroup[] {
  return orbiFeatureGroups.filter((group) => group.tier === tier)
}

/**
 * A licensable tier of ORBI. Prices are USD: a one-time build fee covering
 * integration and the brand pass, plus a monthly retainer covering hosting,
 * updates and support.
 *
 * `builds` and `features` are derived, never hand-written: `features` is what
 * this tier *adds*, which is what both the card's "plus:" line and ORBI's own
 * knowledge base want.
 */
export type ProductPackage = {
  id: string
  name: string
  tier: OrbiTier
  summary: string
  setupUsd: number
  monthlyUsd: number
  /** The tier this one builds on, absent for the entry tier. */
  builds?: OrbiTier
  /** The capabilities this tier adds over the one below it. */
  features: string[]
  popular?: boolean
}

const TIERS: {
  id: string
  name: string
  tier: OrbiTier
  summary: string
  setupUsd: number
  monthlyUsd: number
  popular?: boolean
}[] = [
  {
    id: 'core',
    name: 'ORBI Core',
    tier: 'Core',
    summary: 'He arrives, notices people, and reacts to the page.',
    setupUsd: 390,
    monthlyUsd: 19,
  },
  {
    id: 'guide',
    name: 'ORBI Guide',
    tier: 'Guide',
    summary: 'He stops being decoration and starts being useful.',
    setupUsd: 790,
    monthlyUsd: 49,
    popular: true,
  },
  {
    id: 'intelligence',
    name: 'ORBI Intelligence',
    tier: 'Intelligence',
    summary: 'He answers questions about your business.',
    setupUsd: 1290,
    monthlyUsd: 99,
  },
]

export const orbiPackages: ProductPackage[] = TIERS.map((tier) => ({
  ...tier,
  builds: TIER_BELOW[tier.tier],
  features: groupsAddedBy(tier.tier).flatMap((group) => group.items),
}))

/** A paid extra that sits outside the tiers. */
export type ProductAddOn = {
  name: string
  icon: string
  description: string
  priceUsd: number
  /** How it is charged, e.g. 'one-time', 'per language'. */
  unit: string
}

export const orbiAddOns: ProductAddOn[] = [
  {
    name: 'Custom character',
    icon: '\u25c8',
    description:
      'A mascot drawn from scratch for your brand instead of ORBI \u2014 same behaviour, your face on it.',
    priceUsd: 800,
    unit: 'one-time',
  },
  {
    name: 'Extra language',
    icon: '\u25c9',
    description:
      'Every line, prompt and answer localised and voice-checked by a native speaker.',
    priceUsd: 200,
    unit: 'per language',
  },
  {
    name: 'Voice pack',
    icon: '\u25ac',
    description:
      'Recorded audio cues and spoken replies in place of text, with the mute control wired up.',
    priceUsd: 300,
    unit: 'one-time',
  },
]

/**
 * Hard numbers about ORBI, shown beside the product shot. Facts about the code
 * in `components/orbi`, not a marketing round-up.
 */
export const orbiStats: { value: string; label: string }[] = [
  { value: '16', label: 'Build phases' },
  { value: '143', label: 'Tests passing' },
  { value: '60fps', label: 'Animation' },
  { value: '100%', label: 'Reduced-motion' },
]

/** What ORBI actually does, for the homepage overview. */
export const orbiHighlights: string[] = [
  'Notices the visitor, waves, and introduces himself once.',
  'Reacts to each section, then gets out of the way.',
  'Walks people anywhere on the page on request.',
  'Answers questions about your site in plain language.',
]

/** Questions people actually ask before buying him. */
export const orbiFaq: { question: string; answer: string }[] = [
  {
    question: 'Will he slow my site down?',
    answer:
      'No. ORBI is fixed-position, so he never causes layout shift, and he runs on one shared animation ticker with no polling intervals or extra scroll observers. On a slow connection he simply arrives later.',
  },
  {
    question: 'What happens on mobile?',
    answer:
      'He gets a quieter version deliberately \u2014 smaller, docked in the corner, with travel-heavy gestures traded for held poses. It is a separate behaviour path, not a scaled-down desktop one.',
  },
  {
    question: 'Is he accessible?',
    answer:
      'Every beat has a reduced-motion equivalent that keeps the expression and the words while dropping the movement. Answers are announced politely to screen readers, and sound is off until someone turns it on.',
  },
  {
    question: 'Can he look like our brand instead?',
    answer:
      'Every tier includes a colour and character pass. If you want a different mascot entirely, that is the custom character add-on.',
  },
  {
    question: 'Who pays for the AI?',
    answer:
      'The Intelligence retainer covers normal traffic on our key. If you would rather run it on your own Claude or Gemini key, you can, and the retainer drops accordingly.',
  },
  {
    question: 'How long does it take?',
    answer:
      'Core is usually a week. Guide is two to three. Intelligence depends mostly on how much of your content needs to go into the knowledge base.',
  },
]
