import fs from 'fs';
import { PDFParse } from 'pdf-parse';

async function test() {
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync('test.pdf')) });
  console.log(Object.keys(parser));
}
test();
