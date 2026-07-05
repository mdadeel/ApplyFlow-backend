const categoryWeights: Record<string, number> = {
  Frontend: 1.0,
  Backend: 1.0,
  Database: 0.8,
  Cloud: 0.7,
  DevOps: 0.7,
  Testing: 0.6,
  Languages: 0.9,
  'Soft Skills': 0.3,
}

export function calculateMatchScore(
  userSkills: { name: string; category: string; level: string }[],
  requiredSkills: string[],
): number {
  if (!requiredSkills.length) return 0
  const userSkillNames = new Set(userSkills.map(s => s.name.toLowerCase()))
  const levelScores: Record<string, number> = { Beginner: 0.4, Intermediate: 0.7, Advanced: 0.9, Expert: 1.0 }
  let total = 0; let max = 0
  for (const req of requiredSkills) {
    const weight = 1.0
    max += weight
    if (userSkillNames.has(req.toLowerCase())) {
      const user = userSkills.find(s => s.name.toLowerCase() === req.toLowerCase())
      const level = user ? levelScores[user.level] || 0.7 : 0.7
      total += weight * level
    }
  }
  return max > 0 ? Math.round((total / max) * 100) : 0
}
