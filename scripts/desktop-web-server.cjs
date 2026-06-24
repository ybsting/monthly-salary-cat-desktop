const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const logsDir = path.join(projectRoot, 'logs');
const port = 1420;

fs.mkdirSync(logsDir, { recursive: true });

const serverLog = path.join(logsDir, 'desktop-web-server.log');

function appendLog(message) {
  fs.appendFileSync(serverLog, `[${new Date().toISOString()}] ${message}\n`, 'utf8');
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.webp': 'image/webp',
  };
  return types[ext] || 'application/octet-stream';
}

function safeResolve(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]).replace(/^\/+/, '');
  const requestedPath = path.resolve(distDir, cleanPath || 'index.html');
  if (!requestedPath.startsWith(distDir)) {
    return null;
  }
  return requestedPath;
}

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  appendLog(`Missing dist/index.html at ${distDir}`);
  process.exit(1);
}

const server = http.createServer((request, response) => {
  const resolvedPath = safeResolve(request.url || '/');
  if (!resolvedPath) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  const filePath = fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()
    ? resolvedPath
    : path.join(distDir, 'index.html');

  fs.readFile(filePath, (error, data) => {
    if (error) {
      appendLog(`Failed to read ${filePath}: ${error.message}`);
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Internal Server Error');
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType(filePath) });
    response.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  appendLog(`Desktop web server listening on http://127.0.0.1:${port}/`);
});

function shutdown() {
  appendLog('Desktop web server shutting down.');
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
