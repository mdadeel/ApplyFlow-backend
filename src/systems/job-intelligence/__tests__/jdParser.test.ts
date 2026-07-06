import { parseJD } from '../jdParser'

const FULL_JD = `Senior Frontend Engineer
TechCorp Inc.

About the role:
We are looking for a Senior Frontend Engineer to join our team and help build the next generation of our platform. You will work closely with our product and design teams to deliver exceptional user experiences.

Responsibilities:
- Design and implement new user-facing features using React and TypeScript
- Build reusable components and front-end libraries for future use
- Optimize components for maximum performance across web and mobile
- Collaborate with backend engineers to integrate REST APIs and GraphQL
- Mentor junior developers and conduct code reviews

Requirements:
- 5+ years of experience in frontend development
- Strong proficiency in React, TypeScript, and JavaScript
- Experience with state management (Redux or Zustand)
- Familiarity with modern CSS (Tailwind CSS, responsive design)
- Experience with testing frameworks (Jest, Cypress, or Playwright)
- Knowledge of Git and CI/CD pipelines
- Excellent communication and problem-solving skills

Nice to have:
- Experience with Next.js or server-side rendering
- Knowledge of Node.js and Express
- Familiarity with Docker and cloud services (AWS)
- Experience with GraphQL

Benefits:
- Competitive salary and equity package
- Remote-friendly work environment
- Health, dental, and vision insurance
- 401k matching`

describe('parseJD', () => {
  describe('basic extraction', () => {
    it('extracts role from a full JD', () => {
      const result = parseJD(FULL_JD)
      expect(result.role).toMatch(/frontend/i)
      expect(result.role).toMatch(/engineer/i)
    })

    it('extracts company name', () => {
      const result = parseJD(FULL_JD)
      expect(result.company).toBe('TechCorp Inc')
    })

    it('extracts location', () => {
      const result = parseJD(FULL_JD)
      expect(result.location).toMatch(/remote/i)
    })

    it('extracts experience level', () => {
      const result = parseJD(FULL_JD)
      expect(result.experienceLevel).toBe('senior')
    })
  })

  describe('skill extraction and classification', () => {
    it('extracts required skills from requirements section', () => {
      const result = parseJD(FULL_JD)
      expect(result.requiredSkills).toContain('React')
      expect(result.requiredSkills).toContain('TypeScript')
      expect(result.requiredSkills).toContain('JavaScript')
      expect(result.requiredSkills).toContain('Tailwind CSS')
      expect(result.requiredSkills).toContain('Redux')
      expect(result.requiredSkills).toContain('Git')
      expect(result.requiredSkills).toContain('Jest')
      expect(result.requiredSkills).toContain('Cypress')
    })

    it('extracts nice-to-have skills from preferred section', () => {
      const result = parseJD(FULL_JD)
      expect(result.niceToHaveSkills).toContain('Next.js')
      expect(result.niceToHaveSkills).toContain('Node.js')
      expect(result.niceToHaveSkills).toContain('Express')
      expect(result.niceToHaveSkills).toContain('Docker')
      expect(result.niceToHaveSkills).toContain('GraphQL')
      expect(result.niceToHaveSkills).toContain('AWS')
    })
  })

  describe('responsibilities', () => {
    it('extracts responsibilities bullet points', () => {
      const result = parseJD(FULL_JD)
      expect(result.responsibilities.length).toBeGreaterThanOrEqual(4)
      expect(result.responsibilities.some(r => r.toLowerCase().includes('react'))).toBe(true)
      expect(result.responsibilities.some(r => r.toLowerCase().includes('typescript'))).toBe(true)
      expect(result.responsibilities.some(r => r.toLowerCase().includes('mentor'))).toBe(true)
    })
  })

  describe('ATS terms', () => {
    it('extracts ATS-friendly phrases', () => {
      const result = parseJD(FULL_JD)
      expect(result.atsTerms.length).toBeGreaterThan(0)
      expect(result.atsTerms.some(t => t.includes('jest') || t.includes('git'))).toBe(true)
    })
  })

  describe('keywords', () => {
    it('extracts all tech keywords', () => {
      const result = parseJD(FULL_JD)
      expect(result.keywords).toContain('React')
      expect(result.keywords).toContain('TypeScript')
      expect(result.keywords).toContain('Node.js')
      expect(result.keywords).toContain('Docker')
      expect(result.keywords).toContain('GraphQL')
    })
  })

  describe('summary', () => {
    it('generates a summary from extracted fields', () => {
      const result = parseJD(FULL_JD)
      expect(result.summary.length).toBeGreaterThan(10)
      expect(result.summary.toLowerCase()).toMatch(/frontend/i)
      expect(result.summary.toLowerCase()).toMatch(/engineer/i)
    })
  })

  describe('empty or minimal input', () => {
    it('returns defaults for empty string', () => {
      const result = parseJD('')
      expect(result.company).toBe('Target Company')
      expect(result.role).toBe('Software Engineer')
      expect(result.requiredSkills).toEqual([])
      expect(result.niceToHaveSkills).toEqual([])
      expect(result.responsibilities).toEqual([])
    })

    it('handles minimal text with just a role', () => {
      const result = parseJD('Looking for a React Developer to join our team.')
      expect(result.role).not.toBe('')
      expect(result.requiredSkills).toContain('React')
    })
  })

  describe('skill classification by context', () => {
    it('classifies skills before prefer/nice keywords as nice-to-have', () => {
      const jd = `Role: Engineer
Requirements:
- Knowledge of React
- Experience with Node.js
Preferred:
- TypeScript experience
- Docker knowledge`
      const result = parseJD(jd)
      expect(result.requiredSkills).toContain('React')
      expect(result.requiredSkills).toContain('Node.js')
      expect(result.niceToHaveSkills).toContain('TypeScript')
      expect(result.niceToHaveSkills).toContain('Docker')
    })
  })

  describe('location extraction', () => {
    it('extracts remote keyword', () => {
      const result = parseJD('Remote position available. React developer needed.')
      expect(result.location).toBe('Remote')
    })

    it('extracts hybrid keyword', () => {
      const result = parseJD('Hybrid role based in San Francisco.')
      expect(result.location).toBe('Hybrid')
    })
  })

  describe('experience level detection', () => {
    it('detects senior level', () => {
      const result = parseJD('Senior Software Engineer position requiring 5+ years of experience.')
      expect(result.experienceLevel).toBe('senior')
    })

    it('detects junior level', () => {
      const result = parseJD('Junior developer role for early career candidates.')
      expect(result.experienceLevel).toBe('entry')
    })

    it('detects internship', () => {
      const result = parseJD('Software Engineer Intern for summer 2024.')
      expect(result.experienceLevel).toBe('internship')
    })
  })

  describe('red flag detection', () => {
    it('detects unpaid position flag', () => {
      const result = parseJD('This is an unpaid internship position.')
      expect(result.redFlags).toContain('Unpaid position')
    })

    it('detects contract-to-hire flag', () => {
      const result = parseJD('Contract to hire position for the right candidate.')
      expect(result.redFlags).toContain('Contract-to-hire')
    })

    it('returns no red flags for clean JD', () => {
      const result = parseJD(FULL_JD)
      expect(result.redFlags).toEqual([])
    })
  })
})
