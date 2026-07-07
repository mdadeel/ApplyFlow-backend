import mammoth from 'mammoth'

export interface DocxHyperlink {
  displayText: string
  url: string
}

export interface DocxExtractResult {
  text: string
  hyperlinks: DocxHyperlink[]
}

/**
 * Extract URLs from an HTML string using regex parsing.
 * Avoids needing a full HTML parser dependency.
 */
function extractLinksFromHtml(html: string): DocxHyperlink[] {
  const links: DocxHyperlink[] = []
  // Match <a href="...">text</a> patterns
  const anchorRegex = /<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = anchorRegex.exec(html)) !== null) {
    const url = match[1].trim()
    if (!url || url.startsWith('#')) continue
    // Strip inner HTML tags from display text
    const displayText = match[2].replace(/<[^>]*>/g, '').trim()
    links.push({ url, displayText: displayText || url })
  }
  return links
}

export async function extractTextFromDOCX(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty DOCX buffer')
  }

  const result = await mammoth.extractRawText({ buffer })
  const text = (result.value || '').trim()

  if (!text) {
    throw new Error('Could not extract any text from the DOCX file')
  }

  return text
}

export async function extractFromDOCX(buffer: Buffer): Promise<DocxExtractResult> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty DOCX buffer')
  }

  const [rawTextResult, htmlResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }).catch(() => null),
  ])

  const text = (rawTextResult.value || '').trim()

  if (!text) {
    throw new Error('Could not extract any text from the DOCX file')
  }

  let hyperlinks: DocxHyperlink[] = []
  if (htmlResult && htmlResult.value) {
    hyperlinks = extractLinksFromHtml(htmlResult.value)
  }

  return { text, hyperlinks }
}
