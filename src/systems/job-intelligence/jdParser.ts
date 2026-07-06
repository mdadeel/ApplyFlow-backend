import type { ParsedJD, JDSection } from './types'

const SECTION_HEADERS = [
  { patterns: [/^about\s+(the\s+)?(role|position|job|opportunity)/i, /^job\s+(description|summary|overview)/i, /^the\s+role/i], type: 'about' as const },
  { patterns: [/^responsibilities/i, /^what you('ll| will) do/i, /^key responsibilities/i, /^the role involves/i, /^day to day/i, /^what you\'ll be doing/i, /^your role/i], type: 'responsibilities' as const },
  { patterns: [/^requirements/i, /^qualifications/i, /^what we(\'re| are) looking for/i, /^minimum qualifications/i, /^required qualifications/i, /^basic qualifications/i, /^what you need/i, /^skills and experience/i, /^experience and skills/i, /^key requirements/i], type: 'requirements' as const },
  { patterns: [/^(nice|good|great|bonus|plus|preferred|additional)\s*(to have|to-have|skills|qualifications)?/i, /^(nice|good|great|bonus|plus)\s*(if you have|to have)/i, /^preferred qualifications/i, /^what would make you stand out/i], type: 'preferred' as const },
  { patterns: [/^benefits/i, /^perks/i, /^what we offer/i, /^compensation/i, /^why join us/i], type: 'benefits' as const },
]

const EXPERIENCE_LEVELS = [
  { level: 'internship', patterns: [/internship/i, /intern/i, /student/i] },
  { level: 'entry', patterns: [/entry.level/i, /junior/i, /new grad/i, /early career/i, /0\.{0,1}\s*-\s*\d+\s+years/i, /less than \d+ years/i, /fresh graduate/i] },
  { level: 'mid', patterns: [/mid.level/i, /midlevel/i, /\b\d+\s*-\s*\d+\s+years/i, /\b\d+\s*\+\s*years/i] },
  { level: 'senior', patterns: [/senior/i, /sr\./i, /staff/i, /\d+\s*\+\s*years.{0,50}experience/i] },
  { level: 'lead', patterns: [/lead/i, /principal/i, /head of/i, /manager/i, /director/i, /architect/i, /team lead/i] },
]

const RED_FLAGS = [
  { pattern: /\bunpaid\b/i, flag: 'Unpaid position' },
  { pattern: /\bcontract\s*to\s*hire\b/i, flag: 'Contract-to-hire' },
  { pattern: /\b(urgent|immediate)\s*(hire|start|joining)\b/i, flag: 'Urgent hiring (possible churn)' },
  { pattern: /\b(jack of all|wear\s*many\s*hats|do it all)\b/i, flag: 'Unclear role expectations' },
  { pattern: /(work|worklife|work.life)\s*(balance)?\s*(not|isn't|is\s*not)\s*(a\s*)?priority/i, flag: 'Poor work-life balance signal' },
  { pattern: /(fast.paced|rocket.ship|high.growth)\s*(environ|startup)/i, flag: 'Potential burnout risk' },
  { pattern: /\b90.day\b/i, flag: '90-day review cycle' },
  { pattern: /\b(equity|stock options)\s*(only|mostly)\b/i, flag: 'Equity-heavy compensation' },
  { pattern: /(family\s*owned|startup)\s*(environ|culture)\s*.*?\b(small|lean|tight)\s*(team|budget)/i, flag: 'Resource-constrained environment' },
]

const TECH_KEYWORDS: { keyword: string; category: string }[] = [
  { keyword: 'react', category: 'Frontend' },
  { keyword: 'react.js', category: 'Frontend' },
  { keyword: 'reactjs', category: 'Frontend' },
  { keyword: 'next.js', category: 'Frontend' },
  { keyword: 'nextjs', category: 'Frontend' },
  { keyword: 'vue', category: 'Frontend' },
  { keyword: 'vue.js', category: 'Frontend' },
  { keyword: 'angular', category: 'Frontend' },
  { keyword: 'svelte', category: 'Frontend' },
  { keyword: 'typescript', category: 'Language' },
  { keyword: 'javascript', category: 'Language' },
  { keyword: 'js', category: 'Language' },
  { keyword: 'ts', category: 'Language' },
  { keyword: 'python', category: 'Language' },
  { keyword: 'java', category: 'Language' },
  { keyword: 'go', category: 'Language' },
  { keyword: 'golang', category: 'Language' },
  { keyword: 'rust', category: 'Language' },
  { keyword: 'ruby', category: 'Language' },
  { keyword: 'php', category: 'Language' },
  { keyword: 'c#', category: 'Language' },
  { keyword: 'csharp', category: 'Language' },
  { keyword: 'c++', category: 'Language' },
  { keyword: 'cpp', category: 'Language' },
  { keyword: 'swift', category: 'Language' },
  { keyword: 'kotlin', category: 'Language' },
  { keyword: 'scala', category: 'Language' },
  { keyword: 'dart', category: 'Language' },
  { keyword: 'node.js', category: 'Backend' },
  { keyword: 'nodejs', category: 'Backend' },
  { keyword: 'express', category: 'Backend' },
  { keyword: 'django', category: 'Backend' },
  { keyword: 'flask', category: 'Backend' },
  { keyword: 'spring', category: 'Backend' },
  { keyword: 'spring boot', category: 'Backend' },
  { keyword: 'rails', category: 'Backend' },
  { keyword: 'laravel', category: 'Backend' },
  { keyword: 'asp.net', category: 'Backend' },
  { keyword: 'fastapi', category: 'Backend' },
  { keyword: 'graphql', category: 'Backend' },
  { keyword: 'rest', category: 'Backend' },
  { keyword: 'rest api', category: 'Backend' },
  { keyword: 'api', category: 'Backend' },
  { keyword: 'grpc', category: 'Backend' },
  { keyword: 'microservices', category: 'Backend' },
  { keyword: 'serverless', category: 'Backend' },
  { keyword: 'aws', category: 'Cloud' },
  { keyword: 'amazon web services', category: 'Cloud' },
  { keyword: 'azure', category: 'Cloud' },
  { keyword: 'gcp', category: 'Cloud' },
  { keyword: 'google cloud', category: 'Cloud' },
  { keyword: 'cloud', category: 'Cloud' },
  { keyword: 'docker', category: 'DevOps' },
  { keyword: 'kubernetes', category: 'DevOps' },
  { keyword: 'k8s', category: 'DevOps' },
  { keyword: 'terraform', category: 'DevOps' },
  { keyword: 'jenkins', category: 'DevOps' },
  { keyword: 'ci/cd', category: 'DevOps' },
  { keyword: 'ci cd', category: 'DevOps' },
  { keyword: 'github actions', category: 'DevOps' },
  { keyword: 'gitlab ci', category: 'DevOps' },
  { keyword: 'ansible', category: 'DevOps' },
  { keyword: 'puppet', category: 'DevOps' },
  { keyword: 'chef', category: 'DevOps' },
  { keyword: 'helm', category: 'DevOps' },
  { keyword: 'prometheus', category: 'DevOps' },
  { keyword: 'grafana', category: 'DevOps' },
  { keyword: 'datadog', category: 'DevOps' },
  { keyword: 'mongodb', category: 'Database' },
  { keyword: 'mongo', category: 'Database' },
  { keyword: 'postgresql', category: 'Database' },
  { keyword: 'postgres', category: 'Database' },
  { keyword: 'mysql', category: 'Database' },
  { keyword: 'sql', category: 'Database' },
  { keyword: 'redis', category: 'Database' },
  { keyword: 'elasticsearch', category: 'Database' },
  { keyword: 'dynamodb', category: 'Database' },
  { keyword: 'firestore', category: 'Database' },
  { keyword: 'cassandra', category: 'Database' },
  { keyword: 'sqlite', category: 'Database' },
  { keyword: 'prisma', category: 'Database' },
  { keyword: 'typeorm', category: 'Database' },
  { keyword: 'sequelize', category: 'Database' },
  { keyword: 'mongoose', category: 'Database' },
  { keyword: 'html', category: 'Frontend' },
  { keyword: 'css', category: 'Frontend' },
  { keyword: 'sass', category: 'Frontend' },
  { keyword: 'less', category: 'Frontend' },
  { keyword: 'tailwind', category: 'Frontend' },
  { keyword: 'tailwind css', category: 'Frontend' },
  { keyword: 'bootstrap', category: 'Frontend' },
  { keyword: 'material ui', category: 'Frontend' },
  { keyword: 'shadcn', category: 'Frontend' },
  { keyword: 'figma', category: 'Frontend' },
  { keyword: 'responsive design', category: 'Frontend' },
  { keyword: 'webpack', category: 'Frontend' },
  { keyword: 'vite', category: 'Frontend' },
  { keyword: 'babel', category: 'Frontend' },
  { keyword: 'redux', category: 'Frontend' },
  { keyword: 'zustand', category: 'Frontend' },
  { keyword: 'mobx', category: 'Frontend' },
  { keyword: 'recoil', category: 'Frontend' },
  { keyword: 'jest', category: 'Testing' },
  { keyword: 'vitest', category: 'Testing' },
  { keyword: 'mocha', category: 'Testing' },
  { keyword: 'cypress', category: 'Testing' },
  { keyword: 'playwright', category: 'Testing' },
  { keyword: 'puppeteer', category: 'Testing' },
  { keyword: 'selenium', category: 'Testing' },
  { keyword: 'junit', category: 'Testing' },
  { keyword: 'pytest', category: 'Testing' },
  { keyword: 'unit testing', category: 'Testing' },
  { keyword: 'integration testing', category: 'Testing' },
  { keyword: 'e2e', category: 'Testing' },
  { keyword: 'tdd', category: 'Testing' },
  { keyword: 'git', category: 'Tools' },
  { keyword: 'github', category: 'Tools' },
  { keyword: 'gitlab', category: 'Tools' },
  { keyword: 'linux', category: 'Tools' },
  { keyword: 'unix', category: 'Tools' },
  { keyword: 'bash', category: 'Tools' },
  { keyword: 'shell', category: 'Tools' },
  { keyword: 'npm', category: 'Tools' },
  { keyword: 'yarn', category: 'Tools' },
  { keyword: 'pnpm', category: 'Tools' },
  { keyword: 'webpack', category: 'Tools' },
  { keyword: 'vite', category: 'Tools' },
  { keyword: 'eslint', category: 'Tools' },
  { keyword: 'prettier', category: 'Tools' },
  { keyword: 'postman', category: 'Tools' },
  { keyword: 'docker', category: 'DevOps' },
  { keyword: 'nginx', category: 'DevOps' },
  { keyword: 'apache', category: 'DevOps' },
  { keyword: 'socket.io', category: 'Backend' },
  { keyword: 'websockets', category: 'Backend' },
  { keyword: 'oauth', category: 'Security' },
  { keyword: 'jwt', category: 'Security' },
  { keyword: 'authentication', category: 'Security' },
  { keyword: 'authorization', category: 'Security' },
  { keyword: 'rbac', category: 'Security' },
  { keyword: 'encryption', category: 'Security' },
  { keyword: 'ssl', category: 'Security' },
  { keyword: 'tls', category: 'Security' },
  { keyword: 'stripe', category: 'Payments' },
  { keyword: 'payment', category: 'Payments' },
  { keyword: 'billing', category: 'Payments' },
  { keyword: 'agile', category: 'Process' },
  { keyword: 'scrum', category: 'Process' },
  { keyword: 'kanban', category: 'Process' },
  { keyword: 'jira', category: 'Process' },
  { keyword: 'confluence', category: 'Process' },
  { keyword: 'code review', category: 'Process' },
  { keyword: 'mentoring', category: 'Soft Skills' },
  { keyword: 'leadership', category: 'Soft Skills' },
  { keyword: 'communication', category: 'Soft Skills' },
  { keyword: 'collaboration', category: 'Soft Skills' },
  { keyword: 'problem solving', category: 'Soft Skills' },
  { keyword: 'critical thinking', category: 'Soft Skills' },
  { keyword: 'teamwork', category: 'Soft Skills' },
  { keyword: 'project management', category: 'Soft Skills' },
  { keyword: 'machine learning', category: 'AI/ML' },
  { keyword: 'deep learning', category: 'AI/ML' },
  { keyword: 'nlp', category: 'AI/ML' },
  { keyword: 'tensorflow', category: 'AI/ML' },
  { keyword: 'pytorch', category: 'AI/ML' },
  { keyword: 'llm', category: 'AI/ML' },
  { keyword: 'openai', category: 'AI/ML' },
  { keyword: 'langchain', category: 'AI/ML' },
  { keyword: 'rag', category: 'AI/ML' },
  { keyword: 'data science', category: 'AI/ML' },
  { keyword: 'data engineering', category: 'AI/ML' },
  { keyword: 'etl', category: 'AI/ML' },
  { keyword: 'airflow', category: 'AI/ML' },
  { keyword: 'spark', category: 'AI/ML' },
  { keyword: 'kafka', category: 'Backend' },
  { keyword: 'rabbitmq', category: 'Backend' },
  { keyword: 'pub/sub', category: 'Backend' },
  { keyword: 'message queue', category: 'Backend' },
  { keyword: 'event-driven', category: 'Backend' },
  { keyword: 'redux', category: 'Frontend' },
  { keyword: 'tanstack query', category: 'Frontend' },
  { keyword: 'react query', category: 'Frontend' },
  { keyword: 'swr', category: 'Frontend' },
  { keyword: 'react hook form', category: 'Frontend' },
  { keyword: 'framer motion', category: 'Frontend' },
  { keyword: 'gsap', category: 'Frontend' },
  { keyword: 'three.js', category: 'Frontend' },
  { keyword: 'd3.js', category: 'Frontend' },
  { keyword: 'chart.js', category: 'Frontend' },
  { keyword: 'monaco editor', category: 'Frontend' },
  { keyword: 'codemirror', category: 'Frontend' },
  { keyword: 'excel', category: 'Tools' },
  { keyword: 'google sheets', category: 'Tools' },
  { keyword: 'tableau', category: 'Tools' },
  { keyword: 'power bi', category: 'Tools' },
  { keyword: 'looker', category: 'Tools' },
]

const PROPER_CASE: Record<string, string> = {
  react: 'React', 'react.js': 'React.js', reactjs: 'ReactJS',
  'next.js': 'Next.js', nextjs: 'NextJS',
  vue: 'Vue', 'vue.js': 'Vue.js', angular: 'Angular', svelte: 'Svelte',
  typescript: 'TypeScript', javascript: 'JavaScript', js: 'JS', ts: 'TS',
  python: 'Python', java: 'Java', go: 'Go', golang: 'Golang',
  rust: 'Rust', ruby: 'Ruby', php: 'PHP',
  'c#': 'C#', csharp: 'C#', 'c++': 'C++', cpp: 'C++',
  swift: 'Swift', kotlin: 'Kotlin', scala: 'Scala', dart: 'Dart',
  'node.js': 'Node.js', nodejs: 'Node.js',
  express: 'Express', django: 'Django', flask: 'Flask',
  spring: 'Spring', 'spring boot': 'Spring Boot',
  rails: 'Rails', laravel: 'Laravel', 'asp.net': 'ASP.NET',
  fastapi: 'FastAPI', graphql: 'GraphQL',
  rest: 'REST', 'rest api': 'REST API', api: 'API',
  grpc: 'gRPC', microservices: 'Microservices',
  serverless: 'Serverless',
  aws: 'AWS', 'amazon web services': 'Amazon Web Services',
  azure: 'Azure', gcp: 'GCP', 'google cloud': 'Google Cloud', cloud: 'Cloud',
  docker: 'Docker', kubernetes: 'Kubernetes', k8s: 'K8s',
  terraform: 'Terraform', jenkins: 'Jenkins',
  'ci/cd': 'CI/CD', 'ci cd': 'CI/CD',
  'github actions': 'GitHub Actions', 'gitlab ci': 'GitLab CI',
  ansible: 'Ansible', puppet: 'Puppet', chef: 'Chef',
  helm: 'Helm', prometheus: 'Prometheus', grafana: 'Grafana', datadog: 'Datadog',
  mongodb: 'MongoDB', mongo: 'MongoDB',
  postgresql: 'PostgreSQL', postgres: 'PostgreSQL',
  mysql: 'MySQL', sql: 'SQL',
  redis: 'Redis', elasticsearch: 'Elasticsearch',
  dynamodb: 'DynamoDB', firestore: 'Firestore',
  cassandra: 'Cassandra', sqlite: 'SQLite',
  prisma: 'Prisma', typeorm: 'TypeORM', sequelize: 'Sequelize', mongoose: 'Mongoose',
  html: 'HTML', css: 'CSS',
  sass: 'Sass', less: 'Less',
  tailwind: 'Tailwind', 'tailwind css': 'Tailwind CSS',
  bootstrap: 'Bootstrap', 'material ui': 'Material UI',
  shadcn: 'shadcn/ui', figma: 'Figma',
  'responsive design': 'Responsive Design',
  webpack: 'Webpack', vite: 'Vite', babel: 'Babel',
  redux: 'Redux', zustand: 'Zustand', mobx: 'MobX', recoil: 'Recoil',
  jest: 'Jest', vitest: 'Vitest', mocha: 'Mocha',
  cypress: 'Cypress', playwright: 'Playwright', puppeteer: 'Puppeteer',
  selenium: 'Selenium', junit: 'JUnit', pytest: 'pytest',
  'unit testing': 'Unit Testing', 'integration testing': 'Integration Testing',
  e2e: 'E2E', tdd: 'TDD',
  git: 'Git', github: 'GitHub', gitlab: 'GitLab',
  linux: 'Linux', unix: 'Unix', bash: 'Bash', shell: 'Shell',
  npm: 'npm', yarn: 'Yarn', pnpm: 'pnpm',
  eslint: 'ESLint', prettier: 'Prettier', postman: 'Postman',
  nginx: 'Nginx', apache: 'Apache',
  'socket.io': 'Socket.IO', websockets: 'WebSockets',
  oauth: 'OAuth', jwt: 'JWT',
  authentication: 'Authentication', authorization: 'Authorization',
  rbac: 'RBAC', encryption: 'Encryption', ssl: 'SSL', tls: 'TLS',
  stripe: 'Stripe', payment: 'Payment', billing: 'Billing',
  agile: 'Agile', scrum: 'Scrum', kanban: 'Kanban',
  jira: 'Jira', confluence: 'Confluence',
  'code review': 'Code Review', mentoring: 'Mentoring',
  leadership: 'Leadership', communication: 'Communication',
  collaboration: 'Collaboration', 'problem solving': 'Problem Solving',
  'critical thinking': 'Critical Thinking', teamwork: 'Teamwork',
  'project management': 'Project Management',
  'machine learning': 'Machine Learning', 'deep learning': 'Deep Learning',
  nlp: 'NLP', tensorflow: 'TensorFlow', pytorch: 'PyTorch',
  llm: 'LLM', openai: 'OpenAI', langchain: 'LangChain',
  rag: 'RAG', 'data science': 'Data Science',
  'data engineering': 'Data Engineering', etl: 'ETL',
  airflow: 'Airflow', spark: 'Spark',
  kafka: 'Kafka', rabbitmq: 'RabbitMQ', 'pub/sub': 'Pub/Sub',
  'message queue': 'Message Queue', 'event-driven': 'Event-Driven',
  'tanstack query': 'TanStack Query', 'react query': 'React Query',
  swr: 'SWR', 'react hook form': 'React Hook Form',
  'framer motion': 'Framer Motion', gsap: 'GSAP',
  'three.js': 'Three.js', 'd3.js': 'D3.js',
  'chart.js': 'Chart.js', 'monaco editor': 'Monaco Editor',
  codemirror: 'CodeMirror',
  excel: 'Excel', 'google sheets': 'Google Sheets',
  tableau: 'Tableau', 'power bi': 'Power BI', looker: 'Looker',
}

function normalizeKeyword(kw: string): string {
  return kw.toLowerCase().replace(/[^a-z0-9.#+]/g, ' ').replace(/\s+/g, ' ').trim()
}

function toProperName(keyword: string): string {
  const lower = keyword.toLowerCase()
  return PROPER_CASE[lower] || keyword
}

function splitIntoSections(text: string): JDSection[] {
  const lines = text.split('\n')
  const sections: JDSection[] = []
  let current: JDSection | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (current) current.lines.push('')
      continue
    }

    let matched = false
    for (const header of SECTION_HEADERS) {
      for (const pattern of header.patterns) {
        if (pattern.test(line)) {
          if (current) sections.push(current)
          current = { heading: line, body: '', lines: [], classification: header.type }
          matched = true
          break
        }
      }
      if (matched) break
    }

    if (!matched) {
      if (!current) {
        current = { heading: '', body: '', lines: [], classification: 'unknown' }
      }
      current.lines.push(line)
    }
  }

  if (current) sections.push(current)

  for (const section of sections) {
    section.body = section.lines.join('\n').trim()
  }

  return sections
}

function extractSkillsFromText(text: string): Set<string> {
  const found = new Set<string>()
  const normalized = text.toLowerCase()

  for (const entry of TECH_KEYWORDS) {
    const nk = normalizeKeyword(entry.keyword)
    if (normalized.includes(nk)) {
      found.add(toProperName(entry.keyword))
    }
  }

  return found
}

function extractSkillsFromSections(
  sections: JDSection[],
  mainText: string,
): { requiredSkills: string[]; niceToHaveSkills: string[] } {
  const required = new Set<string>()
  const preferred = new Set<string>()

  for (const section of sections) {
    const skills = extractSkillsFromText(section.body)
    if (section.classification === 'requirements') {
      for (const s of skills) required.add(s)
    } else if (section.classification === 'preferred') {
      for (const s of skills) preferred.add(s)
    }
  }

  const mainSkills = extractSkillsFromText(mainText)
  const alreadyClassified = new Set([...required, ...preferred])
  for (const s of mainSkills) {
    if (!alreadyClassified.has(s)) {
      const lower = mainText.toLowerCase()
      const idx = lower.indexOf(s.toLowerCase())
      if (idx >= 0) {
        const before = mainText.substring(Math.max(0, idx - 60), idx).toLowerCase()
        if (before.includes('prefer') || before.includes('nice') || before.includes('bonus') || before.includes('plus')) {
          preferred.add(s)
        } else {
          required.add(s)
        }
      } else {
        required.add(s)
      }
    }
  }

  return {
    requiredSkills: [...required],
    niceToHaveSkills: [...preferred],
  }
}

function extractRole(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i]
    const patterns = [
      /^(software|frontend|backend|full.?stack|devops|data|machine learning|cloud|site reliability|security|mobile|ios|android|web|platform|staff|principal|senior|lead|junior).{0,60}(engineer|developer|architect|manager|scientist|analyst|designer|intern)/i,
      /^([\w\s-]+)\s+(engineer|developer|architect|manager|scientist|analyst|designer|intern)(\s|$)/i,
    ]
    for (const pat of patterns) {
      const m = line.match(pat)
      if (m) return m[0].trim().replace(/,$/, '')
    }
  }
  return ''
}

function extractCompany(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const companyIndicators = [
    /^about\s+(us|the company)\s*:?\s*(.+)/i,
    /^company\s*:?\s*(.+)/i,
    /^at\s+([\w\s.]+)(,\s*(inc|llc|ltd|corp))?/i,
    /([\w\s]+)\s+(is hiring|is looking for|is seeking|has an opening)/i,
  ]

  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i]
    for (const pat of companyIndicators) {
      const m = line.match(pat)
      if (m) {
        const name = m[m.length - 1].trim().replace(/\.$/, '')
        if (name.length > 2 && name.length < 60) return name
      }
    }
  }

  const possibleNames = lines.slice(0, 3).filter(l => l.length > 2 && l.length < 50 && !/\d/.test(l)).map(n => n.replace(/\.$/, ''))
  if (possibleNames.length > 1 && possibleNames[0] !== possibleNames[1]) {
    const role = extractRole(text)
    if (role) {
      const nonRole = possibleNames.filter(n => !role.toLowerCase().includes(n.toLowerCase()) && !n.toLowerCase().includes(role.toLowerCase()))
      if (nonRole.length > 0) return nonRole[0]
    }
  }

  return ''
}

function extractLocation(text: string): string | undefined {
  const patterns = [
    /\b(remote|hybrid|on.?site|in.?office)\b/i,
    /(?:location|locality)\s*[:;]\s*([^,\n]+(?:,\s*[A-Z]{2})?)/i,
    /\b([A-Z][a-z]+(?:[\s-][A-Z][a-z]+)*,\s*(?:[A-Z]{2}|[A-Z][a-z]+(?:\s[A-Z][a-z]+)*))\b/,
  ]

  for (const pat of patterns) {
    const m = text.match(pat)
    if (m) {
      const val = m[1] || m[0]
      if (/^(remote|hybrid|on.?site|in.?office)$/i.test(val)) {
        if (/hybrid/i.test(val)) return 'Hybrid'
        if (/on.?site|in.?office/i.test(val)) return 'On-site'
        return 'Remote'
      }
      return val.trim()
    }
  }

  return undefined
}

function extractExperienceLevel(text: string): string | undefined {
  const lower = text.toLowerCase()
  const scores: { level: string; score: number }[] = []

  for (const entry of EXPERIENCE_LEVELS) {
    let score = 0
    for (const pat of entry.patterns) {
      const matches = lower.match(pat)
      if (matches) score += matches.length
    }
    if (score > 0) scores.push({ level: entry.level, score })
  }

  if (scores.length === 0) return undefined

  scores.sort((a, b) => b.score - a.score)

  if (scores[0].level === 'mid') {
    if (scores.some(s => s.level === 'senior')) return 'senior'
    if (scores.some(s => s.level === 'lead')) return 'lead'
  }

  return scores[0].level
}

function extractResponsibilities(sections: JDSection[], text: string): string[] {
  const items: string[] = []

  for (const section of sections) {
    if (section.classification === 'responsibilities') {
      for (const line of section.lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || /^\d+[.)]/.test(trimmed)) {
          items.push(trimmed.replace(/^[-•*\d.)\s]+/, '').trim())
        }
      }
    }
  }

  if (items.length === 0) {
    const lines = text.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if ((trimmed.startsWith('-') || trimmed.startsWith('•') || trimmed.startsWith('*') || /^\d+[.)]/.test(trimmed)) && trimmed.length > 20) {
        items.push(trimmed.replace(/^[-•*\d.)\s]+/, '').trim())
      }
    }
  }

  return items.slice(0, 10)
}

function extractATSTerms(text: string): string[] {
  const terms = new Set<string>()
  const patterns = [
    /(?:proficient in|experience with|knowledge of|familiar with|expertise in|skilled in|strong (?:knowledge|background|experience) in)\s+([^,.]+)/gi,
    /(?:hands.on|practical)\s+(?:experience|knowledge)\s+(?:with|of|in)\s+([^,.]+)/gi,
    /(?:deep|strong|extensive)\s+(?:understanding|knowledge|expertise)\s+(?:of|in)\s+([^,.]+)/gi,
  ]

  for (const pat of patterns) {
    let m: RegExpExecArray | null
    while ((m = pat.exec(text)) !== null) {
      m[1].split(/[,/]/).map(t => t.trim()).filter(Boolean).forEach(t => {
        if (t.length > 2 && t.length < 60) terms.add(t.toLowerCase())
      })
    }
  }

  return [...terms]
}

function extractRedFlags(text: string): string[] {
  const flags: string[] = []
  for (const entry of RED_FLAGS) {
    if (entry.pattern.test(text)) {
      flags.push(entry.flag)
    }
  }
  return flags
}

function generateSummary(role: string, company: string, requiredSkills: string[], experienceLevel?: string, responsibilities?: string[]): string {
  const parts: string[] = []

  if (role && company) {
    parts.push(`${role} position at ${company}.`)
  } else if (role) {
    parts.push(`${role} position.`)
  }

  if (requiredSkills.length > 0) {
    const topSkills = requiredSkills.slice(0, 5)
    parts.push(`Requires ${topSkills.join(', ')}.`)
  }

  if (experienceLevel) {
    parts.push(`Targets ${experienceLevel}-level candidates.`)
  }

  if (responsibilities && responsibilities.length > 0) {
    parts.push(`Key responsibilities include ${responsibilities.slice(0, 3).join('; ')}.`)
  }

  return parts.length > 0 ? parts.join(' ') : 'Job description parsed successfully.'
}

export function parseJD(jdText: string): ParsedJD {
  const sections = splitIntoSections(jdText)
  const role = extractRole(jdText)
  const company = extractCompany(jdText)
  const { requiredSkills, niceToHaveSkills } = extractSkillsFromSections(sections, jdText)
  const responsibilities = extractResponsibilities(sections, jdText)
  const allText = jdText

  return {
    company: company || 'Target Company',
    role: role || 'Software Engineer',
    location: extractLocation(allText),
    experienceLevel: extractExperienceLevel(allText),
    requiredSkills,
    niceToHaveSkills,
    keywords: [...extractSkillsFromText(allText)],
    atsTerms: extractATSTerms(allText),
    redFlags: extractRedFlags(allText),
    responsibilities,
    summary: generateSummary(role, company, requiredSkills, extractExperienceLevel(allText), responsibilities),
  }
}
