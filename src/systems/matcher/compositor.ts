import { SkillScore } from './skill-matcher'
import { ExperienceScore } from './experience-matcher'
import { LocationScore } from './location-matcher'
import { SalaryScore } from './salary-matcher'

export interface DimensionScores {
  skill: number
  skillReason: string
  experience: number
  expReason: string
  location: number
  locReason: string
  salary: number
  salReason: string
}

export interface ScoreBreakdown {
  dimension: string
  score: number
  weight: number
  reason: string
}

export interface CompositeScore {
  overallScore: number
  breakdown: ScoreBreakdown[]
}

export const DEFAULT_WEIGHTS = {
  skill: 0.35,
  experience: 0.25,
  location: 0.20,
  salary: 0.20,
}

export function computeOverall(
  skillScore: SkillScore,
  expScore: ExperienceScore,
  locScore: LocationScore,
  salScore: SalaryScore,
  weights: { skill: number; experience: number; location: number; salary: number } = DEFAULT_WEIGHTS,
): CompositeScore {
  const breakdown: ScoreBreakdown[] = [
    { dimension: 'Skills', score: skillScore.score, weight: weights.skill, reason: skillScore.reason },
    { dimension: 'Experience', score: expScore.score, weight: weights.experience, reason: expScore.reason },
    { dimension: 'Location', score: locScore.score, weight: weights.location, reason: locScore.reason },
    { dimension: 'Salary', score: salScore.score, weight: weights.salary, reason: salScore.reason },
  ]

  const overallScore = breakdown.reduce((sum, d) => sum + d.score * d.weight, 0)

  return { overallScore, breakdown }
}
