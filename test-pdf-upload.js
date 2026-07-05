import fs from 'fs';
import { extractTextFromPDF } from './dist/systems/career-data/pdfParser.js';

async function test() {
  // Create a dummy pdf buffer (minimal valid pdf)
  const dummyPdf = Buffer.from(
    '%PDF-1.1\n%¥±ë\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 51 >>\nstream\nBT\n/F1 12 Tf\n72 712 Td\n(Hello World) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000018 00000 n \n0000000065 00000 n \n0000000122 00000 n \n0000000287 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n389\n%%EOF',
    'utf-8'
  );
  try {
    const text = await extractTextFromPDF(dummyPdf);
    console.log("SUCCESS TEXT:", text);
  } catch (err) {
    console.error("ERROR:", err);
  }
}
test();
