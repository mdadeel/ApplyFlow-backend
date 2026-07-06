import { getAIProvider } from '../ai'

interface CoverLetterInput {
  userName: string
  userSummary: string
  userSkills: string[]
  jobTitle: string
  company: string
  description: string
  tailoredResume?: string
}

export async function generateCoverLetter(input: CoverLetterInput): Promise<string> {
  const prompt = `You are an expert cover letter writer. Write a professional, compelling cover letter.

FROM: ${input.userName}
PROFILE SUMMARY: ${input.userSummary || 'Experienced professional'}

KEY SKILLS: ${input.userSkills.join(', ')}

APPLYING FOR: ${input.jobTitle} at ${input.company}

JOB DESCRIPTION:
${input.description.slice(0, 3000)}

${input.tailoredResume ? `TAILORED RESUME HIGHLIGHTS:\n${input.tailoredResume.slice(0, 2000)}` : ''}

INSTRUCTIONS:
1. Write 3-4 paragraphs.
2. Open with a strong hook connecting the candidate to the role.
3. Middle paragraph(s): cite specific, relevant achievements.
4. Close with confidence and a call to action.
5. Professional tone, human-sounding, not templated.
6. Do NOT fabricate any achievements or experience.
7. Return ONLY the letter text, no subject line or signature block.`

  const provider = getAIProvider()
  const response = await provider.generateText(prompt, 0.6, false)
  return response.trim()
}
