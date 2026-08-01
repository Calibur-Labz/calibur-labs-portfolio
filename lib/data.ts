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
    description: 'Scalable, performant web applications built with modern frameworks — from MVPs to enterprise-grade platforms.',
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
    description: 'Embed intelligent features into your product — from LLM-powered workflows to custom ML model deployment.',
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
