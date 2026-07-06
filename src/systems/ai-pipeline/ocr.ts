import { recognize } from 'tesseract.js'
import { extractTextFromPDF } from '../career-data/pdfParser'

export interface OcrResult {
  text: string
  pageCount: number
  confidence: number
  method: 'tesseract' | 'pdf-native' | 'error'
}

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/jpg']

export function isImageMime(mime: string): boolean {
  return IMAGE_MIME_TYPES.includes(mime.toLowerCase())
}

export function isPdfMime(mime: string): boolean {
  return mime === 'application/pdf'
}

export async function ocrImage(buffer: Buffer): Promise<OcrResult> {
  const { data } = await recognize(buffer, 'eng', {
    logger: () => {},
  })

  return {
    text: data.text || '',
    pageCount: 1,
    confidence: data.confidence ? data.confidence / 100 : 0,
    method: 'tesseract',
  }
}

export async function ocrPdf(buffer: Buffer): Promise<OcrResult> {
  try {
    const text = await extractTextFromPDF(buffer)
    const pageCount = 1
    const confidence = text.length > 50 ? 0.9 : 0.3

    return {
      text,
      pageCount,
      confidence,
      method: 'pdf-native',
    }
  } catch (err) {
    return {
      text: '',
      pageCount: 0,
      confidence: 0,
      method: 'error',
    }
  }
}

export async function ocr(input: Buffer, mimeType: string): Promise<OcrResult> {
  if (isImageMime(mimeType)) {
    return ocrImage(input)
  }
  if (isPdfMime(mimeType)) {
    return ocrPdf(input)
  }
  return { text: '', pageCount: 0, confidence: 0, method: 'error' }
}
