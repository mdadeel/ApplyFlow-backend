import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'

// Suppress missing canvas warnings since we are only extracting text and links
const originalWarn = console.warn
console.warn = (...args) => {
  if (args[0] && typeof args[0] === 'string' && args[0].includes('canvas')) return
  originalWarn(...args)
}

export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty PDF buffer')
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  })

  const pdf = await loadingTask.promise
  const numPages = pdf.numPages
  let text = ''

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const annotations = await page.getAnnotations()

    // Simple text extraction preserving lines
    let lastY = -1
    let line = ''
    
    for (const item of textContent.items) {
      if ('str' in item) {
        if (lastY !== item.transform[5] && lastY !== -1) {
          text += line + '\n'
          line = ''
        }
        line += item.str
        lastY = item.transform[5]
      }
    }
    if (line) text += line + '\n'

    // Extract clickable links and append them to the text block
    const links = annotations.filter((a: any) => a.subtype === 'Link' && a.url)
    if (links.length > 0) {
      text += '\n[LINKS FOUND IN PAGE ' + i + ']:\n'
      for (const link of links) {
        text += `- ${link.url}\n`
      }
      text += '\n'
    }
  }

  return text.trim()
}
