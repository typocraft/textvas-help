const http = require('http');
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const clients = [];

fs.watch(dir, { recursive: true }, (ev, filename) => {
  if (filename && !filename.includes('serve.js')) {
    clients.forEach(res => {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
      res.write('data: reload\n\n');
      res.end();
    });
    clients.length = 0;
  }
});

const liveReloadScript = `<script>
(function(){var es;function connect(){es=new EventSource('/__livereload');es.onmessage=function(){location.reload()};es.onerror=function(){es.close();setTimeout(connect,1000)}}connect()})();
</script>`;

http.createServer((req, res) => {
  if (req.url === '/__livereload') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    clients.push(res);
    req.on('close', () => { const i = clients.indexOf(res); if (i !== -1) clients.splice(i, 1); });
    return;
  }
  let p = path.join(dir, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(p);
    const ct = mime[ext] || 'application/octet-stream';
    if (ext === '.html') {
      let html = data.toString();
      html = html.replace('</body>', liveReloadScript + '</body>');
      res.writeHead(200, { 'Content-Type': ct });
      res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': ct });
      res.end(data);
    }
  });
}).listen(3000, () => console.log('Live reload server running on port 3000'));
