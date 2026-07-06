export interface SkillGapResult {
  missingSkills: string[]
  recommendations: string[]
}

function normalize(s: string): string {
  return s.toLowerCase().trim()
}

export function analyzeSkillGap(
  userSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[],
): SkillGapResult {
  const normalizedUser = userSkills.map(normalize)
  const missingSkills: string[] = []

  for (const skill of [...requiredSkills, ...preferredSkills]) {
    const normalized = normalize(skill)
    const isMatch = normalizedUser.some(us => {
      if (us === normalized) return true
      if (us.includes(normalized) || normalized.includes(us)) return true
      return false
    })
    if (!isMatch) missingSkills.push(skill)
  }

  const recommendations: string[] = []
  const hasRequired = requiredSkills.length > 0
  const missingRequired = missingSkills.filter(s => requiredSkills.includes(s))

  if (missingRequired.length > 0) {
    recommendations.push(`Focus on acquiring: ${missingRequired.slice(0, 5).join(', ')}`)
  }

  const otherMissing = missingSkills.filter(s => !requiredSkills.includes(s))
  if (otherMissing.length > 0) {
    recommendations.push(`Consider learning: ${otherMissing.slice(0, 3).join(', ')}`)
  }

  if (missingSkills.length === 0) {
    recommendations.push('Your skill profile covers all listed requirements')
  }

  const grouped = groupByCategory(missingSkills)
  for (const [category, skills] of Object.entries(grouped)) {
    recommendations.push(`${category}: ${skills.join(', ')}`)
  }

  return { missingSkills, recommendations }
}

function groupByCategory(skills: string[]): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    Frontend: ['react', 'angular', 'vue', 'typescript', 'javascript', 'html', 'css', 'tailwind'],
    Backend: ['node', 'python', 'java', 'go', 'rust', 'express', 'django', 'api'],
    Database: ['sql', 'mongodb', 'postgresql', 'mysql', 'redis', 'dynamodb'],
    Cloud: ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd'],
  }

  const groups: Record<string, string[]> = {}
  for (const skill of skills) {
    let categorized = false
    for (const [cat, keywords] of Object.entries(categories)) {
      if (keywords.some(k => skill.toLowerCase().includes(k))) {
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(skill)
        categorized = true
        break
      }
    }
    if (!categorized) {
      if (!groups['General']) groups['General'] = []
      groups['General'].push(skill)
    }
  }

  return groups
}
