/**
 * LLMs sometimes wrap JSON in ``` fences or add a sentence around it.
 * Strip that and parse; fall back to the first {...} or [...] block.
 */
function parseJsonSafely(rawText) {
  let cleaned = String(rawText || '').trim();
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // fall through to the friendly error below
      }
    }
    throw new Error('The AI returned an unexpected format. Please try again.');
  }
}

/**
 * Accepts either an array or an object that wraps one
 * (e.g. { "questions": [...] }) and returns the array.
 */
function extractArray(parsed) {
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const arr = Object.values(parsed).find(Array.isArray);
    if (arr) return arr;
  }
  return [];
}

module.exports = { parseJsonSafely, extractArray };
