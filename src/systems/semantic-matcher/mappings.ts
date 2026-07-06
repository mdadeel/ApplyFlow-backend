export interface SemanticGroup {
  canonical: string
  aliases: string[]
}

const SEMANTIC_GROUPS: SemanticGroup[] = [
  { canonical: 'Firebase Authentication', aliases: ['firebase auth', 'firebase authentication', 'jwt', 'json web token', 'oauth', 'auth0', 'authentication', 'user auth'] },
  { canonical: 'Stripe', aliases: ['stripe', 'payment gateway', 'payment processing', 'payments', 'billing', 'subscription billing'] },
  { canonical: 'Socket.IO', aliases: ['socket.io', 'socketio', 'real-time communication', 'websockets', 'web sockets', 'realtime', 'live updates'] },
  { canonical: 'REST API', aliases: ['rest api', 'restful api', 'api', 'api endpoint', 'api consumption', 'api integration', 'http api'] },
  { canonical: 'GraphQL', aliases: ['graphql', 'gql', 'graph ql', 'api query language'] },
  { canonical: 'MongoDB', aliases: ['mongodb', 'mongo', 'no sql', 'nosql database', 'document database'] },
  { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'psql', 'sql database', 'relational database'] },
  { canonical: 'Redis', aliases: ['redis', 'cache', 'caching', 'in-memory database', 'key-value store'] },
  { canonical: 'Docker', aliases: ['docker', 'containerization', 'containers', 'docker compose'] },
  { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s', 'container orchestration', 'orchestration'] },
  { canonical: 'CI/CD', aliases: ['ci/cd', 'ci cd', 'continuous integration', 'continuous deployment', 'automated deployment', 'pipeline'] },
  { canonical: 'TypeScript', aliases: ['typescript', 'ts', 'typed javascript', 'static typing'] },
  { canonical: 'JavaScript', aliases: ['javascript', 'js', 'es6', 'ecmascript', 'es2015', 'es2020', 'vanilla js', 'node.js'] },
  { canonical: 'React', aliases: ['react', 'react.js', 'reactjs', 'react native', 'frontend framework', 'ui framework'] },
  { canonical: 'Next.js', aliases: ['next.js', 'nextjs', 'next', 'server side rendering', 'ssr', 'static site generation', 'ssg', 'react framework'] },
  { canonical: 'Node.js', aliases: ['node.js', 'nodejs', 'node', 'express', 'express.js', 'server-side javascript', 'backend javascript'] },
  { canonical: 'Express', aliases: ['express', 'express.js', 'expressjs', 'node web framework', 'http server'] },
  { canonical: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'cloud', 'cloud computing'] },
  { canonical: 'Tailwind CSS', aliases: ['tailwind', 'tailwind css', 'utility css', 'utility-first css'] },
  { canonical: 'Responsive Design', aliases: ['responsive', 'responsive design', 'mobile-first', 'mobile first', 'cross-platform', 'cross platform'] },
  { canonical: 'Git', aliases: ['git', 'version control', 'vcs', 'source control', 'github', 'gitlab'] },
  { canonical: 'Docker', aliases: ['docker', 'container', 'containers', 'containerization', 'docker compose'] },
  { canonical: 'Authentication', aliases: ['authentication', 'auth', 'login', 'sign-in', 'sign in', 'user authentication', 'authorization'] },
  { canonical: 'RBAC', aliases: ['rbac', 'role-based access control', 'role based access control', 'permissions', 'user roles', 'access control'] },
  { canonical: 'Testing', aliases: ['testing', 'test', 'unit test', 'unit testing', 'integration test', 'e2e', 'end-to-end', 'automated testing'] },
  { canonical: 'Performance Optimization', aliases: ['performance', 'optimization', 'performance optimization', 'performance tuning', 'optimizing', 'web vitals'] },
  { canonical: 'State Management', aliases: ['state management', 'redux', 'context api', 'zustand', 'recoil', 'mobx'] },
  { canonical: 'ORM', aliases: ['orm', 'prisma', 'mongoose', 'typeorm', 'sequelize', 'object relational mapping'] },
  { canonical: 'API Design', aliases: ['api design', 'rest api design', 'api architecture', 'endpoint design'] },
  { canonical: 'Serverless', aliases: ['serverless', 'lambda', 'function as a service', 'faas', 'cloud functions'] },
]

const aliasMap = new Map<string, string>()
for (const group of SEMANTIC_GROUPS) {
  for (const alias of group.aliases) {
    aliasMap.set(alias.toLowerCase(), group.canonical)
  }
  aliasMap.set(group.canonical.toLowerCase(), group.canonical)
}

export function resolveCanonical(text: string): string {
  const key = text.toLowerCase().trim()
  return aliasMap.get(key) || text
}

export interface MatchResult {
  canonical: string
  original: string
  matchType: 'exact' | 'alias' | 'none'
}

export function findMatchingTechnologies(tech: string, userTechnologies: string[]): MatchResult[] {
  const results: MatchResult[] = []
  const canonical = resolveCanonical(tech)

  for (const userTech of userTechnologies) {
    const userCanonical = resolveCanonical(userTech)
    if (userCanonical === canonical) {
      results.push({ canonical, original: userTech, matchType: 'exact' })
    } else if (userCanonical.toLowerCase() === canonical.toLowerCase()) {
      results.push({ canonical, original: userTech, matchType: 'alias' })
    }
  }

  if (results.length === 0) {
    results.push({ canonical, original: tech, matchType: 'none' })
  }

  return results
}

export function getSemanticEquivalents(tech: string): string[] {
  const canonical = resolveCanonical(tech)
  const group = SEMANTIC_GROUPS.find(g => g.canonical.toLowerCase() === canonical.toLowerCase())
  if (group) return [group.canonical, ...group.aliases]
  return [tech]
}
