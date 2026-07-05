import JSZip from 'jszip'
import fs from 'fs'

const zip = new JSZip()
zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>John Doe</w:t></w:r></w:p>
    <w:p><w:r><w:t>Senior Frontend Developer</w:t></w:r></w:p>
    <w:p><w:r><w:t>EXPERIENCE</w:t></w:r></w:p>
    <w:p><w:r><w:t>Senior Frontend Developer | Google | 2021-2024</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Led redesign of Google Cloud Console UI using TypeScript and React</w:t></w:r></w:p>
    <w:p><w:r><w:t>- Improved page load performance by 35% through code splitting</w:t></w:r></w:p>
    <w:p><w:r><w:t>Technologies: TypeScript, React, Node.js, Google Cloud Platform</w:t></w:r></w:p>
    <w:p><w:r><w:t>SKILLS: TypeScript, React, Node.js, Next.js, MongoDB, Docker, AWS</w:t></w:r></w:p>
    <w:p><w:r><w:t>EDUCATION: B.Sc. Computer Science | MIT | 2015-2019</w:t></w:r></w:p>
    <w:p><w:r><w:t>CERTIFICATIONS: AWS Solutions Architect - 2022</w:t></w:r></w:p>
  </w:body>
</w:document>`)

// Add required mimetype
zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`)

zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`)

const buffer = await zip.generateAsync({ type: 'nodebuffer' })
fs.writeFileSync('/tmp/test-resume.docx', buffer)
console.log('DOCX created at /tmp/test-resume.docx')
console.log('Size:', buffer.length, 'bytes')
