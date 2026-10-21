// Unit tests for DocChat backend functions.  Run with:  npm test
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.GEMINI_MODELS = 'model-a,model-b';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { chunkPages } = require('../src/services/chunkService');
const { buildPrompt } = require('../src/services/llmService');
const { parseJsonSafely, extractArray } = require('../src/services/jsonUtils');
const { sampleChunks } = require('../src/services/quizService');
const { toSqlVector } = require('../src/services/vectorStore');
const { isUuid } = require('../src/middleware/validate');
const { extractTextByPage } = require('../src/services/documentService');
const gemini = require('../src/services/geminiClient');

const FX = (f) => path.join(__dirname, 'fixtures', f);

// ---------------- chunkService.chunkPages ----------------
test('UT01 chunkPages: short page gives exactly one chunk', () => {
  const chunks = chunkPages([{ pageNumber: 1, text: 'Hello world' }]);
  assert.deepEqual(chunks, [{ pageNumber: 1, text: 'Hello world' }]);
});

test('UT02 chunkPages: page of exactly 2000 characters gives one chunk (boundary)', () => {
  const chunks = chunkPages([{ pageNumber: 1, text: 'a'.repeat(2000) }]);
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].text.length, 2000);
});

test('UT03 chunkPages: 2001 characters gives two chunks with 200-character overlap (boundary)', () => {
  const text = 'x'.repeat(1800) + 'y'.repeat(201);
  const chunks = chunkPages([{ pageNumber: 4, text }]);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0].text.length, 2000);
  assert.equal(chunks[1].text, text.slice(1800)); // starts 200 chars before the end of chunk 1
  assert.ok(chunks.every((c) => c.pageNumber === 4));
});

test('UT04 chunkPages: 5000 characters gives 3 chunks covering all text', () => {
  const text = Array.from({ length: 5000 }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');
  const chunks = chunkPages([{ pageNumber: 1, text }]);
  assert.equal(chunks.length, 3);
  assert.ok(chunks[chunks.length - 1].text.endsWith(text.slice(-50)));
});

test('UT05 chunkPages: empty and whitespace-only pages are skipped (invalid input)', () => {
  assert.deepEqual(chunkPages([{ pageNumber: 1, text: '' }, { pageNumber: 2, text: '   \n\t ' }]), []);
  assert.deepEqual(chunkPages([]), []);
});

test('UT06 chunkPages: page numbers are kept for each page', () => {
  const chunks = chunkPages([{ pageNumber: 1, text: 'one' }, { pageNumber: 2, text: 'two' }, { pageNumber: 3, text: 'three' }]);
  assert.deepEqual(chunks.map((c) => c.pageNumber), [1, 2, 3]);
});

// ---------------- llmService.buildPrompt ----------------
test('UT07 buildPrompt: contains the grounding rule, every chunk with its page, and the question', () => {
  const p = buildPrompt('What is osmosis?', [
    { pageNumber: 2, text: 'Osmosis is movement of water.' },
    { pageNumber: 5, text: 'Diffusion is different.' },
  ]);
  assert.match(p, /Use ONLY the context below/);
  assert.match(p, /\[Chunk 1 - Page 2\]\nOsmosis is movement of water\./);
  assert.match(p, /\[Chunk 2 - Page 5\]\nDiffusion is different\./);
  assert.match(p, /I don't have enough information in this document to answer that\./);
  assert.match(p, /Question: What is osmosis\?/);
});

// ---------------- jsonUtils ----------------
test('UT08 parseJsonSafely: plain JSON', () => {
  assert.deepEqual(parseJsonSafely('{"a":1}'), { a: 1 });
});
test('UT09 parseJsonSafely: JSON wrapped in ```json fences', () => {
  assert.deepEqual(parseJsonSafely('```json\n[{"q":"x"}]\n```'), [{ q: 'x' }]);
});
test('UT10 parseJsonSafely: JSON with extra sentences around it', () => {
  assert.deepEqual(parseJsonSafely('Here is your quiz: [1,2,3] Hope it helps!'), [1, 2, 3]);
});
test('UT11 parseJsonSafely: not JSON at all gives a friendly error (invalid input)', () => {
  assert.throws(() => parseJsonSafely('sorry, I cannot do that'), /unexpected format/);
  assert.throws(() => parseJsonSafely(''), /unexpected format/);
});
test('UT12 extractArray: array, wrapped array and non-array input', () => {
  assert.deepEqual(extractArray([1]), [1]);
  assert.deepEqual(extractArray({ questions: [1, 2] }), [1, 2]);
  assert.deepEqual(extractArray({ a: 1 }), []);
  assert.deepEqual(extractArray(null), []);
});

// ---------------- quizService.sampleChunks ----------------
test('UT13 sampleChunks: 15 or fewer chunks are returned unchanged (boundary)', () => {
  const c = Array.from({ length: 15 }, (_, i) => i);
  assert.deepEqual(sampleChunks(c, 15), c);
});
test('UT14 sampleChunks: 100 chunks gives 15 spread from first to last', () => {
  const c = Array.from({ length: 100 }, (_, i) => i);
  const s = sampleChunks(c, 15);
  assert.equal(s.length, 15);
  assert.equal(s[0], 0);
  assert.equal(s[14], 99);
  for (let i = 1; i < s.length; i++) assert.ok(s[i] > s[i - 1]);
});
test('UT15 sampleChunks: empty or missing input gives empty array', () => {
  assert.deepEqual(sampleChunks([], 15), []);
  assert.deepEqual(sampleChunks(undefined, 15), []);
});

// ---------------- vectorStore.toSqlVector, validate.isUuid ----------------
test('UT16 toSqlVector: formats a vector for pgvector', () => {
  assert.equal(toSqlVector([0.1, -2, 3]), '[0.1,-2,3]');
});
test('UT17 isUuid: accepts a real UUID and rejects bad values', () => {
  assert.equal(isUuid('7c21a0b4-1f2e-4c3d-9a8b-0123456789ab'), true);
  for (const bad of ['abc', '', '7c21a0b4-1f2e-4c3d-9a8b-0123456789a', "1' OR '1'='1", null, 42]) {
    assert.equal(isUuid(bad), false, String(bad));
  }
});

// ---------------- documentService.extractTextByPage ----------------
test('UT18 extract PDF: text is returned page by page', async () => {
  const pages = await extractTextByPage(FX('photosynthesis.pdf'));
  assert.equal(pages.length, 2);
  assert.deepEqual(pages.map((p) => p.pageNumber), [1, 2]);
  assert.match(pages[1].text, /Calvin cycle/);
});
test('UT19 extract DOCX: whole document as one page', async () => {
  const pages = await extractTextByPage(FX('cells.docx'));
  assert.equal(pages.length, 1);
  assert.match(pages[0].text, /Mitochondria/);
});
test('UT20 extract PPTX: one page per slide and XML entities decoded', async () => {
  const pages = await extractTextByPage(FX('deck.pptx'));
  assert.equal(pages[0].text, 'R&D <Budget> Salt & pepper cost 5 < 6');
});
test('UT21 extract XLSX: one page per non-empty sheet with sheet name', async () => {
  const pages = await extractTextByPage(FX('marks.xlsx'));
  assert.equal(pages.length, 2);
  assert.match(pages[0].text, /^\[Sheet: Marks\]\nSubject\tMarks\nDBMS\t78/);
  assert.match(pages[1].text, /\[Sheet: Topics\]/);
});
test('UT22 extract TXT: normal file and empty file', async () => {
  assert.equal((await extractTextByPage(FX('notes.txt'))).length, 1);
  assert.deepEqual(await extractTextByPage(FX('empty.txt')), []);
});
test('UT23 extract: unsupported extension is rejected (invalid input)', async () => {
  await assert.rejects(() => extractTextByPage('virus.exe'), /Unsupported file type: \.exe/);
});

// ---------------- geminiClient: error messages and fallback ----------------
test('UT24 cleanErrorMessage: raw API errors become readable messages', () => {
  assert.match(gemini.cleanErrorMessage(new Error('429 RESOURCE_EXHAUSTED')), /rate limit/);
  assert.match(gemini.cleanErrorMessage(new Error('503 UNAVAILABLE high demand')), /high traffic/);
  assert.match(gemini.cleanErrorMessage(new Error('API key not valid')), /GEMINI_API_KEY/);
  assert.match(gemini.cleanErrorMessage(null), /unexpected error/);
});

test('UT25 fallback: if the first model is not found (404) the next model answers', async () => {
  const used = [];
  gemini.ai.models.generateContent = async (req) => {
    used.push(req.model);
    if (req.model === 'model-a') { const e = new Error('404 NOT_FOUND'); e.status = 404; throw e; }
    return { text: 'answer from ' + req.model };
  };
  const res = await gemini.callGeminiWithFallback({ contents: 'hi' }, { label: 'test' });
  assert.equal(res.text, 'answer from model-b');
  assert.deepEqual(used, ['model-a', 'model-b']);
});

test('UT26 fallback: a temporary 503 error is retried on the same model', async () => {
  let calls = 0;
  gemini.ai.models.generateContent = async (req) => {
    calls += 1;
    if (calls === 1) { const e = new Error('503 high demand'); e.status = 503; throw e; }
    return { text: 'ok via ' + req.model };
  };
  const res = await gemini.callGeminiWithFallback({ contents: 'hi' }, { label: 'test' });
  assert.equal(calls, 2);
  assert.match(res.text, /^ok via model-b$/); // model-a was marked unavailable in UT25
});

test('UT27 fallback: when every model fails the user gets a clear message', async () => {
  gemini.ai.models.generateContent = async () => { const e = new Error('429 RESOURCE_EXHAUSTED'); e.status = 429; throw e; };
  await assert.rejects(() => gemini.callGeminiWithFallback({ contents: 'hi' }, { label: 'test' }), /API rate limit reached/);
});

test('UT28 streaming: pieces are delivered in order and joined into the full answer', async () => {
  gemini.ai.models.generateContentStream = async function* () { yield { text: 'Photo' }; yield { text: 'synthesis ' }; yield { text: 'uses light.' }; };
  const pieces = [];
  const full = await gemini.streamGeminiWithFallback({ contents: 'q' }, (t) => pieces.push(t), { label: 'test' });
  assert.deepEqual(pieces, ['Photo', 'synthesis ', 'uses light.']);
  assert.equal(full, 'Photosynthesis uses light.');
});

test('UT29 streaming: an answer that fails half-way is not restarted on another model', async () => {
  let calls = 0;
  gemini.ai.models.generateContentStream = async function* () { calls += 1; yield { text: 'Half an ' }; throw new Error('connection reset'); };
  await assert.rejects(() => gemini.streamGeminiWithFallback({ contents: 'q' }, () => {}, { label: 'test' }));
  assert.equal(calls, 1);
});
