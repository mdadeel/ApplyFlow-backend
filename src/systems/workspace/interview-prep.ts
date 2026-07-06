import { getAIProvider } from '../ai'

export interface InterviewPrepQuestion {
  question: string
  talkingPoints: string[]
}

export interface InterviewPrepResult {
  questions: InterviewPrepQuestion[]
  companyResearch: string
}

export async function generateInterviewPrep(
  jobTitle: string,
  company: string,
  description: string,
  userSkills: string[],
  userExperience: string,
): Promise<InterviewPrepResult> {
  const prompt = `You are an interview coach. Prepare a candidate for an interview.

ROLE: ${jobTitle}
COMPANY: ${company}
DESCRIPTION:
${description.slice(0, 3000)}

CANDIDATE SKILLS: ${userSkills.join(', ')}
CANDIDATE EXPERIENCE: ${userExperience || 'Not provided'}

Return a JSON object with:
{
  "questions": [
    { "question": "Interview question text", "talkingPoints": ["Key point to mention", "..." ] }
  ],
  "companyResearch": "Summary of company research for the interview (2-3 paragraphs)"
}

Generate 5-8 likely interview questions based on the job description and candidate profile.
Include a mix of: behavioral, technical, role-specific, and company-fit questions.`

  const provider = getAIProvider()
  const response = await provider.generateText(prompt, 0.4, true)

  const cleaned = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned)

    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 10) : [],
      companyResearch: typeof parsed.companyResearch === 'string' ? parsed.companyResearch : '',
    }
  } catch {
    return {
      questions: [],
      companyResearch: 'Interview preparation encountered an error. Please try again.',
    }
  }
}
