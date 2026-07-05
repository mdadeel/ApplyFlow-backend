import { Document, Packer, Paragraph, TextRun, HeadingLevel, } from 'docx'

export async function generateDocx(content: {
  summary: string
  experiences: any[]
  projects: any[]
  skills: string[]
  education: any[]
  certificates: any[]
}): Promise<Buffer> {
  const sections: any[] = []
  if (content.summary) {
    sections.push(
      new Paragraph({ text: 'Professional Summary', heading: HeadingLevel.HEADING_1 }),
      new Paragraph(content.summary),
    )
  }
  if (content.experiences?.length) {
    sections.push(new Paragraph({ text: 'Experience', heading: HeadingLevel.HEADING_1 }))
    for (const e of content.experiences) {
      sections.push(
        new Paragraph({ text: `${e.role} at ${e.company}`, heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: `${e.startDate} — ${e.current ? 'Present' : e.endDate || ''}`, spacing: { after: 200 } }),
        ...(e.responsibilities || []).map((r: string) => new Paragraph({ text: `• ${r}`, spacing: { after: 100 } })),
      )
    }
  }
  if (content.projects?.length) {
    sections.push(new Paragraph({ text: 'Projects', heading: HeadingLevel.HEADING_1 }))
    for (const p of content.projects) {
      sections.push(
        new Paragraph({ text: p.title || 'Project', heading: HeadingLevel.HEADING_2 }),
        new Paragraph({ text: p.description || '', spacing: { after: 200 } }),
        ...(p.features || []).map((f: string) => new Paragraph({ text: `• ${f}`, spacing: { after: 100 } })),
      )
    }
  }
  if (content.skills?.length) {
    sections.push(
      new Paragraph({ text: 'Skills', heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: content.skills.join(', ') }),
    )
  }
  if (content.education?.length) {
    sections.push(new Paragraph({ text: 'Education', heading: HeadingLevel.HEADING_1 }))
    for (const e of content.education) {
      sections.push(new Paragraph({ text: `${e.degree} — ${e.institution} (${e.startDate} — ${e.endDate})${e.result ? ` — ${e.result}` : ''}` }))
    }
  }
  if (content.certificates?.length) {
    sections.push(new Paragraph({ text: 'Certifications', heading: HeadingLevel.HEADING_1 }))
    for (const c of content.certificates) {
      sections.push(new Paragraph({ text: `${c.name} — ${c.issuer} (${c.date})` }))
    }
  }
  const doc = new Document({ sections: [{ children: sections }] })
  return Packer.toBuffer(doc)
}
