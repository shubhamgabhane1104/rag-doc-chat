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

function searchMultiDocs(documentIds, queryVector, topK = 6) {
  if (!documentIds || documentIds.length === 0) return [];
  const allScored = [];

  for (const docId of documentIds) {
    const entries = loadVectors(docId);
    for (const entry of entries) {
      allScored.push({
        ...entry,
        documentId: docId,
        score: cosineSimilarity(entry.vector, queryVector),
      });
    }
  }

  allScored.sort((a, b) => b.score - a.score);
  return allScored.slice(0, topK);
}

function getVectorStoreStats() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      return { totalDocumentsIndexed: 0, totalVectors: 0, storageBytes: 0, storagePretty: '0 KB', dimension: 3072 };
    }
    const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
    let totalVectors = 0;
    let storageBytes = 0;

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const stat = fs.statSync(filePath);
      storageBytes += stat.size;
      try {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (Array.isArray(content)) {
          totalVectors += content.length;
        }
      } catch (err) {}
    }

    const storagePretty = storageBytes > 1024 * 1024 
      ? `${(storageBytes / (1024 * 1024)).toFixed(2)} MB` 
      : `${(storageBytes / 1024).toFixed(1)} KB`;

    return {
      totalDocumentsIndexed: files.length,
      totalVectors,
      storageBytes,
      storagePretty,
      dimension: 3072,
    };
  } catch (err) {
    return { totalDocumentsIndexed: 0, totalVectors: 0, storageBytes: 0, storagePretty: '0 KB', dimension: 3072 };
  }
}

module.exports = {
  saveVectors,
  loadVectors,
  deleteVectors,
  search,
  searchMultiDocs,
  cosineSimilarity,
  getVectorStoreStats,
};