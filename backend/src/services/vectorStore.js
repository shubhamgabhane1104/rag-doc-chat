const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data/vectors');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function vectorFilePath(documentId) {
  return path.join(DATA_DIR, `${documentId}.json`);
}

function saveVectors(documentId, entries) {
  fs.writeFileSync(vectorFilePath(documentId), JSON.stringify(entries));
}

function loadVectors(documentId) {
  const filePath = vectorFilePath(documentId);
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function deleteVectors(documentId) {
  const filePath = vectorFilePath(documentId);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function search(documentId, queryVector, topK = 4) {
  const entries = loadVectors(documentId);
  const scored = entries.map((entry) => ({
    ...entry,
    score: cosineSimilarity(entry.vector, queryVector),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

module.exports = { saveVectors, loadVectors, deleteVectors, search, cosineSimilarity };