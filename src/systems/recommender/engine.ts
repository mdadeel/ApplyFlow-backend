import { User } from '../../models/User'
import { Opportunity } from '../../models/Opportunity'
import { MatchResult, IMatchResult } from '../../models/MatchResult'
import { computeSkillScore } from '../matcher/skill-matcher'
import { computeExperienceScore } from '../matcher/experience-matcher'
import { computeLocationScore } from '../matcher/location-matcher'
import { computeSalaryScore } from '../matcher/salary-matcher'
import { computeOverall, DEFAULT_WEIGHTS } from '../matcher/compositor'
import mongoose from 'mongoose'

export interface RecommendResult {
  results: Array<{
    _id: mongoose.Types.ObjectId
    overallScore: number
    breakdown: IMatchResult['breakdown']
    skillMatched: string[]
    skillMissing: string[]
    opportunityId: mongoose.Types.ObjectId
  }>
  total: number
}

export async function recommendForUser(
  userId: string,
  limit = 20,
): Promise<RecommendResult> {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  const recentlyScored = await MatchResult.find({ userId })
    .select('opportunityId')
    .lean()
  const scoredIds = recentlyScored.map(r => r.opportunityId)

  const opportunities = await Opportunity.find({
    isExpired: false,
    isArchived: false,
    pipelineStatus: 'completed',
    _id: { $nin: scoredIds },
  })
    .limit(50)
    .lean()

  const results = opportunities.map(opp => {
    const skillScore = computeSkillScore(
      user.skills,
      opp.requiredSkills,
      opp.preferredSkills,
    )

    const expScore = computeExperienceScore(
      user.yearsOfExperience,
      opp.minExperience,
      user.currentRole,
      opp.roleLevel,
    )

    const locScore = computeLocationScore(
      user.location,
      user.preferredLocations,
      user.openToRemote,
      user.openToRelocation,
      opp.locationType,
      opp.location,
    )

    const salScore = computeSalaryScore(
      user.minSalary,
      opp.salaryMin,
      opp.salaryMax,
    )

    const composite = computeOverall(skillScore, expScore, locScore, salScore)

    return {
      userId: new mongoose.Types.ObjectId(userId),
      opportunityId: opp._id,
      overallScore: composite.overallScore,
      breakdown: composite.breakdown,
      skillMatched: skillScore.matched,
      skillMissing: skillScore.missing,
    }
  })

  if (results.length > 0) {
    await MatchResult.bulkWrite(
      results.map(r => ({
        updateOne: {
          filter: { userId: r.userId, opportunityId: r.opportunityId },
          update: { $set: r },
          upsert: true,
        },
      })),
    )
  }

  const allMatches = await MatchResult.find({ userId })
    .sort({ overallScore: -1 })
    .limit(limit)
    .populate('opportunityId')
    .lean()

  return {
    results: allMatches.map(m => ({
      _id: m._id,
      overallScore: m.overallScore,
      breakdown: m.breakdown,
      skillMatched: m.skillMatched,
      skillMissing: m.skillMissing,
      opportunityId: m.opportunityId as unknown as mongoose.Types.ObjectId,
    })),
    total: allMatches.length,
  }
}

export async function getStoredMatches(
  userId: string,
  limit = 20,
): Promise<RecommendResult> {
  const matches = await MatchResult.find({ userId })
    .sort({ overallScore: -1 })
    .limit(limit)
    .populate('opportunityId')
    .lean()

  return {
    results: matches.map(m => ({
      _id: m._id,
      overallScore: m.overallScore,
      breakdown: m.breakdown,
      skillMatched: m.skillMatched,
      skillMissing: m.skillMissing,
      opportunityId: m.opportunityId as unknown as mongoose.Types.ObjectId,
    })),
    total: matches.length,
  }
}

export async function matchSingle(
  userId: string,
  opportunityId: string,
): Promise<IMatchResult> {
  const [user, opp] = await Promise.all([
    User.findById(userId),
    Opportunity.findById(opportunityId),
  ])
  if (!user || !opp) throw new Error('User or Opportunity not found')

  const skillScore = computeSkillScore(user.skills, opp.requiredSkills, opp.preferredSkills)
  const expScore = computeExperienceScore(user.yearsOfExperience, opp.minExperience, user.currentRole, opp.roleLevel)
  const locScore = computeLocationScore(user.location, user.preferredLocations, user.openToRemote, user.openToRelocation, opp.locationType, opp.location)
  const salScore = computeSalaryScore(user.minSalary, opp.salaryMin, opp.salaryMax)
  const composite = computeOverall(skillScore, expScore, locScore, salScore)

  const result = await MatchResult.findOneAndUpdate(
    { userId: new mongoose.Types.ObjectId(userId), opportunityId: new mongoose.Types.ObjectId(opportunityId) },
    {
      $set: {
        overallScore: composite.overallScore,
        breakdown: composite.breakdown,
        skillMatched: skillScore.matched,
        skillMissing: skillScore.missing,
      },
    },
    { upsert: true, new: true },
  )

  return result
}
