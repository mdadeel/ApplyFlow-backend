export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_. ]/g, '').trim()
}

export function buildFileName(name: string, role: string, company: string, ext: string): string {
  const parts = [sanitizeFileName(name) || 'Applicant', sanitizeFileName(role) || 'Role', sanitizeFileName(company) || 'Company']
  return `${parts.join('-')}.${ext}`
}
