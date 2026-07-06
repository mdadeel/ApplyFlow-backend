import { Router, Request, Response } from 'express'
import { sessionGuard } from '../identity/sessionGuard'
import { getAIProvider } from '../ai'
import { AppError } from '../../middleware/errorHandler'
import { sendSuccess } from '../../utils/response'
import { validate } from '../../middleware/validate'
import {
  generateEmailSchema,
  generateCoverLetterSchema,
  humanizeTextSchema,
} from '../../utils/validation'

const router = Router()
router.use(sessionGuard)

const SYSTEM_CONTEXT = `You are an expert career coach and resume writer. Your role is to help users create tailored, ATS-friendly, human-sounding job application materials using ONLY their verified career profile.

GOLDEN RULES:
1. NEVER INVENT — No fake companies, roles, dates, metrics, achievements, certifications, or projects
2. SOURCE OF TRUTH — Use ONLY the provided career profile and job analysis
3. NATURAL LANGUAGE — Avoid: "Spearheaded", "Orchestrated", "Leveraged", "Delivered", "Drove", "Additionally", "Furthermore", "Moreover"
4. CLARITY OVER EMBELLISHMENT — Prefer concrete examples over buzzwords
5. ATS KEYWORDS NATURALLY — Include JD keywords in context, not stuffed
6. COMPANY TONE — Mirror the company's language from the JD
7. STRUCTURED OUTPUT ONLY — Return ONLY valid JSON or plain text as specified`

router.post('/email', validate(generateEmailSchema), async (req: Request, res: Response) => {
  const { jdAnalysis, profile, tone = 'professional' } = req.body
  const ai = getAIProvider()

  const prompt = `Generate a professional application email for the following job application.

CANDIDATE PROFILE:
${JSON.stringify(profile, null, 2)}

JOB ANALYSIS:
${JSON.stringify(jdAnalysis, null, 2)}

TONE: ${tone}

INSTRUCTIONS:
- Subject: "Application: {role} at {company}"
- 3-4 sentences max
- Sentence 1: Role applied for + company name + specific reason for interest
- Sentence 2: Top qualification matching JD (include 1 metric + 1 key skill if available in profile)
- Sentence 3: One sentence on culture/values alignment (from JD if available)
- Sentence 4: Call to action (available for conversation)
- Use ONLY information from the profile — never invent metrics or achievements

Return ONLY valid JSON with fields "subject" (string) and "body" (string).`

  const raw = await ai.generateText(prompt, 0.3, true)
  let subject = ''
  let body = ''
  try {
    const parsed = JSON.parse(raw)
    subject = typeof parsed.subject === 'string' ? parsed.subject : `Application for ${jdAnalysis?.role || 'position'} at ${jdAnalysis?.company || 'company'}`
    body = typeof parsed.body === 'string' ? parsed.body : raw
  } catch {
    body = raw
  }
  sendSuccess(res, { subject, content: body })
})

router.post('/cover-letter', validate(generateCoverLetterSchema), async (req: Request, res: Response) => {
  const { jdAnalysis, profile } = req.body
  const ai = getAIProvider()

  const prompt = `Write a concise, genuine cover letter (3 paragraphs) for the role below.

CANDIDATE NAME: ${profile?.name || 'Candidate'}
ROLE: ${jdAnalysis?.role || 'Software Engineer'}
COMPANY: ${jdAnalysis?.company || 'Target Company'}
KEY SKILLS FROM JD: ${JSON.stringify(jdAnalysis?.requiredSkills?.slice(0, 6) || [])}
COMPANY SUMMARY: ${jdAnalysis?.summary || ''}
CANDIDATE EXPERIENCES: ${JSON.stringify(profile?.experiences?.slice(0, 2) || [])}
CANDIDATE PROJECTS: ${JSON.stringify(profile?.projects?.slice(0, 2) || [])}
CANDIDATE SKILLS: ${JSON.stringify(profile?.skills?.slice(0, 10) || [])}

STRUCTURE:
Paragraph 1 (Hook): Why this company + this role. Reference specific company detail (product, mission, tech blog, recent news from JD).
Paragraph 2 (Evidence): 2-3 specific achievements from profile that map to JD requirements. Use metrics from profile only.
Paragraph 3 (Close): Reiterate fit. Mention availability. Professional sign-off.

RULES:
- Use ONLY information present in the provided profile
- Never invent metrics, technologies, or experiences
- Do NOT repeat resume bullets verbatim — tell a story
- Professional, concise tone, natural language
- Return ONLY the letter text, no JSON, no commentary, no labels`

  const raw = await ai.generateText(prompt, 0.3)
  const body = raw.replace(/^["']|["']$/g, '').trim() || `Dear Hiring Manager,\n\nI am excited to apply for the ${jdAnalysis?.role || 'open'} position at ${jdAnalysis?.company || 'your company'}.\n\nMy background aligns closely with the role, and I would welcome the opportunity to contribute to your team.\n\nSincerely,\n${profile?.name || 'Applicant'}`
  sendSuccess(res, { content: body })
})

router.post('/humanize', validate(humanizeTextSchema), async (req: Request, res: Response) => {
  const { text } = req.body
  const ai = getAIProvider()
  const result = await ai.validateHumanization(text)
  const refinedText =
    (result as { text?: string }).text ??
    (result.issues && result.issues.length > 0
      ? `${text}\n\n[Note: ${result.issues.length} humanization issue(s) detected.]`
      : text)
  sendSuccess(res, { text: refinedText })
})

export default router
