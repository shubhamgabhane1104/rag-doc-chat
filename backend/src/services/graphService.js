const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/db');
const { callGeminiWithFallback } = require('./geminiClient');

/**
 * Samples chunks evenly if the document has many chunks,
 * ensuring the knowledge graph spans the entire document.
 */
function sampleChunks(chunks, maxChunks = 16) {
  if (!chunks || chunks.length <= maxChunks) {
    return chunks || [];
  }

  const sampled = [];
  const step = (chunks.length - 1) / (maxChunks - 1);

  for (let i = 0; i < maxChunks; i++) {
    const index = Math.round(i * step);
    if (chunks[index] && !sampled.includes(chunks[index])) {
      sampled.push(chunks[index]);
    }
  }

  return sampled;
}

/**
 * Cleanly strips markdown code fences and parses JSON safely
 */
function parseJsonSafely(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
    cleaned = cleaned.replace(/\n?```$/, '');
  }
  return JSON.parse(cleaned.trim());
}

/**
 * Generates an Entity-Relationship Knowledge Graph for a document
 */
async function generateKnowledgeGraph(documentId, userId) {
  // 1. Fetch document chunks
  const chunksResult = await pool.query(
    'SELECT chunk_index, page_number, chunk_text FROM chunks WHERE document_id = $1 ORDER BY chunk_index ASC',
    [documentId]
  );

  const chunks = chunksResult.rows;
  if (!chunks || chunks.length === 0) {
    throw new Error('No readable text content found for this document.');
  }

  const sampled = sampleChunks(chunks, 16);
  const contextText = sampled
    .map((c) => `[Page ${c.page_number || 1}]\n${c.chunk_text}`)
    .join('\n\n---\n\n');

  const prompt = `You are a world-class knowledge engineer and cognitive graph specialist.
Analyze the following document excerpts and extract an interconnected Concept Knowledge Graph (Entities and Relationships).

Extract 10 to 18 prominent concepts/entities and the directed semantic relationships between them.

Respond ONLY with valid JSON matching this schema exactly:
{
  "centralTopic": "Central theme or subject of this document",
  "summary": "1-2 sentence high-level overview of the conceptual structure",
  "nodes": [
    {
      "id": "snake_case_unique_id",
      "label": "Human Readable Name (2-4 words)",
      "category": "Architecture" | "Algorithm" | "Component" | "Security" | "Metric" | "Concept",
      "description": "Clear 1-2 sentence explanation of this concept based on the document.",
      "page": 1,
      "importance": 1
    }
  ],
  "edges": [
    {
      "source": "snake_case_id_of_source_node",
      "target": "snake_case_id_of_target_node",
      "relation": "short relationship verb (e.g. implements, optimizes, depends on, communicates with, secures, composed of)"
    }
  ]
}

Guidelines:
1. Ensure the central topic is represented as importance: 1. Main sub-topics are importance: 2. Specific terms/metrics are importance: 3.
2. Only create edges between nodes that actually exist in the "nodes" list.
3. Keep descriptions factual and strictly grounded in the document context.
4. "page" should be the actual page number where the concept appears in the excerpts (integer).
5. Do NOT include markdown code fences or conversational text. Output pure JSON only.

Document Content Excerpts:
${contextText}`;

  // 2. Call Gemini with resilient multi-tier fallback
  const response = await callGeminiWithFallback({
    contents: prompt,
  });

  const parsed = parseJsonSafely(response.text);

  if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    throw new Error('Failed to extract valid graph nodes from document.');
  }

  // 3. Clean and cross-validate nodes and edges
  const validNodeIds = new Set(parsed.nodes.map((n) => n.id));
  const cleanEdges = (parsed.edges || []).filter(
    (e) => validNodeIds.has(e.source) && validNodeIds.has(e.target) && e.source !== e.target
  );

  const graphId = uuidv4();
  const centralTopic = parsed.centralTopic || 'Core Document Architecture';
  const summary = parsed.summary || 'Overview of key concepts and technical relationships.';

  // 4. Upsert into database
  await pool.query('DELETE FROM document_knowledge_graphs WHERE document_id = $1 AND user_id = $2', [
    documentId,
    userId,
  ]);

  await pool.query(
    `INSERT INTO document_knowledge_graphs (id, document_id, user_id, central_topic, summary, nodes, edges)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      graphId,
      documentId,
      userId,
      centralTopic,
      summary,
      JSON.stringify(parsed.nodes),
      JSON.stringify(cleanEdges),
    ]
  );

  return {
    id: graphId,
    documentId,
    centralTopic,
    summary,
    nodes: parsed.nodes,
    edges: cleanEdges,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Retrieves the cached Knowledge Graph for a document
 */
async function getKnowledgeGraph(documentId, userId) {
  const result = await pool.query(
    'SELECT * FROM document_knowledge_graphs WHERE document_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1',
    [documentId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    documentId: row.document_id,
    centralTopic: row.central_topic,
    summary: row.summary,
    nodes: typeof row.nodes === 'string' ? JSON.parse(row.nodes) : row.nodes,
    edges: typeof row.edges === 'string' ? JSON.parse(row.edges) : row.edges,
    createdAt: row.created_at,
  };
}

/**
 * Deletes cached Knowledge Graph for regeneration
 */
async function deleteKnowledgeGraph(documentId, userId) {
  await pool.query('DELETE FROM document_knowledge_graphs WHERE document_id = $1 AND user_id = $2', [
    documentId,
    userId,
  ]);
}

module.exports = {
  generateKnowledgeGraph,
  getKnowledgeGraph,
  deleteKnowledgeGraph,
};
