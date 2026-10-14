/**
 * Voice Utilities: Markdown cleaning, voice selection, and audio synthesis helpers
 */

/**
 * Strips markdown syntax, citations, code blocks, and URLs to produce
 * smooth, natural, clean spoken sentences for Text-to-Speech engines.
 */
export function cleanTextForSpeech(text) {
  if (!text) return '';

  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
      // Remove inline code
      .replace(/`([^`]+)`/g, '$1')
      // Remove document/chunk citation tags like [Source 1: Filename · Page 2] or [Chunk 1 - Page 3]
      .replace(/\[(?:Source|Chunk|Doc)[^\]]*\]/gi, '')
      // Remove markdown links [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove URLs
      .replace(/https?:\/\/\S+/g, '')
      // Remove bold/italic markers
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
      // Remove markdown headers (# Title)
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bullet markers and numbering (- or * or 1.)
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove blockquotes (> quote)
      .replace(/^>\s+/gm, '')
      // Collapse multiple spaces and newlines into clean single punctuation pauses
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Retrieves the best available natural English speech synthesis voice
 */
export function getPreferredVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;

  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  // Priority order for natural-sounding English voices across OS platforms
  const preferredNames = [
    'Google US English',
    'Google UK English Female',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Samantha',
    'Daniel',
    'Karen',
    'Victoria',
  ];

  for (const name of preferredNames) {
    const found = voices.find((v) => v.name.includes(name));
    if (found) return found;
  }

  // Fallback to any English voice
  const anyEnglish = voices.find((v) => v.lang.startsWith('en'));
  return anyEnglish || voices[0] || null;
}
