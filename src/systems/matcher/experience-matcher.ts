export interface ExperienceScore {
  score: number
  reason: string
}

const LEVEL_HIERARCHY: Record<string, number> = {
  intern: 0,
  entry: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  executive: 5,
}

export function computeExperienceScore(
  userYears: number | undefined,
  requiredYears: number | undefined,
  userLevel: string | undefined,
  requiredLevel: string | undefined,
): ExperienceScore {
  if (!requiredYears && !requiredLevel) {
    return { score: 1.0, reason: 'No experience requirements specified' }
  }

  let yearScore = 1.0
  if (requiredYears !== undefined) {
    const uy = userYears ?? 0
    if (uy >= requiredYears) {
      yearScore = uy >= requiredYears * 2 ? 0.9 : 1.0
    } else {
      yearScore = requiredYears > 0 ? uy / requiredYears : 1.0
    }
  }

  let levelScore = 1.0
  if (requiredLevel && userLevel) {
    const userLev = LEVEL_HIERARCHY[userLevel.toLowerCase()] ?? -1
    const reqLev = LEVEL_HIERARCHY[requiredLevel.toLowerCase()] ?? -1
    if (userLev >= 0 && reqLev >= 0) {
      const diff = userLev - reqLev
      if (diff === 0) levelScore = 1.0
      else if (diff === 1) levelScore = 0.9
      else if (diff >= 2) levelScore = 0.7
      else if (diff === -1) levelScore = 0.6
      else levelScore = 0.3
    }
  }

  const score = yearScore * 0.6 + levelScore * 0.4

  const parts: string[] = []
  if (requiredYears !== undefined) parts.push(`${userYears ?? 0}y vs ${requiredYears}y required`)
  if (requiredLevel) parts.push(`level: ${userLevel ?? 'unknown'} vs ${requiredLevel}`)

  return {
    score,
    reason: parts.length > 0 ? parts.join(', ') : 'Experience match',
  }
}
