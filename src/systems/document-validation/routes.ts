import { Router, Request, Response } from 'express'
import { ResumeVersion } from '../../models/ResumeVersion'
import { ValidationReport } from '../../models/ValidationReport'
import { JDAnalysis } from '../../models/JDAnalysis'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { validateATS } from './atsValidator'
import { validateTruthAgainstDb } from './truthValidator'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import { validateResumeSchema } from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

router.post('/', validate(validateResumeSchema), async (req: Request, res: Response) => {
  const { resumeVersionId } = req.body
  const version = await ResumeVersion.findOne({ _id: resumeVersionId, userId: req.userId })
  if (!version) throw new AppError(404, 'Resume version not found')
  const jdAnalysis = version.strategySnapshot?.jdAnalysisId
    ? await JDAnalysis.findById(version.strategySnapshot.jdAnalysisId)
    : null
  const jdKeywords = (jdAnalysis?.keywords || version.strategySnapshot?.jdKeywords || [])
  const ai = getAIProvider()
  const allText = [version.content.summary, ...version.content.experiences.map(e => JSON.stringify(e))].join(' ')

  // ── Deterministic pre-check (Phase 6.4) ──────────────────────────
  // Run fast deterministic validators first. If both pass with high
  // confidence, skip the slower AI-based validators.
  const deterministicATS = validateATS(version.content, jdKeywords)
  const deterministicTruth = await validateTruthAgainstDb(req.userId, version.content)

  const deterministicPassed = deterministicATS.passed && deterministicTruth.passed
  const deterministicHighConfidence = deterministicATS.score >= 80 && deterministicTruth.score >= 80

  let results: Array<{ name: string; score: number; passed: boolean; issues: any[] }>

  if (deterministicPassed && deterministicHighConfidence) {
    // Fast path: skip AI-based validators
    console.log('[Validation] Deterministic pre-check passed with high confidence — skipping AI validators')
    results = [
      { ...deterministicATS },
      { ...deterministicTruth },
    ]
  } else {
    // Full path: run AI-based validators alongside deterministic ones
    console.log('[Validation] Deterministic pre-check borderline or failing — running AI validators')
    const aiResults = await Promise.all([
      Promise.resolve(ai.validateHumanization(allText).then(r => ({ name: 'Humanization', ...r } as any))),
      Promise.resolve(ai.validateRecruiter(allText).then(r => ({ name: 'Recruiter', ...r } as any))),
      Promise.resolve(ai.checkGrammar(allText).then(r => ({ name: 'Grammar', ...r } as any))),
    ])
    results = [
      { ...deterministicATS },
      { ...deterministicTruth },
      ...aiResults,
    ]
  }

  const blocking = ['ATS', 'Truth', 'Grammar']
  const blocked = results.some(r => blocking.includes(r.name) && !r.passed)
  const overallPassed = results.every(r => r.passed)
  const report = await ValidationReport.create({
    userId: req.userId,
    applicationId: version.applicationId,
    resumeVersionId,
    results,
    overallPassed,
    blocked,
  })
  sendSuccess(res, report, 201)
})

export default router
