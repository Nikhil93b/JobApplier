import mammoth from 'mammoth';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Document, Paragraph, TextRun, Packer } from 'docx';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';

export async function readResume(buffer, filename) {
  let text;
  if (/\.docx$/i.test(filename)) {
    if (buffer[0] !== 80 || buffer[1] !== 75) throw new Error('This file is not a valid Word .docx document.');
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (/\.pdf$/i.test(filename)) {
    if (!buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('This file is not a valid PDF.');
    const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: true });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 30) throw new Error('Use a resume with no more than 30 pages.');
      const pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i); const content = await page.getTextContent();
        let lastY; let line = ''; const lines = [];
        for (const item of content.items) {
          if (!('str' in item)) continue;
          const y = Math.round(item.transform[5]);
          if (lastY !== undefined && Math.abs(y - lastY) > 3) { lines.push(line); line = ''; }
          line += item.str + ' '; lastY = y;
          if (item.hasEOL) { lines.push(line); line = ''; lastY = undefined; }
        }
        if (line) lines.push(line); pages.push(lines.join('\n'));
      }
      text = pages.join('\n\n');
    } finally { await task.destroy(); }
  } else if (/\.txt$/i.test(filename)) text = buffer.toString('utf8');
  else throw new Error('Upload PDF, Word (.docx), or text. Save older .doc files as .docx first.');
  text = text.replace(/\u0000/g, '').trim();
  if (text.length < 40) throw new Error('Not enough readable text. Image-only PDFs need OCR; upload a text-based PDF or Word file.');
  if (text.length > 100000) throw new Error('Resume text is too long. Use a document under 100,000 characters.');
  return text;
}
const heading = line => (/^[A-Z][A-Z &/]{2,50}\s*:?$/.test(line.trim()) || /^(?:(?:professional |career )?summary|(?:work |professional )?experience|education|(?:technical |core )?skills|projects|certifications|achievements)\s*:?$/i.test(line.trim())) && line.trim().length < 60;
export async function exportResume(text, format) {
  const lines = text.split(/\r?\n/);
  if (format === 'docx') {
    const children = lines.map((line, i) => new Paragraph({ spacing: { after: 80 }, keepNext: i === 0 || heading(line), children: [new TextRun({ text: line, font: 'Arial', size: i === 0 ? 32 : 22, bold: i === 0 || heading(line) })] }));
    return Packer.toBuffer(new Document({ creator: 'Job Applier', sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }] }));
  }
  if (format !== 'pdf') throw new Error('Select PDF or Word.');
  return new Promise((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'A4', margins: { top: 45, bottom: 45, left: 50, right: 50 }, info: { Title: 'Resume', Author: 'Job Applier' } });
    const chunks = []; pdf.on('data', chunk => chunks.push(chunk)); pdf.on('end', () => resolve(Buffer.concat(chunks))); pdf.on('error', reject);
    const regular = 'C:/Windows/Fonts/arial.ttf', bold = 'C:/Windows/Fonts/arialbd.ttf';
    if (existsSync(regular) && existsSync(bold)) { pdf.registerFont('Body', regular); pdf.registerFont('Strong', bold); }
    for (const [i, line] of lines.entries()) {
      const strong = i === 0 || heading(line); pdf.font(existsSync(regular) && existsSync(bold) ? strong ? 'Strong' : 'Body' : strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(i === 0 ? 16 : 11).text(line || ' ', { lineGap: 3 });
    }
    pdf.end();
  });
}
