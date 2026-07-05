export function generateMarkdown(content: {
  summary: string
  experiences: any[]
  projects: any[]
  skills: string[]
  education: any[]
  certificates: any[]
}): string {
  let md = `# Professional Summary\n\n${content.summary || ''}\n\n`
  if (content.experiences?.length) {
    md += `## Experience\n\n`
    for (const e of content.experiences) {
      md += `### ${e.role} at ${e.company}\n${e.startDate} — ${e.current ? 'Present' : e.endDate}\n\n`
      if (e.responsibilities?.length) md += e.responsibilities.map((r: string) => `- ${r}`).join('\n') + '\n\n'
      if (e.technologies?.length) md += `**Technologies:** ${e.technologies.join(', ')}\n\n`
    }
  }
  if (content.projects?.length) {
    md += `## Projects\n\n`
    for (const p of content.projects) {
      md += `### ${p.title || 'Project'}\n${p.description || ''}\n\n`
      if (p.features?.length) md += p.features.map((f: string) => `- ${f}`).join('\n') + '\n\n'
      if (p.technologies?.length) md += `**Technologies:** ${p.technologies.join(', ')}\n\n`
    }
  }
  if (content.skills?.length) {
    md += `## Skills\n\n${content.skills.join(', ')}\n\n`
  }
  if (content.education?.length) {
    md += `## Education\n\n`
    for (const e of content.education) {
      md += `- ${e.degree} — ${e.institution} (${e.startDate} — ${e.endDate})`
      if (e.result) md += ` — ${e.result}`
      md += '\n'
    }
    md += '\n'
  }
  if (content.certificates?.length) {
    md += `## Certifications\n\n`
    for (const c of content.certificates) {
      md += `- ${c.name} — ${c.issuer} (${c.date})\n`
    }
    md += '\n'
  }
  return md
}
