import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdfjs-dist/legacy/build/pdf.worker.js';

export async function parsePdfWithLinks(buffer) {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  let text = '';
  
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const annotations = await page.getAnnotations();
    
    // Simple text extraction
    let lastY = -1;
    for (const item of textContent.items) {
      if (lastY !== item.transform[5] && lastY !== -1) {
        text += '\n';
      }
      text += item.str;
      lastY = item.transform[5];
    }
    
    // Add links found on this page
    const links = annotations.filter(a => a.subtype === 'Link' && a.url);
    if (links.length > 0) {
      text += '\n--- Links Found on Page ---\n';
      for (const link of links) {
        text += `${link.url}\n`;
      }
      text += '---------------------------\n';
    }
  }
  
  return text;
}
