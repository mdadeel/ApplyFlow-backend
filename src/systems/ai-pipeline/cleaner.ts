export interface CleanResult {
  cleaned: string
  originalLength: number
  language: string
}

const BOILERPLATE: RegExp[] = [
  /(privacy policy|cookie policy|terms of service|terms & conditions).*/gi,
  /(sign up|sign in|log in|create account|register|subscribe|follow us).*/gi,
  /(share this|tweet|facebook|linkedin|email this|print this).*/gi,
  /^.*(powered by|built with|developed by).*/gim,
  /^(navigation|menu|breadcrumb|sidebar|footer|header).*/gim,
  /^\s*(home|about|contact|products|services|blog)\s*$/gim,
  /^\s*[─━═▬▭▪→★●]\s*$/gm,
]

const LANGUAGE_PATTERNS: [RegExp, string][] = [
  [/[\u4e00-\u9fff]/, 'zh'],
  [/[\u3040-\u309f\u30a0-\u30ff]/, 'ja'],
  [/[\uac00-\ud7af]/, 'ko'],
  [/[а-яА-Я]/, 'ru'],
]

export function clean(raw: string): CleanResult {
  const originalLength = raw.length
  if (!raw || originalLength === 0) {
    return { cleaned: '', originalLength: 0, language: 'unknown' }
  }

  let text = raw.normalize('NFKC')

  text = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/[\r\n]+/g, '\n')

  for (const pattern of BOILERPLATE) {
    text = text.replace(pattern, '')
  }

  text = text.replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (text.length > 50000) {
    text = text.slice(0, 50000)
  }

  const language = detectLanguage(text)

  return { cleaned: text, originalLength, language }
}

function detectLanguage(text: string): string {
  const sample = text.slice(0, 1000).replace(/\s+/g, '')
  if (!sample) return 'unknown'

  for (const [pattern, lang] of LANGUAGE_PATTERNS) {
    if (pattern.test(sample)) return lang
  }

  const latinChars = (sample.match(/[a-zA-Z]/g) || []).length
  return latinChars / sample.length >= 0.85 ? 'en' : 'unknown'
}
