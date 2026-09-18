const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const JSZip = require('jszip');

/**
 * Extracts text from a file based on its extension.
 * Returns an array of { pageNumber, text } objects so the downstream
 * chunkService works identically regardless of source format.
 */
async function extractTextByPage(filePath) {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return extractPdf(filePath);
    case '.docx':
      return extractDocx(filePath);
    case '.xlsx':
    case '.xls':
      return extractExcel(filePath);
    case '.txt':
      return extractTxt(filePath);
    case '.pptx':
      return extractPptx(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

// ── PDF ───────────────────────────────────────────────
async function extractPdf(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });

  const result = await parser.getText();
  await parser.destroy();

  return result.pages.map((p) => ({ pageNumber: p.num, text: p.text }));
}

// ── DOCX (Word) ───────────────────────────────────────
async function extractDocx(filePath) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value || '';

  if (!text.trim()) return [];
  return [{ pageNumber: 1, text }];
}

// ── XLSX / XLS (Excel) ───────────────────────────────
function extractExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const pages = [];

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName];
    // Convert each row to tab-separated values; rows separated by newlines
    const text = XLSX.utils.sheet_to_csv(sheet, { FS: '\t' });

    if (text.trim()) {
      pages.push({
        pageNumber: index + 1,
        text: `[Sheet: ${sheetName}]\n${text}`,
      });
    }
  });

  return pages;
}

// ── TXT (Plain text) ─────────────────────────────────
function extractTxt(filePath) {
  const text = fs.readFileSync(filePath, 'utf-8');

  if (!text.trim()) return [];
  return [{ pageNumber: 1, text }];
}

module.exports = { extractTextByPage };

// ── PPTX (PowerPoint) ────────────────────────────────
async function extractPptx(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  // Find all slide XML files (ppt/slides/slide1.xml, slide2.xml, ...)
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/i)[1], 10);
      const numB = parseInt(b.match(/slide(\d+)/i)[1], 10);
      return numA - numB;
    });

  const pages = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async('text');
    // Extract all text inside <a:t>...</a:t> tags
    const textParts = [];
    const regex = /<a:t[^>]*>(.*?)<\/a:t>/gs;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      textParts.push(match[1]);
    }

    const slideText = textParts.join(' ').trim();
    if (slideText) {
      pages.push({ pageNumber: i + 1, text: slideText });
    }
  }

  return pages;
}
