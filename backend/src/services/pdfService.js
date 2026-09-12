console.log('>>> PDFSERVICE FILE LOADED - NEW VERSION <<<');
const fs = require('fs');
const { PDFParse } = require('pdf-parse');

async function extractTextByPage(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });

  const result = await parser.getText();
  await parser.destroy();

  return result.pages.map((p) => ({ pageNumber: p.num, text: p.text }));
}

module.exports = { extractTextByPage };