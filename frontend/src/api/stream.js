import { API_BASE } from './client';

/**
 * POSTs to a streaming endpoint and reads Server-Sent Events as they arrive.
 * handlers: { onSources(sources), onDelta(text), onDone(answer) }
 * Throws an Error with a user-facing message on failure.
 * (axios can't read a response body progressively in the browser, so this uses fetch.)
 */
export async function streamPost(path, body, handlers = {}) {
  const token = sessionStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Your session expired. Please log in again.');
  }
  if (!res.ok || !res.body) {
    let message = `Request failed (${res.status})`;
    try {
      message = (await res.json()).error || message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Events are separated by a blank line
    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const event = raw.match(/^event: (.*)$/m)?.[1];
      const dataLine = raw.match(/^data: (.*)$/m)?.[1];
      if (!event || dataLine === undefined) continue;
      const data = JSON.parse(dataLine);

      if (event === 'sources') handlers.onSources?.(data);
      else if (event === 'delta') {
        answer += data.text;
        handlers.onDelta?.(data.text, answer);
      } else if (event === 'done') {
        answer = data.answer;
        handlers.onDone?.(answer);
      } else if (event === 'error') {
        throw new Error(data.error || 'Something went wrong while answering.');
      }
    }
  }
  return answer;
}
