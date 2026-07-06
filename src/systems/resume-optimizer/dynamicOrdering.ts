export interface JobContext {
  role: string
  requiredSkills: string[]
  preferredSkills: string[]
  responsibilities: string[]
  keywords: string[]
  employmentType: string
  experienceLevel: string
}

const ROLE_PATTERNS: Record<string, string[]> = {
  frontend: ['react', 'next', 'typescript', 'javascript', 'css', 'html', 'tailwind', 'responsive', 'ui', 'ux', 'figma'],
  backend: ['node', 'express', 'python', 'api', 'database', 'sql', 'nosql', 'authentication', 'server'],
  'full-stack': ['react', 'node', 'typescript', 'api', 'database', 'frontend', 'backend', 'authentication'],
  devops: ['docker', 'kubernetes', 'ci/cd', 'aws', 'azure', 'gcp', 'terraform', 'jenkins', 'linux'],
  mobile: ['react native', 'flutter', 'swift', 'ios', 'android', 'mobile', 'kotlin'],
  data: ['python', 'sql', 'machine learning', 'data pipeline', 'etl', 'analytics', 'visualization'],
  saas: ['payments', 'stripe', 'rbac', 'authentication', 'multi-tenant', 'dashboard', 'subscription'],
  enterprise: ['security', 'authentication', 'rbac', 'logging', 'monitoring', 'scalability', 'microservices'],
  startup: ['full-stack', 'mvp', 'rapid', 'product', 'feature', 'iteration', 'agile'],
}

export function inferRoleCategory(role: string): string {
  const lower = role.toLowerCase()
  for (const [category, patterns] of Object.entries(ROLE_PATTERNS)) {
    for (const p of patterns) {
      if (lower.includes(p)) return category
    }
  }
  if (lower.includes('engineer') || lower.includes('developer')) return 'full-stack'
  return 'full-stack'
}

export function prioritizeSkillsByRole(
  skills: Array<{ category: string; items: string[] }>,
  context: JobContext,
): Array<{ category: string; items: string[] }> {
  const category = inferRoleCategory(context.role)
  const roleKeywords = ROLE_PATTERNS[category] || ROLE_PATTERNS['full-stack']
  const jdKeywords = new Set([
    ...context.requiredSkills.map(s => s.toLowerCase()),
    ...context.preferredSkills.map(s => s.toLowerCase()),
    ...context.keywords.map(s => s.toLowerCase()),
  ])

  return skills.map(skillCat => {
    const prioritized = [...skillCat.items].sort((a, b) => {
      const aIsJD = jdKeywords.has(a.toLowerCase()) ? 1 : 0
      const bIsJD = jdKeywords.has(b.toLowerCase()) ? 1 : 0
      if (aIsJD !== bIsJD) return bIsJD - aIsJD

      const aIsRole = roleKeywords.some(r => a.toLowerCase().includes(r)) ? 1 : 0
      const bIsRole = roleKeywords.some(r => b.toLowerCase().includes(r)) ? 1 : 0
      if (aIsRole !== bIsRole) return bIsRole - aIsRole

      return a.localeCompare(b)
    })

    return { ...skillCat, items: prioritized }
  })
}
