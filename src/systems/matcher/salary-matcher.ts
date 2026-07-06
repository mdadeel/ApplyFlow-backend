export interface SalaryScore {
  score: number
  reason: string
}

export function computeSalaryScore(
  userMinSalary: number | undefined,
  oppSalaryMin: number | undefined,
  oppSalaryMax: number | undefined,
): SalaryScore {
  if (userMinSalary === undefined || userMinSalary === null) {
    return { score: 0.5, reason: 'Your minimum salary not set' }
  }

  if (oppSalaryMin === undefined && oppSalaryMax === undefined) {
    return { score: 0.5, reason: 'Salary data incomplete' }
  }

  const effectiveMin = oppSalaryMin ?? 0
  const effectiveMax = oppSalaryMax ?? effectiveMin * 1.3
  const midpoint = (effectiveMin + effectiveMax) / 2

  if (userMinSalary <= effectiveMin) {
    return {
      score: 1.0,
      reason: `Salary $${effectiveMin.toLocaleString()}+ meets your minimum`,
    }
  }

  if (userMinSalary <= midpoint) {
    return {
      score: 0.7,
      reason: `Salary range partially meets expectations`,
    }
  }

  const gap = userMinSalary - effectiveMax
  if (gap <= 10000) {
    return {
      score: 0.5,
      reason: `Salary close to your minimum`,
    }
  }

  return {
    score: 0.3,
    reason: `Salary below your $${userMinSalary.toLocaleString()} minimum`,
  }
}
