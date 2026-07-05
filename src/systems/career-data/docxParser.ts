import mammoth from 'mammoth'

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
