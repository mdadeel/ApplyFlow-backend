import type { Resume } from '../types/resume'
import type { ExtractedProfile } from '../../systems/career-data/pdfExtractor'
import { profileToResume, attachDocumentText } from './adapter'
import { extractUrls } from '../../systems/career-data/pdfExtractor'

export { profileToResume, attachDocumentText }

/**
 * Unified parse entry point.
 * Takes an ExtractedProfile (from any parser) and returns a canonical Resume model.
 *
 * Optionally accepts the original raw text to populate the document section
 * with URLs and text content.
 */
export function toResume(
  extracted: ExtractedProfile,
  originalText?: string
): Resume {
  const resume = profileToResume(extracted)

  if (originalText) {
    const urls = extractUrls(originalText)
    // Merge extracted URLs from both the raw text and the profile
    const allUrls = [...new Set([
      ...(extracted.extractedUrls || []),
      ...urls,
    ])]
    return attachDocumentText(resume, originalText, '', allUrls)
  }

  return resume
}
