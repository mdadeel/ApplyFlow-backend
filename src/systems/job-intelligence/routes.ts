import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { JDAnalysis } from '../../models/JDAnalysis'
import { Skill } from '../../models/Skill'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { extractKeywords, categorizeSkills, extractATSTerms } from './keywordExtractor'
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
  const ai = getAIProvider()
  const aiResult = await ai.analyzeJD(jdText)
  const textKeywords = extractKeywords(jdText)
  const userSkills = await Skill.find({ userId: req.userId })
  const allSkillNames = userSkills.map(s => s.name)
  const categorized = categorizeSkills(jdText, allSkillNames.length ? allSkillNames : aiResult.requiredSkills)
  const atsTerms = extractATSTerms(jdText)
  const matchScore = calculateMatchScore(
    userSkills.map(s => ({ name: s.name, category: s.category, level: s.level })),
    aiResult.requiredSkills,
  )
  const analysis = await JDAnalysis.create({
    userId: req.userId,
    jdHash,
    rawText: jdText,
    company: aiResult.company,
    role: aiResult.role,
    location: aiResult.location,
    experienceLevel: aiResult.experienceLevel,
    requiredSkills: categorized.required.length ? categorized.required : aiResult.requiredSkills,
    niceToHaveSkills: categorized.niceToHave.length ? categorized.niceToHave : aiResult.niceToHaveSkills,
    keywords: [...new Set([...textKeywords, ...aiResult.keywords])],
    atsTerms: [...new Set([...atsTerms, ...aiResult.atsTerms])],
    redFlags: aiResult.redFlags,
    matchScore,
    summary: aiResult.summary,
  })
  sendSuccess(res, analysis, 201)
})

export default router
