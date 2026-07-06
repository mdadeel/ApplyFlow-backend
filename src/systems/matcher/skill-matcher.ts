export interface SkillScore {
  score: number
  reason: string
  matched: string[]
  missing: string[]
}

function levenshtein(a: string, b: string): number {
  const an = a.length
  const bn = b.length
  if (an === 0) return bn
  if (bn === 0) return an

  const matrix: number[] = []
  for (let i = 0; i <= bn; i++) matrix[i] = i

  for (let i = 1; i <= an; i++) {
    let prev = i
    for (let j = 1; j <= bn; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const val = Math.min(matrix[j] + 1, prev + 1, matrix[j - 1] + cost)
      matrix[j - 1] = prev
      prev = val
    }
    matrix[bn] = prev
  }

  return matrix[bn]
}

function fuzzyMatch(userSkill: string, jobSkill: string): boolean {
  const us = userSkill.toLowerCase().trim()
  const js = jobSkill.toLowerCase().trim()
  return us === js || levenshtein(us, js) <= 2
}

export function computeSkillScore(
  userSkills: string[],
  requiredSkills: string[],
  preferredSkills: string[],
): SkillScore {
  const normalizedUser = userSkills.map(s => s.toLowerCase().trim())

  const matchedRequired = requiredSkills.filter(js =>
    normalizedUser.some(us => fuzzyMatch(us, js)),
  )
  const matchedPreferred = preferredSkills.filter(js =>
    normalizedUser.some(us => fuzzyMatch(us, js)),
  )

  const requiredScore = requiredSkills.length > 0
    ? matchedRequired.length / requiredSkills.length
    : 1.0

  const preferredScore = preferredSkills.length > 0
    ? matchedPreferred.length / preferredSkills.length
    : 0.5

  const score = requiredScore * 0.7 + preferredScore * 0.3

  const missingRequired = requiredSkills.filter(js =>
    !normalizedUser.some(us => fuzzyMatch(us, js)),
  )

  const reason = requiredSkills.length > 0
    ? `Matched ${matchedRequired.length}/${requiredSkills.length} required skills`
    : 'No required skills specified'

  return {
    score,
    reason,
    matched: [...matchedRequired, ...matchedPreferred],
    missing: missingRequired,
  }
}
