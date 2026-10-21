// Unit tests for the frontend text-to-speech helper.  Run with:  npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanTextForSpeech } from '../src/utils/voiceUtils.js';

test('UT30 cleanTextForSpeech: removes markdown, citations and links', () => {
  const out = cleanTextForSpeech('## Answer\n**Osmosis** is [Source 1: notes.txt · Page 2] water movement. See [docs](https://x.y).');
  assert.equal(out.includes('#'), false);
  assert.equal(out.includes('**'), false);
  assert.equal(out.includes('Source 1'), false);
  assert.equal(out.includes('https://'), false);
  assert.match(out, /Osmosis is +water movement/);
  assert.match(out, /See docs/);
});

test('UT31 cleanTextForSpeech: code blocks are not read aloud', () => {
  assert.match(cleanTextForSpeech('Run this:\n```js\nconsole.log(1)\n```'), /Code snippet omitted/);
});

test('UT32 cleanTextForSpeech: empty input gives empty string', () => {
  assert.equal(cleanTextForSpeech(''), '');
  assert.equal(cleanTextForSpeech(null), '');
});

test('UT33 cleanTextForSpeech: a link whose text starts with "Doc" keeps its text (regression test for DEF-01)', () => {
  assert.equal(cleanTextForSpeech('Read the [Documentation](https://react.dev) first.'), 'Read the Documentation first.');
});
