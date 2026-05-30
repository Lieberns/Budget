const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'gastos.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
  }
}

function readGastos() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeGastos(gastos) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(gastos, null, 2), 'utf8');
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^([.][.][\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Acesso negado');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Arquivo não encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.ico': 'image/x-icon'
    };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  try {
    if (pathname === '/api/gastos' && req.method === 'GET') {
      return sendJson(res, 200, readGastos());
    }

    if (pathname === '/api/gastos' && req.method === 'POST') {
      const body = await getBody(req);
      const novo = JSON.parse(body || '{}');

      if (!novo.data || !novo.categoria || !novo.descricao || Number(novo.valor) <= 0) {
        return sendJson(res, 400, { error: 'Preencha data, categoria, descrição e valor válido.' });
      }

      const gastos = readGastos();
      const item = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        data: String(novo.data),
        categoria: String(novo.categoria),
        descricao: String(novo.descricao).trim(),
        valor: Number(novo.valor),
        observacao: String(novo.observacao || '').trim(),
        criadoEm: new Date().toISOString()
      };
      gastos.push(item);
      writeGastos(gastos);
      return sendJson(res, 201, item);
    }

    if (pathname.startsWith('/api/gastos/') && req.method === 'DELETE') {
      const id = decodeURIComponent(pathname.split('/').pop());
      const gastos = readGastos();
      const filtrados = gastos.filter(g => g.id !== id);
      writeGastos(filtrados);
      return sendJson(res, 200, { ok: true });
    }

    return serveStatic(req, res, pathname);
  } catch (error) {
    return sendJson(res, 500, { error: 'Erro interno: ' + error.message });
  }
});

server.listen(PORT, () => {
  console.log('Devil Budget Lite rodando em: http://localhost:' + PORT);
  console.log('Sem npm install. Use apenas: npm start');
});
