import puppeteer, { Browser } from 'puppeteer'

export interface ResumeContent {
  summary: string
  experiences: any[]
  projects: any[]
  skills: string[]
  education: any[]
  certificates: any[]
}

function escapeHtml(input: string): string {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderResponsibilityList(items: string[] | undefined): string {
  if (!items || items.length === 0) return ''
  return `<ul>${items.map((r) => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`
}

function renderResumeHtml(content: ResumeContent, applicantName: string): string {
  const experiences = (content.experiences ?? [])
    .map((e) => {
      const dates = `${escapeHtml(e.startDate || '')} — ${e.current ? 'Present' : escapeHtml(e.endDate || '')}`
      const techs = e.technologies?.length
        ? `<p class="meta"><strong>Technologies:</strong> ${(e.technologies as string[]).map(escapeHtml).join(', ')}</p>`
        : ''
      return `
        <div class="entry">
          <div class="entry-head">
            <h3>${escapeHtml(e.role || '')} <span class="dim">at ${escapeHtml(e.company || '')}</span></h3>
            <span class="dates">${dates}</span>
          </div>
          ${renderResponsibilityList(e.responsibilities)}
          ${techs}
        </div>`
    })
    .join('')

  const projects = (content.projects ?? [])
    .map((p) => {
      const techs = p.technologies?.length
        ? `<p class="meta"><strong>Technologies:</strong> ${(p.technologies as string[]).map(escapeHtml).join(', ')}</p>`
        : ''
      return `
        <div class="entry">
          <div class="entry-head">
            <h3>${escapeHtml(p.title || 'Project')}</h3>
          </div>
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
          ${renderResponsibilityList(p.features)}
          ${techs}
        </div>`
    })
    .join('')

  const skills = content.skills?.length
    ? `<p class="skills">${(content.skills as string[]).map(escapeHtml).join(' • ')}</p>`
    : ''

  const education = (content.education ?? [])
    .map((e) => {
      const result = e.result ? ` — ${escapeHtml(e.result)}` : ''
      return `<li>${escapeHtml(e.degree || '')} — ${escapeHtml(e.institution || '')} (${escapeHtml(e.startDate || '')} — ${escapeHtml(e.endDate || '')})${result}</li>`
    })
    .join('')

  const certificates = (content.certificates ?? [])
    .map((c) => `<li>${escapeHtml(c.name || '')} — ${escapeHtml(c.issuer || '')} (${escapeHtml(c.date || '')})</li>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Resume — ${escapeHtml(applicantName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 32px; font-size: 11pt; line-height: 1.45; }
  h1 { font-size: 22pt; margin: 0 0 4px; letter-spacing: 0.5px; }
  h2 { font-size: 12pt; margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid #222; text-transform: uppercase; letter-spacing: 1px; }
  h3 { font-size: 11pt; margin: 0; }
  p { margin: 0 0 6px; }
  .header { text-align: center; margin-bottom: 16px; }
  .header .role { font-size: 10pt; color: #555; }
  .entry { margin-bottom: 12px; }
  .entry-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .dates { font-size: 9.5pt; color: #555; white-space: nowrap; }
  .dim { color: #555; font-weight: normal; }
  ul { margin: 4px 0 6px 18px; padding: 0; }
  li { margin: 2px 0; }
  .meta { font-size: 10pt; color: #333; margin-top: 2px; }
  .skills { margin: 4px 0 0; }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(applicantName)}</h1>
    <p class="role">Resume</p>
  </div>

  ${content.summary ? `<h2>Professional Summary</h2><p>${escapeHtml(content.summary)}</p>` : ''}

  ${experiences ? `<h2>Experience</h2>${experiences}` : ''}

  ${projects ? `<h2>Projects</h2>${projects}` : ''}

  ${skills ? `<h2>Skills</h2>${skills}` : ''}

  ${education ? `<h2>Education</h2><ul>${education}</ul>` : ''}

  ${certificates ? `<h2>Certifications</h2><ul>${certificates}</ul>` : ''}
</body>
</html>`
}

function renderDocumentHtml(title: string, body: string): string {
  const paragraphs = String(body ?? '')
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #111; margin: 0; padding: 40px; font-size: 11pt; line-height: 1.6; }
  h1 { font-size: 16pt; margin: 0 0 20px; border-bottom: 1px solid #222; padding-bottom: 8px; }
  p { margin: 0 0 12px; white-space: pre-wrap; }
</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${paragraphs}
</body>
</html>`
}

let browserPromise: Promise<Browser> | null = null

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    })
  }
  return browserPromise
}

export async function generateResumePDF(
  content: ResumeContent,
  applicantName = 'Applicant',
): Promise<Buffer> {
  const html = renderResumeHtml(content, applicantName)
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function generateDocumentPDF(title: string, body: string): Promise<Buffer> {
  const html = renderDocumentHtml(title, body)
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
    })
    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise
    browserPromise = null
    await browser.close()
  }
}
