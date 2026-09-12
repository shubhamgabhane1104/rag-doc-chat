const CHARS_PER_TOKEN = 4;
const CHUNK_SIZE_TOKENS = 500;
const OVERLAP_TOKENS = 50;

const CHUNK_SIZE_CHARS = CHUNK_SIZE_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

function chunkPages(pages) {
  const chunks = [];

  for (const page of pages) {
    const text = page.text.trim();
    if (!text) continue;

    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE_CHARS, text.length);
      const chunkText = text.slice(start, end).trim();

      if (chunkText.length > 0) {
        chunks.push({ pageNumber: page.pageNumber, text: chunkText });
      }

      if (end === text.length) break;
      start = end - OVERLAP_CHARS;
    }
  }

  return chunks;
}

module.exports = { chunkPages };