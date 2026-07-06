import { getAIProvider } from '../ai'

interface EmailInput {
  userName: string
  userTitle: string
  userSkills: string[]
  jobTitle: string
  company: string
  hiringManager?: string
}

export async function generateEmail(input: EmailInput): Promise<{ subject: string; body: string }> {
  const managerName = input.hiringManager || 'Hiring Manager'

  const prompt = `You are a job seeker writing a professional outreach email.

FROM: ${input.userName}
CURRENT TITLE: ${input.userTitle || 'Professional'}
KEY SKILLS: ${input.userSkills.join(', ')}

APPLYING FOR: ${input.jobTitle}
AT: ${input.company}
ADDRESS TO: ${managerName}

INSTRUCTIONS:
1. Write a concise, professional cold email expressing interest.
2. Mention 1-2 relevant skills or achievements.
3. Include a clear call to action (request a brief chat).
4. Keep it under 150 words.
5. Do NOT fabricate any claims.

First line: "Subject: " followed by the subject line.
Then a blank line.
Then the email body.`

  const provider = getAIProvider()
  const response = await provider.generateText(prompt, 0.5, false)

  const lines = response.trim().split('\n')
  const subjectLine = lines.find(l => l.toLowerCase().startsWith('subject:'))
  const subject = subjectLine
    ? subjectLine.replace(/^subject:\s*/i, '').trim()
    : `Application for ${input.jobTitle} at ${input.company}`
  const body = lines
    .filter(l => !l.toLowerCase().startsWith('subject:'))
    .join('\n')
    .trim()

  return { subject, body }
}
