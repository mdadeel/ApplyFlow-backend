import type { Resume, ResumeLink } from '../types/resume'
import type { ExtractedProfile, ExtractedLink } from '../../systems/career-data/pdfExtractor'

/**
 * Map parser-specific link format to the canonical ResumeLink format.
 */
function mapLinks(links?: ExtractedLink[]): ResumeLink[] | undefined {
  if (!links || links.length === 0) return undefined
  return links.map(l => ({
    displayText: l.displayText,
    url: l.url,
    platform: l.platform,
  }))
}

/**
 * Map parser-specific link format to the basic ResumeLink format used in experiences/projects.
 */
function mapLinkUrls(links?: Array<{ displayText: string; url: string; platform: string }>): ResumeLink[] | undefined {
  if (!links || links.length === 0) return undefined
  return links.map(l => ({
    displayText: l.displayText,
    url: l.url,
    platform: l.platform,
  }))
}

/**
 * Convert an ExtractedProfile (parser output) into the canonical Resume model.
 *
 * This adapter normalizes:
 * - All section types (experience, project, skill, etc.)
 * - Links into a consistent format
 * - Empty/missing fields to undefined
 * - Confidence values from string ('High'|'Medium'|'Low') omitted in canonical output
 */
export function profileToResume(extracted: ExtractedProfile): Resume {
  return {
    personal: extracted.personal
      ? {
          name: extracted.personal.name,
          title: extracted.personal.title,
          summary: extracted.personal.summary,
          email: extracted.personal.email,
          phone: extracted.personal.phone,
          location: extracted.personal.location,
          links: mapLinks(extracted.personal.links),
        }
      : undefined,
    experiences: extracted.experiences.map(e => ({
      company: e.company,
      role: e.role,
      employmentType: e.employmentType,
      location: e.location,
      workMode: e.workMode,
      startDate: e.startDate,
      endDate: e.endDate,
      current: e.current,
      description: e.description,
      responsibilities: e.responsibilities || [],
      technologies: e.technologies || [],
      achievements: e.achievements || [],
      metrics: e.metrics || [],
      links: e.links ? mapLinkUrls(e.links) : undefined,
    })),
    projects: extracted.projects.map(p => ({
      title: p.title,
      description: p.description,
      problem: p.problem,
      solution: p.solution,
      technologies: p.technologies || [],
      features: p.features || [],
      outcome: p.outcome,
      github: p.github,
      demo: p.demo,
      links: p.links ? mapLinkUrls(p.links) : undefined,
    })),
    skills: extracted.skills.map(s => ({
      name: s.name,
      category: s.category,
      level: s.level,
      aliases: s.aliases,
    })),
    education: extracted.education.map(e => ({
      degree: e.degree,
      institution: e.institution,
      startDate: e.startDate,
      endDate: e.endDate,
      result: e.result,
    })),
    certificates: extracted.certificates.map(c => ({
      name: c.name,
      issuer: c.issuer,
      date: c.date,
      url: c.url,
    })),
    awards: (extracted.awards || []).map(a => ({
      title: a.title,
      issuer: a.issuer,
      date: a.date,
      description: a.description,
      url: a.url,
    })),
    publications: (extracted.publications || []).map(p => ({
      title: p.title,
      publisher: p.publisher,
      date: p.date,
      url: p.url,
      description: p.description,
      authors: p.authors,
    })),
    volunteering: (extracted.volunteering || []).map(v => ({
      organization: v.organization,
      role: v.role,
      startDate: v.startDate,
      endDate: v.endDate,
      current: v.current,
      description: v.description,
      technologies: v.technologies,
    })),
    languages: (extracted.languages || []).map(l => ({
      name: l.name,
      proficiency: l.proficiency,
    })),
    interests: (extracted.interests || []).map(i => ({
      name: i.name,
      category: i.category,
    })),
    document: extracted.extractedUrls
      ? {
          extractedUrls: extracted.extractedUrls,
          originalText: '',
          cleanedText: '',
        }
      : undefined,
  }
}

/**
 * Merge extracted URLs back into the Resume document section.
 * Used when raw text is available alongside the extracted profile.
 */
export function attachDocumentText(
  resume: Resume,
  originalText: string,
  cleanedText: string,
  extractedUrls: string[]
): Resume {
  return {
    ...resume,
    document: {
      extractedUrls,
      originalText,
      cleanedText,
    },
  }
}
