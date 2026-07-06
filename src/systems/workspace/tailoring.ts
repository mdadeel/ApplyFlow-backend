import { getAIProvider } from '../ai'

interface TailoringInput {
  resumeContent: string
  jobTitle: string
  company: string
  description: string
  requiredSkills: string[]
  preferredSkills: string[]
}

export async function tailorResume(input: TailoringInput): Promise<string> {
  const prompt = `You are an expert resume writer. Tailor the following resume for a specific job application.

JOB TITLE: ${input.jobTitle}
COMPANY: ${input.company}
JOB DESCRIPTION:
${input.description.slice(0, 4000)}

REQUIRED SKILLS: ${input.requiredSkills.join(', ')}
PREFERRED SKILLS: ${input.preferredSkills.join(', ')}

CURRENT RESUME:
${input.resumeContent.slice(0, 5000)}

INSTRUCTIONS:
1. Rewrite the resume to highlight experience most relevant to this role.
2. Naturally incorporate keywords from the required skills throughout.
3. Reorder sections so the most relevant experience appears first.
4. Use strong action verbs and quantify achievements where possible.
5. Keep it to one page.
6. Do NOT fabricate experience, titles, or dates.
7. Return ONLY the tailored resume text, no explanation.`

  const provider = getAIProvider()
  const response = await provider.generateText(prompt, 0.5, false)
  return response.trim()
}
