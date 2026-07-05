import 'dotenv/config'
import mongoose from 'mongoose'
import crypto from 'crypto'
import { User } from '../src/models/User'
import { hashPassword } from '../src/systems/identity/credentialManager'
import { Skill } from '../src/models/Skill'
import { Experience } from '../src/models/Experience'
import { Project } from '../src/models/Project'
import { Education } from '../src/models/Education'
import { Certificate } from '../src/models/Certificate'
import { JDAnalysis } from '../src/models/JDAnalysis'
import { Application } from '../src/models/Application'

// ── Config ─────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment')
  process.exit(1)
}

const DEV_EMAIL = 'dev@applyflow.ai'
const DEV_PASSWORD = 'devpassword123'

// ── Helpers ────────────────────────────────────────────────────────────────
function hashJd(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

// ── Seed Data ──────────────────────────────────────────────────────────────

const SKILLS = [
  // Frontend
  { name: 'React.js', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Next.js', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'TypeScript', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'JavaScript (ES6+)', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'HTML5', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'CSS3', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Tailwind CSS', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Vite', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Context API', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Redux Concepts', category: 'Frontend' as const, level: 'Intermediate' as const },
  { name: 'SWR', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'React Hook Form', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Responsive Design', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Framer Motion', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'GSAP', category: 'Frontend' as const, level: 'Intermediate' as const },
  { name: 'shadcn/ui', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Radix UI', category: 'Frontend' as const, level: 'Advanced' as const },
  { name: 'Monaco Editor', category: 'Frontend' as const, level: 'Intermediate' as const },
  // Backend
  { name: 'Node.js', category: 'Backend' as const, level: 'Advanced' as const },
  { name: 'Express.js', category: 'Backend' as const, level: 'Advanced' as const },
  { name: 'Firebase Authentication', category: 'Backend' as const, level: 'Intermediate' as const },
  { name: 'REST APIs', category: 'Backend' as const, level: 'Advanced' as const },
  { name: 'Stripe API', category: 'Backend' as const, level: 'Intermediate' as const },
  { name: 'Socket.IO', category: 'Backend' as const, level: 'Intermediate' as const },
  // Database
  { name: 'MongoDB', category: 'Database' as const, level: 'Advanced' as const },
  // DevOps
  { name: 'Git', category: 'DevOps' as const, level: 'Advanced' as const },
  { name: 'GitHub', category: 'DevOps' as const, level: 'Advanced' as const },
  { name: 'Postman', category: 'DevOps' as const, level: 'Advanced' as const },
  { name: 'Docker', category: 'DevOps' as const, level: 'Intermediate' as const },
  { name: 'Vercel', category: 'DevOps' as const, level: 'Advanced' as const },
]

const EXPERIENCES = [
  {
    company: 'Freelance',
    role: 'Frontend Developer',
    startDate: '2025-01',
    current: true,
    responsibilities: [
      'Built responsive, accessible user interfaces with React.js and Next.js for diverse client projects',
      'Integrated REST APIs and third-party services to deliver dynamic, data-driven web experiences',
      'Collaborated with clients to translate business requirements into intuitive UI flows and component systems',
    ],
    technologies: ['React.js', 'Next.js', 'TypeScript', 'Tailwind CSS', 'REST APIs'],
    achievements: [
      'Delivered 5+ production projects on time and under budget',
      'Reduced page load times by 40% through code splitting and lazy loading',
    ],
    metrics: ['5+ projects delivered', '40% faster load times', '100% client satisfaction'],
    projects: ['CodeArena', 'eTuitionBD', 'Metro Optics', 'Ayash Tech'],
  },
  {
    company: 'Metro Optics',
    role: 'Frontend Developer',
    startDate: '2024-06',
    endDate: '2024-12',
    current: false,
    responsibilities: [
      'Designed and developed the e-commerce storefront including product listing, detail, and category pages',
      'Implemented checkout flow with Stripe payment integration and order confirmation screens',
      'Built responsive, accessible UI across product catalog, cart, and account sections',
    ],
    technologies: ['React.js', 'Tailwind CSS', 'Stripe API', 'REST APIs'],
    achievements: [
      'Built complete e-commerce platform from scratch in 6 months',
      'Integrated Stripe payments with full error handling and validation',
    ],
    metrics: ['6-month project', 'Full e-commerce platform'],
    projects: ['Metro Optics'],
  },
  {
    company: 'Ayash Tech',
    role: 'Frontend Developer',
    startDate: '2024-01',
    endDate: '2024-05',
    current: false,
    responsibilities: [
      'Developed the corporate portfolio website showcasing consultancy services, team, and case studies',
      'Crafted animated landing pages with Framer Motion and responsive Tailwind layouts',
      'Implemented contact forms with React Hook Form validation and CMS-driven content sections',
    ],
    technologies: ['React.js', 'Framer Motion', 'Tailwind CSS', 'React Hook Form'],
    achievements: [
      'Created award-winning animated landing page design',
      'Implemented SEO optimization achieving 90+ Lighthouse score',
    ],
    metrics: ['90+ Lighthouse score', '5-month delivery'],
    projects: ['Ayash Tech'],
  },
]

const PROJECTS = [
  {
    title: 'CodeArena - Competitive Programming Platform',
    description: 'Competitive programming platform featuring real-time contests, an in-browser Monaco-powered code editor, and live leaderboards.',
    technologies: ['React.js', 'Next.js', 'Monaco Editor', 'Socket.IO', 'Tailwind CSS'],
    features: [
      'Real-time coding contests with live participant tracking',
      'In-browser code editor with syntax highlighting',
      'Problem set browser with difficulty filters',
      'Live leaderboard and submission results',
    ],
    tags: ['fullstack', 'education', 'real-time'],
  },
  {
    title: 'eTuitionBD - Multi-Role Education Marketplace',
    description: 'Education marketplace connecting students with tutors through role-based dashboards for students, tutors, and admins.',
    technologies: ['React.js', 'Node.js', 'Express.js', 'MongoDB', 'Firebase Authentication'],
    features: [
      'Multi-role dashboards for students, tutors, and admins',
      'Tuition posting and tutor search with filters',
      'Booking flow with messaging between students and tutors',
    ],
    tags: ['fullstack', 'marketplace', 'education'],
  },
  {
    title: 'Metro Optics - E-commerce Platform',
    description: 'Eyewear e-commerce platform with product browsing, cart, and Stripe-powered checkout for a local optics brand.',
    technologies: ['React.js', 'Stripe API', 'Tailwind CSS'],
    features: [
      'Product catalog with category and brand filters',
      'Cart and Stripe-powered checkout flow',
      'Order history and customer account section',
    ],
    tags: ['ecommerce', 'frontend'],
  },
  {
    title: 'Ayash Tech - Corporate Portfolio',
    description: 'Corporate consultancy portfolio website with animated landing pages, services showcase, and team section.',
    technologies: ['React.js', 'Framer Motion', 'Tailwind CSS'],
    features: [
      'Service showcase with animated cards',
      'Team and leadership section',
      'Contact form with validation',
    ],
    tags: ['frontend', 'portfolio', 'animation'],
  },
]

const EDUCATION = [
  {
    degree: 'B.Sc. in Computer Science & Engineering',
    institution: 'University of Engineering & Technology',
    startDate: '2018-01',
    endDate: '2022-12',
    result: 'GPA: 3.5/4.0',
  },
]

const CERTIFICATES = [
  {
    name: 'Meta Front-End Developer Professional Certificate',
    issuer: 'Meta (Coursera)',
    date: '2023-06',
  },
  {
    name: 'AWS Cloud Practitioner Essentials',
    issuer: 'Amazon Web Services',
    date: '2023-12',
  },
]

// ── Job Descriptions & JD Analyses ─────────────────────────────────────────
const JD_ANALYSES = [
  {
    company: 'Google',
    role: 'Frontend Engineer',
    location: 'Mountain View, CA (Remote)',
    rawText: `Google is looking for a Frontend Engineer to join our Cloud Console team. 
You will build and maintain the Google Cloud Console UI, working with Angular, TypeScript, and internal component libraries.
Requirements: 3+ years of frontend development experience, strong TypeScript skills, experience with large-scale web applications.
Nice to have: Experience with Angular, Google Cloud Platform, accessibility best practices.`,
    requiredSkills: ['TypeScript', 'React.js', 'CSS3', 'HTML5', 'REST APIs', 'Responsive Design'],
    niceToHaveSkills: ['Angular', 'Google Cloud Platform', 'Accessibility (a11y)'],
    keywords: ['Google Cloud Console', 'large-scale UI', 'component libraries', 'internal tools'],
    atsTerms: ['3+ years', 'frontend development', 'TypeScript', 'Angular'],
    redFlags: [],
    matchScore: 78,
    summary: 'Strong frontend role requiring TypeScript and large-scale web app experience. Angular is a nice-to-have.',
  },
  {
    company: 'Stripe',
    role: 'Frontend Engineer, Developer Experience',
    location: 'San Francisco, CA',
    rawText: `Stripe is looking for a frontend engineer to join our Developer Experience team.
You will build the tools and interfaces that millions of developers use to integrate Stripe.
Requirements: Strong JavaScript/TypeScript, experience with React, understanding of developer tools and API design.
Nice to have: Experience building design systems, open source contributions, technical writing.`,
    requiredSkills: ['TypeScript', 'JavaScript (ES6+)', 'React.js', 'REST APIs', 'Tailwind CSS'],
    niceToHaveSkills: ['Design Systems', 'Open Source', 'Technical Writing', 'shadcn/ui'],
    keywords: ['developer tools', 'API design', 'developer experience', 'Stripe'],
    atsTerms: ['React', 'TypeScript', 'developer tools'],
    redFlags: [],
    matchScore: 85,
    summary: 'Excellent match. Strong TypeScript and React alignment with Stripe\'s dev tools focus.',
  },
  {
    company: 'Vercel',
    role: 'Software Engineer, Frontend',
    location: 'San Francisco, CA (Hybrid)',
    rawText: `Vercel is looking for a Frontend Software Engineer to work on the Next.js framework and Vercel platform.
You will contribute to open source, build developer tooling, and shape the future of web development.
Requirements: Deep understanding of React, Next.js, TypeScript, and web performance.
Excellent communication skills and ability to work in a fast-paced environment.`,
    requiredSkills: ['React.js', 'Next.js', 'TypeScript', 'JavaScript (ES6+)', 'Web Performance'],
    niceToHaveSkills: ['Open Source', 'Node.js', 'Vercel Platform', 'Edge Functions'],
    keywords: ['Next.js', 'React Server Components', 'open source', 'web framework'],
    atsTerms: ['Next.js', 'React', 'open source', 'web performance'],
    redFlags: [],
    matchScore: 92,
    summary: 'Near-perfect match. Next.js expertise and React skills align directly with Vercel\'s core stack.',
  },
]

const APPLICATIONS = [
  // Already applied to Google
  {
    company: 'Google',
    role: 'Frontend Engineer',
    status: 'applied' as const,
    notes: 'Applied through referral. Phone screen scheduled.',
    tags: ['big-tech', 'referral', 'cloud'],
    timeline: [
      { event: 'Application submitted', date: daysAgo(14) },
      { event: 'Resume reviewed by recruiter', date: daysAgo(10) },
      { event: 'Phone screen scheduled', date: daysAgo(3) },
    ],
    tasks: [
      { id: 't1', type: 'tailor_resume' as const, title: 'Tailor resume for Google Cloud role', completed: true, dueDate: daysAgo(15) },
      { id: 't2', type: 'custom' as const, title: 'Prepare for phone screen - Google Cloud products', completed: false, dueDate: daysAgo(-5) },
    ],
    scores: { match: 78, overall: 82 },
  },
  // Draft for Stripe
  {
    company: 'Stripe',
    role: 'Frontend Engineer, Developer Experience',
    status: 'ready' as const,
    notes: 'Resume is ready. Need to write a cover letter.',
    tags: ['fintech', 'developer-tools'],
    timeline: [
      { event: 'Job posting saved', date: daysAgo(7) },
      { event: 'Resume tailored for Stripe', date: daysAgo(4) },
    ],
    tasks: [
      { id: 't3', type: 'tailor_resume' as const, title: 'Tailor resume for Stripe', completed: true, dueDate: daysAgo(5) },
      { id: 't4', type: 'generate_email' as const, title: 'Generate application email', completed: false },
    ],
    scores: { match: 85, overall: 88 },
  },
  // Interviewing at Vercel
  {
    company: 'Vercel',
    role: 'Software Engineer, Frontend',
    status: 'interview' as const,
    notes: 'First round completed. Technical screen next week.',
    tags: ['startup', 'developer-tools', 'dream-job'],
    timeline: [
      { event: 'Application submitted', date: daysAgo(21) },
      { event: 'Resume reviewed', date: daysAgo(18) },
      { event: 'First round interview completed', date: daysAgo(7) },
      { event: 'Technical screen scheduled', date: daysAgo(-2) },
    ],
    tasks: [
      { id: 't5', type: 'interview' as const, title: 'Prepare for technical screen - System design', completed: true, dueDate: daysAgo(3) },
      { id: 't6', type: 'interview' as const, title: 'Review Next.js internals & Server Components', completed: false },
    ],
    scores: { match: 92, overall: 95 },
  },
  // Draft for a hypothetical company
  {
    company: 'Linear',
    role: 'Frontend Engineer',
    status: 'draft' as const,
    notes: 'Just saved the job posting. Need to analyze the JD.',
    tags: ['startup', 'developer-tools'],
    timeline: [
      { event: 'Job posting discovered', date: daysAgo(1) },
    ],
    tasks: [
      { id: 't7', type: 'custom' as const, title: 'Analyze job description', completed: false },
    ],
    scores: {},
  },
]

// ── Main ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI)
  console.log('Connected to MongoDB')

  // ── 1. Create / Upsert Dev User ─────────────────────────────────────────
  let user = await User.findOne({ email: DEV_EMAIL })
  if (!user) {
    user = await User.create({
      email: DEV_EMAIL,
      password: await hashPassword(DEV_PASSWORD),
      name: 'Dev User',
      authProvider: 'email',
      onboardingComplete: true,
      preferences: {
        aiProvider: 'openai',
        model: 'gpt-4',
        temperature: 0.7,
        writingTone: 'professional',
        defaultTemplate: 'modern',
        defaultExportFormat: 'pdf',
      },
    })
    console.log('Created dev user: dev@applyflow.ai / devpassword123')
  } else {
    console.log('Dev user already exists: dev@applyflow.ai')
  }

  const userId = user._id.toString()

  // ── 2. Seed Skills ──────────────────────────────────────────────────────
  await Skill.deleteMany({ userId })
  await Skill.insertMany(SKILLS.map((s) => ({ ...s, userId })))
  console.log(`Seeded ${SKILLS.length} skills`)

  // ── 3. Seed Experiences ─────────────────────────────────────────────────
  await Experience.deleteMany({ userId })
  await Experience.insertMany(EXPERIENCES.map((e) => ({ ...e, userId })))
  console.log(`Seeded ${EXPERIENCES.length} experiences`)

  // ── 4. Seed Projects ────────────────────────────────────────────────────
  await Project.deleteMany({ userId })
  await Project.insertMany(PROJECTS.map((p) => ({ ...p, userId })))
  console.log(`Seeded ${PROJECTS.length} projects`)

  // ── 5. Seed Education ───────────────────────────────────────────────────
  await Education.deleteMany({ userId })
  await Education.insertMany(EDUCATION.map((e) => ({ ...e, userId })))
  console.log(`Seeded ${EDUCATION.length} education entries`)

  // ── 6. Seed Certificates ────────────────────────────────────────────────
  await Certificate.deleteMany({ userId })
  await Certificate.insertMany(CERTIFICATES.map((c) => ({ ...c, userId })))
  console.log(`Seeded ${CERTIFICATES.length} certificates`)

  // ── 7. Seed JD Analyses ─────────────────────────────────────────────────
  await JDAnalysis.deleteMany({ userId })
  const jdDocs = JD_ANALYSES.map((jd) => ({
    ...jd,
    userId,
    jdHash: hashJd(jd.rawText),
  }))
  await JDAnalysis.insertMany(jdDocs)
  console.log(`Seeded ${JD_ANALYSES.length} job description analyses`)

  // ── 8. Seed Applications ────────────────────────────────────────────────
  await Application.deleteMany({ userId })
  const appDocs = APPLICATIONS.map((app) => ({
    ...app,
    userId,
    tasks: app.tasks.map((t, i) => ({
      ...t,
      id: `${userId}-${i}`,
    })),
  }))
  await Application.insertMany(appDocs)
  console.log(`Seeded ${APPLICATIONS.length} applications`)

  // ── 9. Update User Title & Summary ──────────────────────────────────────
  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        title: 'Frontend Developer',
        summary: 'Frontend developer with hands-on experience shipping production React.js and Next.js applications across e-commerce, education, and corporate clients. Comfortable across the stack with Node.js, Express, and MongoDB, and focused on building accessible, responsive interfaces with modern tooling like Tailwind CSS, shadcn/ui, and Framer Motion.',
      },
    } as Record<string, unknown>,
    { strict: false },
  )
  console.log('Updated user profile info')

  await mongoose.disconnect()
  console.log('\n✅ Seed complete!')
  console.log('   Email:    dev@applyflow.ai')
  console.log('   Password: devpassword123')
  console.log('   Data:     skills, experiences, projects, education, certificates, JD analyses, applications')
}

main().catch(async (err) => {
  console.error('Seed failed:', err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
