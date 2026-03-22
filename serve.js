const http = require('http');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const port = 3000;
const clients = new Set();

const mime = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function toRelative(filePath) {
  return path.relative(dir, filePath).replace(/\\/g, '/');
}

function shouldIgnore(filePath) {
  const rel = toRelative(filePath);
  if (!rel || rel.startsWith('..')) return true;
  return rel === 'serve.js' || rel.endsWith('.log');
}

function broadcastReload(reason) {
  for (const res of clients) {
    try {
      res.write(`data: reload:${reason}\n\n`);
    } catch (_err) {
      clients.delete(res);
    }
  }
}

function snapshotFiles(root) {
  const out = [];
  const stack = [root];

  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch (_err) {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git') continue;
        stack.push(fullPath);
        continue;
      }
      if (shouldIgnore(fullPath)) continue;
      try {
        const stat = fs.statSync(fullPath);
        out.push(`${toRelative(fullPath)}:${stat.mtimeMs}`);
      } catch (_err) {
        // Ignore transient read failures during save/rename.
      }
    }
  }

  out.sort();
  return out.join('|');
}

let lastSnapshot = snapshotFiles(dir);

// Fast path for immediate updates when fs.watch fires reliably.
try {
  fs.watch(dir, { recursive: true }, (_eventType, filename) => {
    const name = filename ? filename.replace(/\\/g, '/') : '';
    if (name === 'serve.js') return;
    broadcastReload(name || 'watch');
  });
} catch (_err) {
  // Some environments reject recursive watch; polling below still works.
}

// Reliable fallback: polling catches editors that use atomic rename on save.
setInterval(() => {
  const next = snapshotFiles(dir);
  if (next !== lastSnapshot) {
    lastSnapshot = next;
    broadcastReload('poll');
  }
}, 400);

// Keep SSE connections alive through proxies/idle timeouts.
setInterval(() => {
  for (const res of clients) {
    try {
      res.write(': ping\n\n');
    } catch (_err) {
      clients.delete(res);
    }
  }
}, 15000);

const liveReloadScript = `<script>
(function(){
  var es;
  function connect(){
    es = new EventSource('/__livereload');
    es.onmessage = function(){ location.reload(); };
    es.onerror = function(){ es.close(); setTimeout(connect, 1000); };
  }
  connect();
})();
</script>`;

http.createServer((req, res) => {
  if (req.url === '/__livereload') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  const rawPath = req.url === '/' ? '/index.html' : req.url;
  const safePath = path.normalize(decodeURIComponent(rawPath)).replace(/^(\.\.[/\\])+/, '');
  const filePath = path.join(dir, safePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mime[ext] || 'application/octet-stream';

    if (ext === '.html') {
      let html = data.toString();
      if (html.includes('</body>')) {
        html = html.replace('</body>', `${liveReloadScript}</body>`);
      } else {
        html += liveReloadScript;
      }
      res.writeHead(200, { 'Content-Type': `${contentType}; charset=utf-8` });
      res.end(html);
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`Live reload server running on port ${port}`);
});
