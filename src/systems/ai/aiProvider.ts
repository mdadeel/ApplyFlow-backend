export interface AIProvider {
  generateText(prompt: string, temperature?: number, formatJson?: boolean): Promise<string>

  analyzeJD(jdText: string): Promise<{
    company: string
    role: string
    location?: string
    experienceLevel?: string
    requiredSkills: string[]
    niceToHaveSkills: string[]
    keywords: string[]
    atsTerms: string[]
    redFlags: string[]
    summary: string
  }>

  generateSummary(profile: any, jd: any): Promise<string>

  optimizeBullets(experiences: any[], jdKeywords: string[]): Promise<any[]>

  generateEmail(jd: any, resume: any, tone: string): Promise<{ subject: string; body: string }>

  generateCoverLetter(jd: any, profile: any): Promise<string>

  validateHumanization(text: string): Promise<{ score: number; passed: boolean; issues: { severity: string; message: string; location?: string }[] }>

  validateRecruiter(text: string): Promise<{ score: number; passed: boolean; issues: { severity: string; message: string; location?: string }[] }>

  checkGrammar(text: string): Promise<{ score: number; passed: boolean; issues: { severity: string; message: string; location?: string }[] }>

  generateQuestions(jd: any, profile: any): Promise<{ question: string; type: string }[]>

  researchCompany(company: string): Promise<string>

  buildStar(experience: any, question: string): Promise<{ situation: string; task: string; action: string; result: string }>

  generateTalkingPoints(jd: any, profile: any): Promise<string[]>
}
