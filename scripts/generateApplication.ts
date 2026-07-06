/**
 * generateApplication.ts
 * 
 * Standalone script that:
 * 1. Connects to MongoDB
 * 2. Finds or verifies the user
 * 3. Seeds the career profile (skills, experiences, projects, education, certificates)
 * 4. Reads the job description
 * 5. Uses the configured AI provider (OpenRouter/OpenAI/Ollama) to generate
 *    a resume, cover letter, and email via the SmartApplicationService
 * 6. Exports the generated files to the applications folder
 * 
 * Usage:
 *   npx tsx scripts/generateApplication.ts
 * 
 * Environment (from .env):
 *   AI_PROVIDER=openai
 *   AI_API_KEY=sk-or-v1-...
 *   AI_BASE_URL=https://openrouter.ai/api/v1
 *   AI_MODEL=openai/gpt-oss-20b:free
 *   MONGODB_URI=mongodb+srv://...
 */

import 'dotenv/config'
import mongoose from 'mongoose'
import { User } from '../src/models/User'
import { Skill, type ISkill } from '../src/models/Skill'
import { Experience } from '../src/models/Experience'
import { Project } from '../src/models/Project'
import { Education } from '../src/models/Education'
import { Certificate } from '../src/models/Certificate'
import { config } from '../src/config'
import type { CareerProfile } from '../src/systems/career-data/profileService'
import { OpenAIAIProvider } from '../src/systems/ai/openaiProvider'
import { OllamaAIProvider } from '../src/systems/ai/ollamaProvider'
import { SmartApplicationService } from '../src/systems/smart-application/index'
import type { AIProvider } from '../src/systems/ai/aiProvider'
import type { SmartApplicationInput } from '../src/systems/smart-application/types'

// ─── Configuration ────────────────────────────────────────────────────────

// Set USER_EMAIL env var to your email, or the script uses dev@applyflow.ai
const USER_EMAIL = (process.env.USER_EMAIL || 'dev@applyflow.ai').toLowerCase().trim()
const USER_NAME = process.env.USER_NAME || 'Shahnawas Adeel'
const USER_PASSWORD = process.env.USER_PASSWORD || 'password123'

// The Job Description for a Full-Stack Developer at a startup
const JD_TEXT = `Vantage - Full-Stack Developer (Early Engineering Hire)

About Vantage
Vantage is building the next-generation developer observability platform, helping engineering teams understand their codebase health, deployment velocity, and incident response patterns in real time. We're a small, fast-moving team backed by top-tier investors, and we're looking for our next engineer to own meaningful parts of our product end-to-end.

What You'll Do
- Build and maintain customer-facing features across our React/TypeScript frontend and Node.js/Express backend
- Design and implement RESTful APIs and database schemas (MongoDB/PostgreSQL)
- Collaborate with product and design to ship user-facing features with smooth, polished UI/UX
- Write clean, tested, well-documented code across the entire stack
- Contribute to architectural decisions as we scale from MVP to production at thousands of users
- Participate in code reviews, on-call rotation, and agile ceremonies

What We're Looking For

Required:
- 3+ years of experience building web applications
- Strong proficiency in React, TypeScript, JavaScript (ES6+)
- Solid backend experience with Node.js and Express or similar frameworks
- Experience with MongoDB or other NoSQL databases
- Understanding of REST API design and best practices
- Familiarity with version control (Git/GitHub)
- Comfortable owning features from conception to deployment

Preferred:
- Experience with Next.js, Tailwind CSS, and modern frontend tooling (Vite, SWR)
- Familiarity with real-time technologies (Socket.IO, WebSockets)
- Experience with authentication patterns (JWT, OAuth, Firebase Auth)
- Knowledge of Docker and CI/CD pipelines
- Experience at an early-stage startup or in a fast-paced environment
- Familiarity with testing frameworks (Jest, Vitest, Playwright)

Why Join Vantage
- Early engineering hire — shape the product and culture from the ground up
- Competitive salary + early-stage equity
- Remote-first culture with quarterly team offsites
- Top-of-market equipment budget
- Direct impact on product direction and technical decisions`

// ─── Career Profile Data ───────────────────────────────────────────────────

const SKILLS_DATA: Array<{ name: string; category: ISkill['category']; level: ISkill['level'] }> = [
  // Frontend
  { name: 'React.js', category: 'Frontend', level: 'Advanced' },
  { name: 'Next.js', category: 'Frontend', level: 'Advanced' },
  { name: 'TypeScript', category: 'Frontend', level: 'Advanced' },
  { name: 'JavaScript (ES6+)', category: 'Frontend', level: 'Advanced' },
  { name: 'HTML5', category: 'Frontend', level: 'Advanced' },
  { name: 'CSS3', category: 'Frontend', level: 'Advanced' },
  { name: 'Tailwind CSS', category: 'Frontend', level: 'Advanced' },
  { name: 'Vite', category: 'Frontend', level: 'Advanced' },
  // State Management
  { name: 'Context API', category: 'Frontend', level: 'Advanced' },
  { name: 'Redux Concepts', category: 'Frontend', level: 'Intermediate' },
  { name: 'SWR', category: 'Frontend', level: 'Advanced' },
  { name: 'React Hook Form', category: 'Frontend', level: 'Advanced' },
  // UI/UX
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
  { name: 'REST APIs', category: 'Backend', level: 'Advanced' },
  { name: 'Stripe API', category: 'Backend', level: 'Intermediate' },
  { name: 'Socket.IO', category: 'Backend', level: 'Intermediate' },
  // Database
  { name: 'MongoDB', category: 'Database', level: 'Advanced' },
  // DevOps & Tools
  { name: 'Git', category: 'DevOps', level: 'Advanced' },
  { name: 'GitHub', category: 'DevOps', level: 'Advanced' },
  { name: 'Postman', category: 'DevOps', level: 'Advanced' },
  { name: 'Docker', category: 'DevOps', level: 'Intermediate' },
  { name: 'Vercel', category: 'DevOps', level: 'Advanced' },
]

const EXPERIENCES_DATA = [
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
    achievements: ['Delivered 5+ production projects on time and under budget'],
    metrics: ['5+ projects delivered', '100% client satisfaction'],
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
    achievements: ['Built complete e-commerce platform from scratch in 6 months'],
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
    achievements: ['Achieved 90+ Lighthouse score for performance and SEO'],
    metrics: ['90+ Lighthouse score'],
    projects: ['Ayash Tech'],
  },
]

const PROJECTS_DATA = [
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
  },
]

const EDUCATION_DATA = [
  {
    degree: 'B.Sc. in Computer Science & Engineering',
    institution: 'University of Engineering & Technology',
    startDate: '2018-01',
    endDate: '2022-12',
    result: 'GPA: 3.5/4.0',
  },
]

const CERTIFICATES_DATA = [
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

const SUMMARY_TEXT = 'Frontend developer with hands-on experience shipping production React.js and Next.js applications across e-commerce, education, and corporate clients. Comfortable across the stack with Node.js, Express, and MongoDB, and focused on building accessible, responsive interfaces with modern tooling like Tailwind CSS, shadcn/ui, and Framer Motion.'

// ─── Helper: Create AI Provider ───────────────────────────────────────────

async function createAIProvider(): Promise<AIProvider> {
  if (config.aiProvider === 'ollama') {
    console.log(`  Using Ollama (${config.ollamaUrl}, model: ${config.ollamaModel})`)
    return new OllamaAIProvider()
  }
  if (config.aiProvider === 'openai' && config.aiApiKey) {
    console.log(`  Using OpenAI/OpenRouter (${config.aiBaseUrl}, model: ${config.aiModel})`)
    return new OpenAIAIProvider()
  }
  console.warn('  WARNING: No AI provider configured. Using MockAIProvider (will generate template output).')
  const { MockAIProvider } = await import('../src/systems/ai/mockProvider')
  return new MockAIProvider()
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('')
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║   ApplyFlow AI — Application Generator              ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log('')

  // ── 1. Connect to MongoDB ─────────────────────────────────────────
  console.log('[1/5] Connecting to MongoDB...')
  if (!config.mongodbUri) {
    console.error('MONGODB_URI is not set in environment')
    process.exit(1)
  }
  await mongoose.connect(config.mongodbUri)
  console.log(`  ✅ Connected to MongoDB`)

  // ── 2. Find or Create User ────────────────────────────────────────
  console.log('\n[2/5] Setting up user...')
  let user = await User.findOne({ email: USER_EMAIL })
  if (!user) {
    const { hashPassword } = await import('../src/systems/identity/credentialManager')
    user = await User.create({
      email: USER_EMAIL,
      password: await hashPassword(USER_PASSWORD),
      name: USER_NAME,
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
    console.log(`  ✅ Created user: ${USER_EMAIL}`)
  } else {
    console.log(`  ✅ Found existing user: ${user.email}`)
  }
  const userId = user._id.toString()

  // ── 3. Seed Career Profile ────────────────────────────────────────
  console.log('\n[3/5] Seeding career profile...')

  // Skills
  await Skill.deleteMany({ userId })
  const skills = await Skill.insertMany(SKILLS_DATA.map(s => ({ ...s, userId })))
  console.log(`  ✅ Skills: ${skills.length} seeded`)

  // Experiences
  await Experience.deleteMany({ userId })
  const experiences = await Experience.insertMany(
    EXPERIENCES_DATA.map(e => ({ ...e, userId }))
  )
  console.log(`  ✅ Experiences: ${experiences.length} seeded`)

  // Projects
  await Project.deleteMany({ userId })
  const projects = await Project.insertMany(
    PROJECTS_DATA.map(p => ({ ...p, userId }))
  )
  console.log(`  ✅ Projects: ${projects.length} seeded`)

  // Education
  await Education.deleteMany({ userId })
  const education = await Education.insertMany(
    EDUCATION_DATA.map(e => ({ ...e, userId }))
  )
  console.log(`  ✅ Education: ${education.length} entries seeded`)

  // Certificates
  await Certificate.deleteMany({ userId })
  const certificates = await Certificate.insertMany(
    CERTIFICATES_DATA.map(c => ({ ...c, userId }))
  )
  console.log(`  ✅ Certificates: ${certificates.length} seeded`)

  // Update user title, summary & contact info
  await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        title: 'Frontend Developer',
        summary: SUMMARY_TEXT,
        phone: process.env.USER_PHONE || '01533970377',
        location: process.env.USER_LOCATION || 'Bangladesh',
        linkedIn: process.env.USER_LINKEDIN || 'https://www.linkedin.com/in/shahnawasadee1',
        github: process.env.USER_GITHUB || 'https://github.com/mdadeel',
        portfolio: process.env.USER_PORTFOLIO || 'https://mdadeel.me',
      },
    } as Record<string, unknown>,
    { strict: false }
  )
  console.log(`  ✅ User profile updated (title + summary + contact info)`)

  // ── 4. Generate Application via AI ────────────────────────────────
  console.log('\n[4/5] Generating application via AI...')
  console.log('')

  const aiProvider = await createAIProvider()
  const smartAppService = new SmartApplicationService(aiProvider)

  // Log the AI settings being used
  console.log(`  AI Provider: ${config.aiProvider || 'not configured'}`)
  if (config.aiApiKey) {
    const maskedKey = config.aiApiKey.slice(0, 8) + '...' + config.aiApiKey.slice(-4)
    console.log(`  API Key: ${maskedKey}`)
  }
  if (config.aiBaseUrl) {
    console.log(`  Base URL: ${config.aiBaseUrl}`)
  }
  console.log(`  Model: ${config.aiModel || 'default'}`)
  console.log('')

  console.log('  Calling AI to analyze JD and generate resume, cover letter, and email...')
  console.log('  This may take 30-90 seconds depending on the AI provider...')
  console.log('')

  const startTime = Date.now()

  try {
    const result = await smartAppService.createApplication({
      userId,
      jdText: JD_TEXT,
      company: 'Vantage',
      role: 'Full-Stack Developer',
    })

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`  ✅ Generation complete in ${elapsed}s`)
    console.log('')
    console.log(`  ── Scores ──`)
    console.log(`     ATS Match:      ${result.scores.ats}%`)
    console.log(`     Profile Match:  ${result.scores.match}%`)
    console.log(`     Overall:        ${result.scores.overall}%`)
    console.log('')

    // ── 5. Display Results ──────────────────────────────────────────
    console.log('')
    console.log('╔══════════════════════════════════════════════════════╗')
    console.log('║   AI-GENERATED APPLICATION PACKAGE                  ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log('')

    // Analysis
    console.log('── JD ANALYSIS ──')
    console.log(`  Company:   ${result.output.analysis.company}`)
    console.log(`  Role:      ${result.output.analysis.role}`)
    console.log(`  Match %:   ${result.output.analysis.matchPercent}%`)
    console.log(`  Required:  ${result.output.analysis.requiredSkills.join(', ')}`)
    console.log(`  Preferred: ${result.output.analysis.preferredSkills.join(', ')}`)
    console.log(`  Keywords:  ${result.output.analysis.keywords.join(', ')}`)
    console.log(`  Red Flags: ${result.output.analysis.redFlags.join(', ') || 'None'}`)
    console.log('')

    // Resume
    console.log('── RESUME ──')
    console.log(result.output.resume.markdown)
    console.log('')

    // Cover Letter
    console.log('── COVER LETTER ──')
    console.log(result.output.coverLetter)
    console.log('')

    // Email
    console.log('── EMAIL ──')
    console.log(`  Subject: ${result.output.email.subject}`)
    console.log(`  Tone:    ${result.output.email.tone}`)
    console.log('')
    console.log(result.output.email.body)
    console.log('')

    // Validation Hints
    console.log('── VALIDATION HINTS ──')
    console.log(`  ATS Keywords to Include: ${result.output.validationHints.atsKeywordsToInclude.join(', ')}`)
    console.log(`  Truth Flags: ${result.output.validationHints.truthFlags.join(', ') || 'None'}`)
    console.log(`  Humanization Tips: ${result.output.validationHints.humanizationTips.join(', ') || 'None'}`)
    console.log('')

    // Export path
    if (result.exportPath) {
      console.log(`  📁 Files exported to: ${result.exportPath}`)
    } else {
      console.log('  📁 Files exported to: ApplyFlow AI/applications/Vantage/')
    }
    console.log('')

    console.log('╔══════════════════════════════════════════════════════╗')
    console.log('║   Review the output above, then tell me what        ║')
    console.log('║   you want to upgrade or improve.                   ║')
    console.log('╚══════════════════════════════════════════════════════╝')
    console.log('')

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.error(`\n  ❌ Generation failed after ${elapsed}s:`)
    console.error(`     ${(err as Error).message}`)
    console.error('')
    console.error('  Possible issues:')
    console.error('  - AI provider not responding (check your API key and base URL)')
    console.error('  - MongoDB connection issues')
    console.error('  - Model not available')
    console.error('')
    console.error('  Check your .env file settings and try again.')
    console.error('')
    process.exit(1)
  }

  await mongoose.disconnect()
  console.log('Disconnected from MongoDB.')
  console.log('Done.')
}

main().catch(async (err) => {
  console.error('Script failed:', err)
  await mongoose.disconnect().catch(() => {})
  process.exit(1)
})
