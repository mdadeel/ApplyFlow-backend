import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/User'
import { Skill, ISkill } from '../src/models/Skill'
import { Experience } from '../src/models/Experience'
import { Project } from '../src/models/Project'

const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in environment')
  process.exit(1)
}

const SEED_EMAIL = (process.env.SEED_EMAIL ?? 'test@example.com').toLowerCase().trim()

type SkillCategory = ISkill['category']
type SkillLevel = ISkill['level']

interface SkillSeed {
  name: string
  category: SkillCategory
  level: SkillLevel
}

// Spec groups skills into 'Frontend', 'State', 'UI/UX', 'Backend', 'Tools', 'Other'.
// The Skill schema restricts `category` to a fixed enum, so we map those groups
// onto the closest valid enum values:
//   State, UI/UX  -> Frontend
//   Backend       -> Backend (MongoDB -> Database)
//   Tools         -> DevOps
//   Other         -> Backend
const SKILLS: SkillSeed[] = [
  // Frontend (core framework & language)
  { name: 'React.js', category: 'Frontend', level: 'Advanced' },
  { name: 'Next.js', category: 'Frontend', level: 'Advanced' },
  { name: 'TypeScript', category: 'Frontend', level: 'Advanced' },
  { name: 'JavaScript (ES6+)', category: 'Frontend', level: 'Advanced' },
  { name: 'HTML5', category: 'Frontend', level: 'Advanced' },
  { name: 'CSS3', category: 'Frontend', level: 'Advanced' },
  { name: 'Tailwind CSS', category: 'Frontend', level: 'Advanced' },
  { name: 'Vite', category: 'Frontend', level: 'Advanced' },
  // State management -> Frontend
  { name: 'Context API', category: 'Frontend', level: 'Advanced' },
  { name: 'Redux Concepts', category: 'Frontend', level: 'Intermediate' },
  { name: 'SWR', category: 'Frontend', level: 'Advanced' },
  { name: 'React Hook Form', category: 'Frontend', level: 'Advanced' },
  // UI/UX -> Frontend
  { name: 'Responsive Design', category: 'Frontend', level: 'Advanced' },
  { name: 'Framer Motion', category: 'Frontend', level: 'Advanced' },
  { name: 'GSAP', category: 'Frontend', level: 'Intermediate' },
  { name: 'shadcn/ui', category: 'Frontend', level: 'Advanced' },
  { name: 'Radix UI', category: 'Frontend', level: 'Advanced' },
  { name: 'Monaco Editor', category: 'Frontend', level: 'Intermediate' },
  // Backend
  { name: 'Node.js', category: 'Backend', level: 'Advanced' },
  { name: 'Express.js', category: 'Backend', level: 'Advanced' },
  { name: 'Firebase Authentication', category: 'Backend', level: 'Intermediate' },
  // Database
  { name: 'MongoDB', category: 'Database', level: 'Advanced' },
  // Tools -> DevOps
  { name: 'Git', category: 'DevOps', level: 'Advanced' },
  { name: 'GitHub', category: 'DevOps', level: 'Advanced' },
  { name: 'Postman', category: 'DevOps', level: 'Advanced' },
  { name: 'Docker', category: 'DevOps', level: 'Intermediate' },
  { name: 'Vercel', category: 'DevOps', level: 'Advanced' },
  // Other -> Backend
  { name: 'REST APIs', category: 'Backend', level: 'Advanced' },
  { name: 'Stripe API', category: 'Backend', level: 'Intermediate' },
  { name: 'Socket.IO', category: 'Backend', level: 'Intermediate' },
]

interface ExperienceSeed {
  company: string
  role: string
  startDate: string
  endDate?: string
  current: boolean
  responsibilities: string[]
  technologies: string[]
}

const EXPERIENCES: ExperienceSeed[] = [
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
  },
]

interface ProjectSeed {
  title: string
  description: string
  technologies: string[]
  features: string[]
}

const PROJECTS: ProjectSeed[] = [
  {
    title: 'CodeArena - Competitive Programming Platform',
    description:
      'Competitive programming platform featuring real-time contests, an in-browser Monaco-powered code editor, and live leaderboards.',
    technologies: ['React.js', 'Next.js', 'Monaco Editor', 'Socket.IO', 'Tailwind CSS'],
    features: [
      'Real-time coding contests with live participant tracking',
      'In-browser code editor with syntax highlighting',
      'Problem set browser with difficulty filters',
      'Live leaderboard and submission results',
    ],
  },
  {
    title: 'eTuitionBD - Multi-Role Education Marketplace',
    description:
      'Education marketplace connecting students with tutors through role-based dashboards for students, tutors, and admins.',
    technologies: ['React.js', 'Node.js', 'Express.js', 'MongoDB', 'Firebase Authentication'],
    features: [
      'Multi-role dashboards for students, tutors, and admins',
      'Tuition posting and tutor search with filters',
      'Booking flow with messaging between students and tutors',
    ],
  },
  {
    title: 'Metro Optics - E-commerce Platform',
    description:
      'Eyewear e-commerce platform with product browsing, cart, and Stripe-powered checkout for a local optics brand.',
    technologies: ['React.js', 'Stripe API', 'Tailwind CSS'],
    features: [
      'Product catalog with category and brand filters',
      'Cart and Stripe-powered checkout flow',
      'Order history and customer account section',
    ],
  },
  {
    title: 'Ayash Tech - Corporate Portfolio',
    description:
      'Corporate consultancy portfolio website with animated landing pages, services showcase, and team section.',
    technologies: ['React.js', 'Framer Motion', 'Tailwind CSS'],
    features: [
      'Service showcase with animated cards',
      'Team and leadership section',
      'Contact form with validation',
    ],
  },
]

const SUMMARY =
  'Frontend developer with hands-on experience shipping production React.js and Next.js applications across e-commerce, education, and corporate clients. Comfortable across the stack with Node.js, Express, and MongoDB, and focused on building accessible, responsive interfaces with modern tooling like Tailwind CSS, shadcn/ui, and Framer Motion.'

async function main(): Promise<void> {
  await mongoose.connect(MONGODB_URI as string)
  console.log('Connected to MongoDB')

  const user = await User.findOne({ email: SEED_EMAIL })
  if (!user) {
    console.error(`User with email "${SEED_EMAIL}" not found`)
    await mongoose.disconnect()
    process.exit(1)
  }
  const userId = user._id.toString()
  console.log(`Seeding profile for user ${user.email} (${userId})`)

  const [skillsDeleted, experiencesDeleted, projectsDeleted] = await Promise.all([
    Skill.deleteMany({ userId }),
    Experience.deleteMany({ userId }),
    Project.deleteMany({ userId }),
  ])
  console.log(
    `Deleted existing records: ${skillsDeleted.deletedCount ?? 0} skills, ` +
      `${experiencesDeleted.deletedCount ?? 0} experiences, ` +
      `${projectsDeleted.deletedCount ?? 0} projects`,
  )

  const insertedSkills = await Skill.insertMany(SKILLS.map((s) => ({ ...s, userId })))
  console.log(`Inserted ${insertedSkills.length} skills`)

  const insertedExperiences = await Experience.insertMany(
    EXPERIENCES.map((e) => ({ ...e, userId })),
  )
  console.log(`Inserted ${insertedExperiences.length} experiences`)

  const insertedProjects = await Project.insertMany(PROJECTS.map((p) => ({ ...p, userId })))
  console.log(`Inserted ${insertedProjects.length} projects`)

  // The User schema does not currently include `title` or `summary` fields.
  // `strict: false` lets Mongoose persist them without modifying the model.
  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        name: user.name,
        title: 'Frontend Developer',
        summary: SUMMARY,
      },
    } as Record<string, unknown>,
    { strict: false },
  )
  console.log('Updated user personal info (name kept, title and summary set)')

  await mongoose.disconnect()
  console.log('Disconnected from MongoDB. Seed complete.')
}

main().catch(async (err) => {
  console.error('Seed failed:', err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
