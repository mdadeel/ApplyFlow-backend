import { AIProvider } from './aiProvider'

export class MockAIProvider implements AIProvider {
  async generateText(prompt: string): Promise<string> {
    // When using the mock provider (AI_PROVIDER=mock), use basic heuristics
    // to extract whatever is in the text rather than returning empty data.
    // This is not as good as a real LLM, but avoids silently returning nothing.
    const resumeText = prompt.includes('Resume text:')
      ? prompt.split('Resume text:').pop()?.trim() || ''
      : ''

    // Very basic extraction: the first line that looks like a name
    const lines = resumeText.split('\n').map(l => l.trim()).filter(Boolean)
    const guessedName = lines.length > 0 && lines[0].length < 60
      ? lines[0].replace(/^[•\-*#]+\s*/, '').trim()
      : null

    return JSON.stringify({
      personal: { name: guessedName, title: null, summary: resumeText.slice(0, 2000) || null },
      experiences: [],
      projects: [],
      skills: [],
      education: [],
      certificates: [],
    })
  }

  async analyzeJD(jdText: string) {
    const extract = (pattern: RegExp, fallback: string) => {
      const m = jdText.match(pattern)
      return m ? m[1] || m[0] : fallback
    }
    const company = extract(/(?:at|for|with)\s+([A-Z][A-Za-z0-9\s]+?)(?:\.|,|\s+is|\s+we|\n)/, 'Target Company')
    const roleMatch = jdText.match(/(?:Senior|Junior|Mid|Lead|Principal|Staff)\s+([A-Za-z\s]+?)(?: at| -| –|\s+\||\n|\.)/i)
    const role = roleMatch ? roleMatch[0].trim().replace(/\.$/, '') : 'Software Engineer'

    return {
      company,
      role,
      location: extract(/Location:\s*([^.\n]+)/, 'Remote'),
      experienceLevel: (extract(/(Senior|Junior|Mid|Lead|Principal|Staff)/i, 'Mid')).toLowerCase(),
      requiredSkills: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'Git'],
      niceToHaveSkills: ['Docker', 'AWS', 'GraphQL', 'Redis'],
      keywords: ['frontend', 'full-stack', 'agile', 'CI/CD', 'REST APIs', 'unit testing'],
      atsTerms: ['React', 'TypeScript', 'Node.js', 'MongoDB', 'Git', 'CI/CD', 'REST', 'Agile'],
      redFlags: [],
      summary: `We are looking for a ${role} to join ${company}. The ideal candidate has experience building modern web applications.`,
    }
  }

  async generateSummary(profile: any, jd: any) {
    const name = profile.name || 'Candidate'
    return `${name} is a results-driven ${jd.role || 'software engineer'} with expertise in building scalable web applications. Proven track record of delivering high-quality solutions using modern technologies.`
  }

  async optimizeBullets(experiences: any[], jdKeywords: string[]) {
    return experiences.map(exp => ({
      ...exp.toObject(),
      responsibilities: exp.responsibilities?.length
        ? exp.responsibilities
        : ['Contributed to team projects using relevant technologies'],
    }))
  }

  async generateEmail(jd: any, resume: any, tone: string) {
    return {
      subject: `Application for ${jd.role} position at ${jd.company}`,
      body: `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${jd.role} position at ${jd.company}. With my background in software development and passion for building great products, I am confident I would be a valuable addition to your team.\n\nI have attached my resume for your review and welcome the opportunity to discuss how my skills align with your needs.\n\nBest regards,\n${resume.name || 'Applicant'}`,
    }
  }

  async generateCoverLetter(jd: any, profile: any) {
    return `Dear Hiring Manager,\n\nI am excited to apply for the ${jd.role} position at ${jd.company}. Your commitment to innovation aligns with my professional values and career aspirations.\n\nThroughout my career, I have developed strong skills in software development, with particular expertise in building modern web applications. I thrive in collaborative environments where I can contribute to meaningful projects.\n\nI look forward to the possibility of discussing how my experience and skills can benefit ${jd.company}.\n\nSincerely,\n${profile.name || 'Applicant'}`
  }

  async validateHumanization(text: string) {
    return { score: 85, passed: true, issues: [] }
  }

  async validateRecruiter(text: string) {
    return { score: 80, passed: true, issues: [] }
  }

  async checkGrammar(text: string) {
    return { score: 95, passed: true, issues: [] }
  }

  async generateQuestions(jd: any, profile: any) {
    return [
      { question: `Tell me about your experience with ${jd.requiredSkills?.[0] || 'React'}`, type: 'behavioral' },
      { question: 'Describe a challenging project you worked on and how you overcame obstacles.', type: 'behavioral' },
      { question: `How do you stay current with ${jd.role || 'industry'} trends?`, type: 'general' },
      { question: 'Tell me about a time you had to collaborate with cross-functional teams.', type: 'behavioral' },
      { question: `What interests you about working at ${jd.company || 'our company'}?`, type: 'general' },
    ]
  }

  async researchCompany(company: string) {
    return `${company} is a technology company focused on delivering innovative solutions. They value engineering excellence, collaboration, and continuous learning.`
  }

  async buildStar(experience: any, question: string) {
    return {
      situation: `While working as ${experience.role || 'a developer'} at ${experience.company || 'a tech company'}`,
      task: 'The team needed to deliver a critical feature within a tight deadline',
      action: 'Led the implementation, coordinated with stakeholders, and ensured code quality through reviews',
      result: 'Successfully delivered the feature on time, receiving positive feedback from stakeholders',
    }
  }

  async generateTalkingPoints(jd: any, profile: any) {
    return [
      `Strong background in ${(jd.requiredSkills || []).slice(0, 3).join(', ')}`,
      'Experience with agile methodologies and cross-functional teams',
      'Proven track record of delivering high-quality software',
    ]
  }
}
