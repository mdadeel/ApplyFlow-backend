import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { JDAnalysis } from '../../models/JDAnalysis'
import { Skill } from '../../models/Skill'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { parseJD } from './jdParser'
import { extractKeywords, extractATSTerms } from './keywordExtractor'
import { calculateMatchScore } from './matchScorer'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { analyzeJdSchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/analyze', validate(analyzeJdSchema), async (req: Request, res: Response) => {
  const { jdText } = req.body
  const jdHash = crypto.createHash('md5').update(jdText).digest('hex')
  const existing = await JDAnalysis.findOne({ userId: req.userId, jdHash })
  if (existing) { sendSuccess(res, existing); return }

  const [aiResult, deterministic] = await Promise.all([
    getAIProvider().analyzeJD(jdText),
    parseJD(jdText),
  ])

  const userSkills = await Skill.find({ userId: req.userId })
  const userSkillList = userSkills.map(s => ({ name: s.name, category: s.category, level: s.level }))

  const combinedRequired = deterministic.requiredSkills.length > 0
    ? deterministic.requiredSkills
    : aiResult.requiredSkills

  const combinedNiceToHave = deterministic.niceToHaveSkills.length > 0
    ? deterministic.niceToHaveSkills
    : aiResult.niceToHaveSkills

  const combinedKeywords = [...new Set([
    ...extractKeywords(jdText),
    ...aiResult.keywords,
    ...deterministic.keywords,
  ])]

  const combinedAtsTerms = [...new Set([
    ...extractATSTerms(jdText),
    ...aiResult.atsTerms,
    ...deterministic.atsTerms,
  ])]

  const combinedRedFlags = [...new Set([
    ...aiResult.redFlags,
    ...deterministic.redFlags,
  ])]

  const matchScore = calculateMatchScore(userSkillList, combinedRequired)

  const analysis = await JDAnalysis.create({
    userId: req.userId,
    jdHash,
    rawText: jdText,
    company: deterministic.company !== 'Target Company' ? deterministic.company : aiResult.company,
    role: deterministic.role !== 'Software Engineer' ? deterministic.role : aiResult.role,
    location: deterministic.location || aiResult.location,
    experienceLevel: deterministic.experienceLevel || aiResult.experienceLevel,
    requiredSkills: combinedRequired,
    niceToHaveSkills: combinedNiceToHave,
    keywords: combinedKeywords,
    atsTerms: combinedAtsTerms,
    redFlags: combinedRedFlags,
    matchScore,
    summary: aiResult.summary,
  })
  sendSuccess(res, analysis, 201)
})

export default router
