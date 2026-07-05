const techKeywords = [
  'react', 'angular', 'vue', 'typescript', 'javascript', 'node.js', 'node',
  'python', 'java', 'go', 'rust', 'c++', 'c#', 'ruby', 'php', 'swift',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins',
  'mongodb', 'postgresql', 'mysql', 'redis', 'elasticsearch', 'graphql',
  'rest', 'api', 'ci/cd', 'git', 'linux', 'html', 'css', 'sass', 'tailwind',
  'next.js', 'express', 'django', 'flask', 'spring', 'rails', 'laravel',
]

export function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase()
  const found = new Set<string>()
  for (const kw of techKeywords) {
    if (lower.includes(kw)) found.add(kw)
  }
  return [...found]
}

export function categorizeSkills(text: string, skills: string[]): { required: string[]; niceToHave: string[] } {
  const lower = text.toLowerCase()
  const required: string[] = []
  const niceToHave: string[] = []
  for (const s of skills) {
    if (lower.includes(s.toLowerCase())) {
      const precedes = text.substring(0, Math.max(0, lower.indexOf(s.toLowerCase()))).toLowerCase()
      if (precedes.includes('prefer') || precedes.includes('plus') || precedes.includes('nice') || precedes.includes('bonus')) {
        niceToHave.push(s)
      } else {
        required.push(s)
      }
    }
  }
  return { required, niceToHave }
}

export function extractATSTerms(text: string): string[] {
  const lower = text.toLowerCase()
  const terms = new Set<string>()
  const patterns = [
    /(?:proficient in|experience with|knowledge of|familiar with|expertise in)\s+([^,.]+)/gi,
  ]
  for (const pat of patterns) {
    let m: RegExpExecArray | null
    while ((m = pat.exec(text)) !== null) {
      m[1].split(/[,/]/).map(t => t.trim()).filter(Boolean).forEach(t => terms.add(t.toLowerCase()))
    }
  }
  return [...terms]
}
