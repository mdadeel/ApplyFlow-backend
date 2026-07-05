import { AIProvider } from './aiProvider'
import { config } from '../../config'
import { validateStarTruth, type StarResult } from './starValidation'

interface OllamaGenerateRequest {
  model: string
  prompt: string
  stream: false
  options?: { temperature?: number }
}

interface OllamaGenerateResponse {
  response: string
  done?: boolean
}

export class OllamaAIProvider implements AIProvider {
  private baseUrl: string
  private model: string

  constructor(baseUrl: string = config.ollamaUrl, model: string = config.ollamaModel) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.model = model
  }

  private async callOllama(prompt: string, temperature: number = config.aiTemperature, formatJson: boolean = false): Promise<string> {
    const body: any = {
      model: this.model,
      prompt,
      stream: false,
      options: { 
        temperature,
        num_predict: 8192,
        num_ctx: 16384
      },
    }
    
    if (formatJson) {
      body.format = 'json'
    }

    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(900000), // 15 minute timeout for large generations
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Ollama request failed (${res.status}): ${text}`)
    }

    const data = (await res.json()) as OllamaGenerateResponse
    return (data.response ?? '').trim()
  }

  private extractJson<T = any>(text: string): T | null {
    if (!text) return null
    // Try direct parse first
    try {
      return JSON.parse(text) as T
    } catch {
      // Try to extract the first JSON object from the response
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        try {
          return JSON.parse(match[0]) as T
        } catch {
          return null
        }
      }
      return null
    }
  }

  async generateText(prompt: string, temperature: number = config.aiTemperature, formatJson: boolean = false): Promise<string> {
    return this.callOllama(prompt, temperature, formatJson)
  }

  private asStringArray(value: any): string[] {
    if (!Array.isArray(value)) return []
    return value.filter(v => typeof v === 'string' && v.trim().length > 0)
  }

  private defaultValidation(text: string) {
    return { score: 75, passed: true, issues: [] as { severity: string; message: string; location?: string }[] }
  }

  async analyzeJD(jdText: string) {
    const prompt = `Analyze the following job description and extract structured information. Return ONLY valid JSON with exactly these fields: company (string), role (string), location (string or null), experienceLevel (string: one of junior, mid, senior, lead, principal, staff or null), requiredSkills (array of strings), niceToHaveSkills (array of strings), keywords (array of strings), atsTerms (array of strings), redFlags (array of strings), summary (string). Do not include any commentary.

Job description:
${jdText}`

    const raw = await this.callOllama(prompt, 0.2, true)
    const parsed = this.extractJson<any>(raw)

    const requiredSkills = this.asStringArray(parsed?.requiredSkills)
    const niceToHaveSkills = this.asStringArray(parsed?.niceToHaveSkills)

    return {
      company: typeof parsed?.company === 'string' ? parsed.company : 'Target Company',
      role: typeof parsed?.role === 'string' ? parsed.role : 'Software Engineer',
      location: typeof parsed?.location === 'string' ? parsed.location : undefined,
      experienceLevel: typeof parsed?.experienceLevel === 'string' ? parsed.experienceLevel.toLowerCase() : undefined,
      requiredSkills: requiredSkills.length ? requiredSkills : ['Communication', 'Problem Solving'],
      niceToHaveSkills,
      keywords: this.asStringArray(parsed?.keywords),
      atsTerms: this.asStringArray(parsed?.atsTerms),
      redFlags: this.asStringArray(parsed?.redFlags),
      summary: typeof parsed?.summary === 'string'
        ? parsed.summary
        : 'Job description parsed successfully. See extracted fields for details.',
    }
  }

  async generateSummary(profile: any, jd: any): Promise<string> {
    const prompt = `Write a 2-3 sentence professional summary for a candidate applying to a job. Return ONLY the summary text, no JSON, no commentary.

Candidate name: ${profile?.name || 'Candidate'}
Candidate background: ${JSON.stringify(profile?.experiences || profile || {})}
Target role: ${jd?.role || 'Software Engineer'}
Target company: ${jd?.company || 'Target Company'}
Key skills from job description: ${JSON.stringify(this.asStringArray(jd?.requiredSkills).slice(0, 6))}`

    const raw = await this.callOllama(prompt, 0.6)
    const cleaned = raw.replace(/^["']|["']$/g, '').trim()
    if (cleaned) return cleaned

    const name = profile?.name || 'Candidate'
    return `${name} is a results-driven ${jd?.role || 'software engineer'} with expertise in building scalable web applications.`
  }

  async optimizeBullets(experiences: any[], jdKeywords: string[]) {
    const keywords = this.asStringArray(jdKeywords).slice(0, 12)
    const prompt = `Rewrite the responsibilities for each experience below to better align with these job keywords: ${keywords.join(', ')}. Return ONLY valid JSON in this format: {"bullets": [{"id": <string>, "responsibilities": ["...", "..."]}]}. Use the original id for each item. Keep bullets concise (under 25 words each), start with strong action verbs, and quantify results where possible.

Experiences:
${JSON.stringify(experiences.map((e: any) => ({
  id: e.id ?? e._id ?? e._id?.toString?.() ?? '',
  role: e.role,
  company: e.company,
  responsibilities: e.responsibilities,
})))}`

    const raw = await this.callOllama(prompt, 0.4, true)
    const parsed = this.extractJson<any>(raw)
    const optimized: Record<string, string[]> = {}
    if (parsed && Array.isArray(parsed.bullets)) {
      for (const b of parsed.bullets) {
        const id = String(b?.id ?? '')
        const resp = this.asStringArray(b?.responsibilities)
        if (id && resp.length) optimized[id] = resp
      }
    }

    return experiences.map((exp: any) => {
      const id = String(exp.id ?? exp._id ?? exp._id?.toString?.() ?? '')
      const responsibilities = optimized[id] || exp.responsibilities?.length
        ? optimized[id] || exp.responsibilities
        : ['Contributed to team projects using relevant technologies']
      return {
        ...exp.toObject(),
        responsibilities,
      }
    })
  }

  async generateEmail(jd: any, resume: any, tone: string) {
    const prompt = `Write a short outreach email applying for a job. Return ONLY valid JSON with fields "subject" and "body". Tone: ${tone || 'professional'}. Keep subject under 60 chars, body under 180 words.

Job: ${jd?.role} at ${jd?.company}
Candidate name: ${resume?.name || 'Applicant'}
Key skills match: ${JSON.stringify(this.asStringArray(jd?.requiredSkills).slice(0, 5))}`

    const raw = await this.callOllama(prompt, 0.6, true)
    const parsed = this.extractJson<any>(raw)

    return {
      subject: typeof parsed?.subject === 'string' && parsed.subject.trim()
        ? parsed.subject.trim()
        : `Application for ${jd?.role || 'the'} position at ${jd?.company || 'your company'}`,
      body: typeof parsed?.body === 'string' && parsed.body.trim()
        ? parsed.body.trim()
        : `Dear Hiring Manager,\n\nI am writing to express my interest in the ${jd?.role || 'open'} position at ${jd?.company || 'your company'}. I would welcome the opportunity to discuss how my background aligns with your needs.\n\nBest regards,\n${resume?.name || 'Applicant'}`,
    }
  }

  async generateCoverLetter(jd: any, profile: any): Promise<string> {
    const prompt = `Write a concise, genuine cover letter (3 short paragraphs) for the role below. Return ONLY the letter text, no JSON, no commentary, no labels.

Candidate name: ${profile?.name || 'Applicant'}
Role: ${jd?.role}
Company: ${jd?.company}
Company summary: ${jd?.summary || ''}
Candidate highlights: ${JSON.stringify(this.asStringArray(jd?.requiredSkills).slice(0, 5))}
Profile background: ${JSON.stringify(profile?.experiences?.slice?.(0, 2) || [])}`

    const raw = await this.callOllama(prompt, 0.6)
    const cleaned = raw.replace(/^["']|["']$/g, '').trim()
    if (cleaned) return cleaned

    return `Dear Hiring Manager,\n\nI am excited to apply for the ${jd?.role || 'open'} position at ${jd?.company || 'your company'}.\n\nMy background aligns closely with the role, and I would welcome the opportunity to contribute to your team.\n\nSincerely,\n${profile?.name || 'Applicant'}`
  }

  async validateHumanization(text: string) {
    const prompt = `Evaluate how human-sounding the following text is on a 0-100 scale. Look for AI-typical patterns: em dashes, buzzwords, generic filler, overly balanced structure. Return ONLY valid JSON: {"score": <0-100>, "passed": <true|false if score>=70>, "issues": [{"severity": "low"|"medium"|"high", "message": "...", "location": "..."}]}.

Text:
${text}`

    const raw = await this.callOllama(prompt, 0.2, true)
    const parsed = this.extractJson<any>(raw)
    if (!parsed) return this.defaultValidation(text)

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 75
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((i: any) => i && typeof i.message === 'string')
          .map((i: any) => ({
            severity: typeof i.severity === 'string' ? i.severity : 'low',
            message: i.message,
            location: typeof i.location === 'string' ? i.location : undefined,
          }))
      : []
    return { score, passed: typeof parsed.passed === 'boolean' ? parsed.passed : score >= 70, issues }
  }

  async validateRecruiter(text: string) {
    const prompt = `Evaluate the following text as if you are a recruiter screening a candidate's application. Score 0-100 based on clarity, relevance, specificity, and impact. Return ONLY valid JSON: {"score": <0-100>, "passed": <true|false if score>=70>, "issues": [{"severity": "low"|"medium"|"high", "message": "...", "location": "..."}]}.

Text:
${text}`

    const raw = await this.callOllama(prompt, 0.2, true)
    const parsed = this.extractJson<any>(raw)
    if (!parsed) return this.defaultValidation(text)

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 75
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((i: any) => i && typeof i.message === 'string')
          .map((i: any) => ({
            severity: typeof i.severity === 'string' ? i.severity : 'low',
            message: i.message,
            location: typeof i.location === 'string' ? i.location : undefined,
          }))
      : []
    return { score, passed: typeof parsed.passed === 'boolean' ? parsed.passed : score >= 70, issues }
  }

  async checkGrammar(text: string) {
    const prompt = `Check the following text for grammar, spelling, and punctuation issues. Return ONLY valid JSON: {"score": <0-100>, "passed": <true|false if score>=80>, "issues": [{"severity": "low"|"medium"|"high", "message": "...", "location": "..."}]}.

Text:
${text}`

    const raw = await this.callOllama(prompt, 0.1, true)
    const parsed = this.extractJson<any>(raw)
    if (!parsed) return this.defaultValidation(text)

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 90
    const issues = Array.isArray(parsed.issues)
      ? parsed.issues
          .filter((i: any) => i && typeof i.message === 'string')
          .map((i: any) => ({
            severity: typeof i.severity === 'string' ? i.severity : 'low',
            message: i.message,
            location: typeof i.location === 'string' ? i.location : undefined,
          }))
      : []
    return { score, passed: typeof parsed.passed === 'boolean' ? parsed.passed : score >= 80, issues }
  }

  async generateQuestions(jd: any, profile: any) {
    const prompt = `Generate 5 thoughtful interview questions for the role below. Mix behavioral, technical, and general types. Return ONLY valid JSON: {"questions": [{"question": "...", "type": "behavioral"|"technical"|"general"}]}.

Role: ${jd?.role}
Company: ${jd?.company}
Key skills: ${JSON.stringify(this.asStringArray(jd?.requiredSkills).slice(0, 6))}
Candidate background: ${JSON.stringify(profile?.experiences?.slice?.(0, 2) || [])}`

    const raw = await this.callOllama(prompt, 0.7, true)
    const parsed = this.extractJson<any>(raw)
    const questions = Array.isArray(parsed?.questions)
      ? parsed.questions
          .filter((q: any) => q && typeof q.question === 'string')
          .map((q: any) => ({
            question: q.question,
            type: ['behavioral', 'technical', 'general'].includes(q.type) ? q.type : 'general',
          }))
      : []

    if (questions.length) return questions

    return [
      { question: `Tell me about your experience with ${this.asStringArray(jd?.requiredSkills)[0] || 'your craft'}`, type: 'behavioral' },
      { question: 'Describe a challenging project you worked on and how you overcame obstacles.', type: 'behavioral' },
      { question: `How do you stay current with ${jd?.role || 'industry'} trends?`, type: 'general' },
    ]
  }

  async researchCompany(company: string): Promise<string> {
    const prompt = `Provide a short, factual overview (3-5 sentences) of the company named "${company}". If you do not know the company, say so plainly. Return only the overview text, no JSON, no headings.`

    const raw = await this.callOllama(prompt, 0.4, false)
    const cleaned = raw.replace(/^["']|["']$/g, '').trim()
    if (cleaned) return cleaned

    return `${company} is a company. Research its products, recent news, and culture before applying.`
  }

  async buildStar(experience: any, question: string) {
    const fallback: StarResult = {
      situation: 'No specific detail provided',
      task: 'No specific detail provided',
      action: 'No specific detail provided',
      result: 'No specific detail provided',
    }

    const prompt = `Build a STAR (Situation, Task, Action, Result) answer for the interview question below.

STRICT RULES — do not violate any of the following:

1. FACT CHECKING: Read the entire Experience object before writing ANYTHING. Every claim you make MUST be traceable to a specific field (company, role, technologies, responsibilities, achievements, metrics, projects) in the provided experience.

2. NO INVENTED DETAILS: Do NOT invent metrics, percentages, dates, team sizes, dollar amounts, tool names, frameworks, programming languages, company names, role titles, or outcomes of any kind. If the experience does not mention a technology, do not include it.

3. NO EMBELLISHMENT: Do not exaggerate scope, impact, or seniority. Use the exact language from the experience — do not upgrade "assisted with" to "led" or "contributed to" to "architected".

4. GENERIC PLACEHOLDER: If the experience object lacks enough detail to write a meaningful paragraph for a section, set that field to the exact string "No specific detail provided". Do not guess, fill in, or extrapolate.

5. OUTPUT FORMAT: Return ONLY valid JSON that exactly matches this shape: {"situation": "...", "task": "...", "action": "...", "result": "..."}. No markdown, no code fences, no commentary before or after.

6. FINAL VERIFICATION: Before returning, re-read your output. For every noun (technology name, role, company, number), verify it appears verbatim in the experience object above. If it does not, replace that sentence with "No specific detail provided".

Each field should be 1-3 sentences.

Question: ${question}

Experience:
${JSON.stringify(experience)}`

    // Use lower temperature to reduce creative hallucination
    const raw = await this.callOllama(prompt, 0.3, true)
    const parsed = this.extractJson<any>(raw)

    const star: StarResult = {
      situation: typeof parsed?.situation === 'string' ? parsed.situation : '',
      task: typeof parsed?.task === 'string' ? parsed.task : '',
      action: typeof parsed?.action === 'string' ? parsed.action : '',
      result: typeof parsed?.result === 'string' ? parsed.result : '',
    }

    // Validate using the standalone validator
    const report = validateStarTruth(star, experience || {})
    if (!report.valid) {
      return fallback
    }

    return star
  }

  async generateTalkingPoints(jd: any, profile: any) {
    const prompt = `Generate 5 concise talking points (one sentence each) a candidate should emphasize in an interview for this role. Return ONLY valid JSON: {"points": ["...", "...", ...]}.

Role: ${jd?.role}
Company: ${jd?.company}
Required skills: ${JSON.stringify(this.asStringArray(jd?.requiredSkills).slice(0, 8))}
Candidate strengths: ${JSON.stringify(profile?.skills || profile?.experiences?.slice?.(0, 2) || [])}`

    const raw = await this.callOllama(prompt, 0.5, true)
    const parsed = this.extractJson<any>(raw)
    const points = this.asStringArray(parsed?.points)
    if (points.length) return points.slice(0, 5)

    const skills = this.asStringArray(jd?.requiredSkills).slice(0, 3).join(', ')
    return [
      skills ? `Strong background in ${skills}` : 'Strong technical foundation',
      'Experience delivering measurable results on cross-functional teams',
      'Clear communication and stakeholder management skills',
    ]
  }
}
