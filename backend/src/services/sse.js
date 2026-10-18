/**
 * Minimal Server-Sent Events writer for streaming answers to the browser.
 * Events: "sources" (citations), "delta" ({ text }), "done" ({ answer }), "error" ({ error }).
 */
function openStream(res) {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // stop nginx-style proxies buffering the stream
  res.flushHeaders?.();

  return {
    send(event, data) {
      if (res.writableEnded) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    end() {
      if (!res.writableEnded) res.end();
    },
  };
}

module.exports = { openStream };
