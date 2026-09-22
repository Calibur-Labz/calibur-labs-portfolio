export type Service = {
  id: string
  icon: string
  title: string
  /** The one-liner on the homepage card. */
  description: string

  /*
   * Everything below exists so each service can be its own page at
   * `/services/<slug>`.
   *
   * The six services used to live only as anchors on the homepage, which meant
   * one URL competing for six different searches and winning none of them. A
   * page per service gives each one a title, a description, a canonical and its
   * own `Service` + `FAQPage` schema.
   *
   * Written here rather than in the route so the card, the page, the meta tags,
   * the sitemap and the JSON-LD all read from one array — a new service cannot
   * be added to the site and forgotten by the sitemap.
   */

  /** URL segment. Changing one breaks an indexed URL, so treat these as fixed. */
  slug: string
  /**
   * The `<title>`. The root layout appends " | xCalibur Labz", so this must not
   * repeat the brand. Kept under ~60 characters so Google does not truncate it.
   */
  metaTitle: string
  /** The `<meta name="description">`. ~150-160 characters. */
  metaDescription: string
  /** The page's single `<h1>`. Says the thing a person would search for. */
  h1: string
  /** The opening paragraph, directly under the h1. */
  intro: string
  /** Concrete deliverables. What the client actually receives. */
  whatYouGet: string[]
  /** How the work runs, start to finish. */
  process: { step: string; detail: string }[]
  /** Renders on the page AND generates the FAQPage schema. */
  faq: { q: string; a: string }[]
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
    slug: 'web-development',
    metaTitle: 'Web Application Development Sri Lanka',
    metaDescription:
      'We build custom web applications and business websites — booking systems, e-commerce, dashboards and internal tools. Based in Colombo, working with clients in Sri Lanka and Australia.',
    h1: 'Custom web application development',
    intro:
      'Most business problems that look like a website are really a web application: something has to be booked, ordered, tracked or approved, and a page of text cannot do it. We build the application underneath, and the site around it, so the two are one product rather than a brochure bolted to a form.',
    whatYouGet: [
      'A web application built on a modern framework — React and Next.js, typed end to end, server-rendered where it matters for speed and search.',
      'A database and API designed around how your business actually works, not a template bent into shape.',
      'An admin area your team can use without calling us: the content, the prices and the records are yours to change.',
      'Responsive layouts tested on real phones, because most of your visitors will never open the site on a desktop.',
      'Deployment, a domain, SSL and monitoring set up and handed over documented.',
    ],
    process: [
      { step: 'Scope', detail: 'We map what the application has to do before writing code — the screens, the records, the rules. You get a written scope and a fixed quote against it.' },
      { step: 'Design', detail: 'Interface first, in Figma, so you see and change the product while changing it is still cheap.' },
      { step: 'Build', detail: 'Short cycles with a live staging URL from week one. You watch it come together rather than waiting for a reveal.' },
      { step: 'Launch and support', detail: 'We deploy, monitor and stay reachable afterwards. Software that nobody maintains stops working.' },
    ],
    faq: [
      { q: 'How long does a web application take?', a: 'A focused first version is typically four to eight weeks. A booking platform or an e-commerce build with custom admin runs longer. We give you a written timeline with the quote, and we tell you if a date is unrealistic before you commit to it.' },
      { q: 'What does it cost?', a: 'It depends entirely on scope, so we do not publish a number that would be wrong for most projects. We scope first and quote a fixed price against that scope, so you are not signing a blank cheque.' },
      { q: 'Do you work with clients outside Sri Lanka?', a: 'Yes. We are based in Colombo and work with clients in Sri Lanka and Australia, remotely and on overlapping hours.' },
      { q: 'Do I own the code?', a: 'Yes. The repository, the domain and the hosting accounts are yours. We hand over credentials and documentation at launch — you are not locked into us to keep your own product running.' },
    ],
  },
  {
    id: 'mobile',
    icon: '◈',
    title: 'Mobile Apps',
    description: 'Native and cross-platform iOS & Android apps that deliver seamless user experiences across devices.',
    slug: 'mobile-app-development',
    metaTitle: 'iOS & Android App Development Sri Lanka',
    metaDescription:
      'Cross-platform and native mobile app development for iOS and Android — from first build to App Store and Google Play release. Sri Lanka and Australia.',
    h1: 'iOS and Android app development',
    intro:
      'An app is a bigger commitment than a website: it has to be released, reviewed, updated and supported on two platforms at once. We build cross-platform where that saves you money and native where it does not, and we are honest with you about which one your product actually needs.',
    whatYouGet: [
      'One codebase shipping to both iOS and Android where the product allows it, which roughly halves what a two-platform build costs.',
      'Native modules where cross-platform falls short — camera, payments, background location, offline storage.',
      'An API and backend designed for mobile: small payloads, offline tolerance, and sensible behaviour on a bad connection.',
      'Store submission handled — listings, screenshots, privacy declarations and the review process on both App Store and Google Play.',
      'Crash reporting and analytics wired in from the first release, so a bug reaches you before it reaches your reviews.',
    ],
    process: [
      { step: 'Decide the platform', detail: 'Cross-platform or native is a cost decision, not a taste one. We work it out against your feature list before quoting.' },
      { step: 'Design', detail: 'Screens designed to each platform’s conventions, so the app feels native rather than like a website in a frame.' },
      { step: 'Build and test', detail: 'Builds distributed to your devices throughout, via TestFlight and internal testing tracks. You use the app long before anyone else does.' },
      { step: 'Release', detail: 'We submit, handle review feedback and ship the updates after launch.' },
    ],
    faq: [
      { q: 'Cross-platform or native — which do I need?', a: 'Most business apps are well served by cross-platform: one codebase, both stores, substantially lower cost. Native earns its price when you depend heavily on device hardware or need the very best animation performance. We will tell you which one your feature list points to.' },
      { q: 'Can you publish under my developer account?', a: 'Yes, and we recommend it. Your company should own the App Store and Google Play listings, not your agency. We will walk you through setting the accounts up if you do not have them.' },
      { q: 'How long does store review take?', a: 'Google Play is usually a day or two. Apple is typically one to three days, but a first submission can take longer if the reviewer asks for changes. We build that into the timeline rather than promising a launch date we do not control.' },
    ],
  },
  {
    id: 'design',
    icon: '◉',
    title: 'UI/UX Design',
    description: 'Research-driven design systems and interfaces that convert. Beautiful, functional, and accessible.',
    slug: 'ui-ux-design',
    metaTitle: 'UI/UX Design Services Sri Lanka',
    metaDescription:
      'Interface and experience design for web and mobile products — user flows, design systems and accessible, high-converting screens, built to be handed straight to developers.',
    h1: 'UI/UX design for products people finish using',
    intro:
      'A good interface is not the one that looks best in a portfolio; it is the one where people get to the end of what they came to do. We design flows first and surfaces second, and because we build software too, what we hand over is buildable rather than a beautiful picture a developer has to argue with.',
    whatYouGet: [
      'User flows and wireframes for every path through the product, agreed before anything is styled.',
      'High-fidelity screens in Figma, responsive from phone to desktop, with real content rather than lorem ipsum.',
      'A design system — type scale, colour tokens, spacing, components — so the product stays consistent as it grows.',
      'Accessible contrast, focus states and tap targets checked against WCAG, not added at the end.',
      'A developer handoff with specs and exportable assets, whether we build it or your team does.',
    ],
    process: [
      { step: 'Understand', detail: 'Who uses this, what they are trying to do, and where the current version loses them.' },
      { step: 'Structure', detail: 'Flows and wireframes. Cheap to change, and where most of the real decisions get made.' },
      { step: 'Design', detail: 'Visual design and a component library, reviewed with you at each pass.' },
      { step: 'Hand off', detail: 'Specs, tokens and assets in a form a developer can build from directly.' },
    ],
    faq: [
      { q: 'Can you design without building it?', a: 'Yes. Design is a standalone engagement and plenty of clients take the files to their own team. The handoff is built for that.' },
      { q: 'Do you redesign existing products?', a: 'Yes, and it is often the better spend. We start from where your current product loses people rather than restyling screens that already work.' },
      { q: 'Will I get the Figma file?', a: 'Yes — the working file, the components and the tokens, on your own Figma account.' },
    ],
  },
  {
    id: 'cloud',
    icon: '◬',
    title: 'Cloud & DevOps',
    description: 'Reliable cloud infrastructure, CI/CD pipelines, and deployment automation that keeps your product running smoothly.',
    slug: 'cloud-devops',
    metaTitle: 'Cloud, CI/CD & DevOps Services Sri Lanka',
    metaDescription:
      'Cloud hosting, deployment pipelines, backups and monitoring set up so releases are routine and your product stays up. AWS, Vercel and self-hosted VPS.',
    h1: 'Cloud infrastructure and deployment that stays boring',
    intro:
      'Infrastructure is working when nobody thinks about it. We set up hosting, automated deployments, backups and monitoring so releasing a change is a routine event rather than an evening of everyone watching a terminal — and so that when something does break, you find out before your customers tell you.',
    whatYouGet: [
      'Hosting chosen for your actual traffic and budget — managed platforms, AWS, or a plain VPS where that is genuinely cheaper.',
      'CI/CD pipelines: push to a branch, tests run, the deploy happens without anyone SSH-ing anywhere.',
      'A staging environment that matches production, so changes are seen before customers see them.',
      'Automated backups that have been restored at least once, because an untested backup is not a backup.',
      'Uptime monitoring and alerting, plus SSL and security headers configured properly.',
    ],
    process: [
      { step: 'Audit', detail: 'What you run now, what it costs, and where it will fail first.' },
      { step: 'Plan', detail: 'A target setup with the monthly cost written down before anything is migrated.' },
      { step: 'Migrate', detail: 'Moved in stages with a rollback at each one. Planned cutover, minimal downtime.' },
      { step: 'Hand over', detail: 'Documented runbooks and access, so your team can operate it without us.' },
    ],
    faq: [
      { q: 'Do I need AWS?', a: 'Often not. A managed platform or a single well-configured VPS runs most business applications for a fraction of the cost and the complexity. We size the infrastructure to your traffic, and we will say so when the cheaper option is the right one.' },
      { q: 'Can you take over infrastructure someone else built?', a: 'Yes. We start with an audit of what exists, document it, and fix the parts most likely to fail before changing anything else.' },
      { q: 'What happens if the site goes down at 2am?', a: 'Monitoring alerts us and you. What we commit to beyond that depends on the support arrangement we agree — we would rather set a response time we can actually meet than advertise one we cannot.' },
    ],
  },
  {
    id: 'ai',
    icon: '◎',
    title: 'AI Integration',
    description: 'Embed intelligent features into your product from LLM-powered workflows to custom ML model deployment.',
    slug: 'ai-integration',
    metaTitle: 'AI & LLM Integration Services Sri Lanka',
    metaDescription:
      'Practical AI features built into your product — assistants grounded in your own content, document extraction and workflow automation, with costs and limits made clear up front.',
    h1: 'AI features that earn their place in your product',
    intro:
      'Most products do not need an AI strategy; they need one or two places where a model removes real work. We build those — an assistant that answers from your own content, extraction that reads documents your staff currently retype, automation that drafts what a person then approves — and we tell you plainly where a model is the wrong tool.',
    whatYouGet: [
      'Assistants grounded in your own content, so answers come from your documentation rather than being invented.',
      'Document and form extraction that turns PDFs, invoices and scans into structured records.',
      'A running cost estimate before we build, and caching and limits in the design so a bill cannot run away.',
      'A human approval step wherever a wrong answer would be expensive.',
      'ORBI, our own site companion, if what you want is an assistant on your website — built, priced and supported as a product.',
    ],
    process: [
      { step: 'Find the case', detail: 'We look for the specific task worth automating. If nothing qualifies, we say so rather than inventing a feature.' },
      { step: 'Prototype', detail: 'A working version against your real data, so quality is judged on your content and not a demo.' },
      { step: 'Ground and constrain', detail: 'Retrieval over your sources, guardrails, and a fallback for when the model has no good answer.' },
      { step: 'Ship and watch', detail: 'Released with logging and cost monitoring, so accuracy and spend stay visible.' },
    ],
    faq: [
      { q: 'Will it make things up?', a: 'That is the risk worth taking seriously. We reduce it by grounding answers in your own content, constraining what the model is allowed to answer, and having it say it does not know rather than guess. Where a wrong answer would be costly, we keep a person in the loop by design.' },
      { q: 'What does it cost to run?', a: 'Model usage is billed per request, so the running cost depends on volume. We estimate it before building and design caching and limits in from the start, so you get a predictable monthly figure rather than a surprise.' },
      { q: 'Do you train custom models?', a: 'Rarely, because it is rarely the right answer. Retrieval over your own content usually beats fine-tuning for business use, at a fraction of the cost. When a custom model genuinely is warranted, we will tell you.' },
      { q: 'Is my data used to train anyone’s model?', a: 'Not by us, and we configure provider settings to opt out of training where that option exists. We will tell you exactly which provider processes your data before you commit.' },
    ],
  },
  {
    id: 'business-systems',
    icon: '▦',
    title: 'CMS, ERP & POS Solutions',
    description: 'End-to-end business systems including CMS, ERP, and POS solutions that streamline content management, operations, inventory, sales, and financial workflows in one integrated ecosystem.',
    slug: 'cms-erp-pos',
    metaTitle: 'Custom CMS, ERP & POS Systems Sri Lanka',
    metaDescription:
      'Custom content, inventory, point-of-sale and operations systems built around how your business actually runs — replacing the spreadsheets and off-the-shelf tools you have outgrown.',
    h1: 'CMS, ERP and POS systems built around your operation',
    intro:
      'Most growing businesses run on a spreadsheet, an off-the-shelf tool that nearly fits, and somebody who remembers how it all connects. We replace that with one system that matches how you already work — stock, sales, content and reporting in one place, instead of four places that disagree with each other.',
    whatYouGet: [
      'A content management system your team can actually use, without a developer needed to change a price or a page.',
      'Inventory and stock tracking that reconciles against sales rather than being counted twice.',
      'Point of sale that works at the counter and reports into the same system as everything else.',
      'Reporting built on your real numbers — sales, margin, movement — instead of exports stitched together by hand.',
      'Role-based access, so staff see what they need and not the payroll.',
    ],
    process: [
      { step: 'Map the operation', detail: 'We sit with how you work now, including the informal parts. Systems fail when they are designed for the process on paper.' },
      { step: 'Design the data', detail: 'Products, stock, orders and customers modelled properly up front — this is what everything else depends on.' },
      { step: 'Build in stages', detail: 'The most painful part first, live and in use, before the rest is built around it.' },
      { step: 'Migrate and train', detail: 'Existing data brought across and checked, and your staff trained on the system before you depend on it.' },
    ],
    faq: [
      { q: 'Why not use an off-the-shelf ERP?', a: 'If one fits, use it — we will say so. Custom earns its cost when your operation does something the packaged tools do not model, or when licence fees per user per month outgrow the build over a few years.' },
      { q: 'Can you migrate our existing data?', a: 'Yes. Spreadsheets, an old system’s database, or an export — we map it, import it and reconcile the result against your own records before go-live.' },
      { q: 'Does the POS work without internet?', a: 'It can be built to. Offline-capable point of sale that queues transactions and syncs when the connection returns costs more to build, so we scope it as a deliberate decision rather than an assumption.' },
      { q: 'Have you built this before?', a: 'Yes — SBB Oxygen House runs on a custom CMS with online ordering and sales analytics that we built and continue to support.' },
    ],
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
    image: '/images/projects/sbboxygenn.png',
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

/**
 * Real client testimonials. Only clients who have given us a quote on the
 * record appear here.
 *
 * This array used to hold six: three testimonials duplicated verbatim to fill
 * the carousel rail, two of which named clients and companies that do not
 * appear anywhere else on the site and pointed at avatar files that were never
 * committed. A studio founded this year with three projects listed cannot also
 * have a testimonial from a head of product at a company it has not worked
 * with, and the gap between those two claims is exactly what a prospective
 * client checks.
 *
 * Add to this as clients give quotes. Do not pad it — the carousel handles a
 * short list, and one quote that can be verified is worth more than five that
 * cannot.
 */
export const testimonials: Testimonial[] = [
  {
    quote:
      'xCalibur Labz strengthened our brand identity and digital presence with thoughtful design and valuable technical insights tailored to our unique business needs. Their professionalism and fair pricing made continuing with them an easy choice.',
    author: 'Preminda Kalansooriya',
    title: 'Founder',
    company: 'Premo Heritage Villa',
    avatar: '/images/premo.png',
  },
  {
    quote:
      'xCalibur Labz designed our project quickly and in a very attractive and professional manner. Not only did they build the website for us, but even after two months, whenever we need to make any changes or updates, they take action promptly and provide us with excellent support. Thank you very much, xCalibur Labz, for your great work and continued support!',
    author: 'Binool Ekanayake',
    title: 'CEO',
    company: 'SBB Industrial Trading',
    avatar: '/images/projects/feedbacks/binool.png',
  },
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
 * A published reduction on a tier's price.
 *
 * The list figures stay where they are — a discount never overwrites
 * `setupUsd` or `monthlyUsd`, because the card prints the old price struck
 * through beside the new one, and a "was" figure the site holds nowhere else
 * is a number nobody can check. Either field may be left out: an offer on the
 * build fee alone is the common case, and the fee it says nothing about is
 * charged at list.
 *
 * `label` is what the offer is called, on the card and in ORBI's answers. He
 * is forbidden from inventing an offer, so this is the only way one can ever
 * reach a visitor through him.
 */
export type PackageDiscount = {
  /** What the offer is called, e.g. 'Launch offer'. */
  label: string
  /** The one-time fee actually charged. Absent means the list fee stands. */
  setupUsd?: number
  /** The monthly fee actually charged. Absent means the list fee stands. */
  monthlyUsd?: number
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
  /** The list one-time fee, before any discount. */
  setupUsd: number
  /** The list monthly fee, before any discount. */
  monthlyUsd: number
  /** The offer currently running on this tier, if there is one. */
  discount?: PackageDiscount
  /** The tier this one builds on, absent for the entry tier. */
  builds?: OrbiTier
  /** The capabilities this tier adds over the one below it. */
  features: string[]
  popular?: boolean
}

/** The one-time fee a visitor pays today — the offer price while one runs. */
export function setupPriceUsd(pkg: ProductPackage): number {
  return pkg.discount?.setupUsd ?? pkg.setupUsd
}

/** The monthly fee a visitor pays today — the offer price while one runs. */
export function monthlyPriceUsd(pkg: ProductPackage): number {
  return pkg.discount?.monthlyUsd ?? pkg.monthlyUsd
}

const TIERS: {
  id: string
  name: string
  tier: OrbiTier
  summary: string
  setupUsd: number
  monthlyUsd: number
  discount?: PackageDiscount
  popular?: boolean
}[] = [
  {
    id: 'core',
    name: 'ORBI Core',
    tier: 'Core',
    summary: 'He arrives, notices people, and reacts to the page.',
    setupUsd: 490,
    monthlyUsd: 29,
    discount: { label: 'Launch offer', setupUsd: 190, monthlyUsd: 10 },
  },
  {
    id: 'guide',
    name: 'ORBI Guide',
    tier: 'Guide',
    summary: 'He stops being decoration and starts being useful.',
    setupUsd: 790,
    monthlyUsd: 49,
    discount: { label: 'Launch offer', setupUsd: 290, monthlyUsd: 20 },
    popular: true,
  },
  {
    id: 'intelligence',
    name: 'ORBI Intelligence',
    tier: 'Intelligence',
    summary: 'He answers questions about your business.',
    setupUsd: 1290,
    monthlyUsd: 99,
    discount: { label: 'Launch offer', setupUsd: 490, monthlyUsd: 40 },
  },
]

/**
 * Reject a "discount" that is not one.
 *
 * An offer price at or above the list price would print a struck-through
 * figure next to an identical or smaller number — a fake saving, which is the
 * one thing a price on a page must never be. This module is imported by every
 * page that shows a price, so a typo here stops the build rather than shipping.
 */
function assertRealDiscount(
  name: string,
  field: 'setupUsd' | 'monthlyUsd',
  list: number,
  offer: number | undefined,
): void {
  if (offer === undefined) return
  if (!Number.isFinite(offer) || offer <= 0 || offer >= list) {
    throw new Error(
      `${name}: discounted ${field} of ${offer} must be above 0 and below the list price of ${list}`,
    )
  }
}

export const orbiPackages: ProductPackage[] = TIERS.map((tier) => {
  assertRealDiscount(tier.name, 'setupUsd', tier.setupUsd, tier.discount?.setupUsd)
  assertRealDiscount(tier.name, 'monthlyUsd', tier.monthlyUsd, tier.discount?.monthlyUsd)
  return {
    ...tier,
    builds: TIER_BELOW[tier.tier],
    features: groupsAddedBy(tier.tier).flatMap((group) => group.items),
  }
})

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
  /*
   * Every distinct face ORBI can wear: normal, happy, blink, thinking,
   * surprised, sleepy, dizzy, wink, concerned, curious, excited, shy and
   * unsure. Counted from the `OrbiExpression` union in `orbiConfig.ts` — if
   * a face is ever added or removed, this number is wrong and the union is
   * the place to check.
   *
   * Replaced "16 Build phases", which measured how the work was scheduled
   * rather than anything the visitor gets. Nobody buying a companion cares
   * how many sprints it took.
   */
  { value: '13', label: 'Expressions' },
  { value: '208', label: 'Tests passing' },
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
