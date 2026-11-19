const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const { fork } = require('node:child_process');
const readline = require('node:readline/promises');
const { stripVTControlCharacters } = require('node:util');

const port = Number(process.env.QA_WORKBENCH_PORT || 41731);
const host = '127.0.0.1:' + port;
const origin = 'http://' + host;
const reporter = path.join(__dirname, 'reporter.cjs');
const source = require('./source.cjs');
const assets = new Map([
  ['/', ['panel.html', 'text/html']], ['/panel.js', ['panel.js', 'text/javascript']],
  ['/style.css', ['style.css', 'text/css']], ['/theme.css', ['theme.css', 'text/css']],
  ['/theme.js', ['theme.js', 'text/javascript']], ['/autotests.css', ['autotests.css', 'text/css']]
]);

function playwright(dir) { return path.join(dir, 'node_modules', '@playwright', 'test', 'cli.js'); }
function isRepo(dir) { return fs.existsSync(path.join(dir, 'playwright.config.js')); }
async function chooseRepo() {
  if (process.argv[2]) return path.resolve(process.argv[2]);
  for (const dir of [process.cwd(), path.dirname(__dirname), path.resolve(__dirname, '../cloud-e2e-git'),
    path.resolve(__dirname, '../../cloud-e2e-git')]) {
    if (isRepo(dir)) return dir;
  }
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try { return path.resolve((await input.question('Путь к папке cloud-e2e: ')).trim().replace(/^"|"$/g, '')); }
  finally { input.close(); }
}

function launch(repo, args, onEvent) {
  return new Promise((resolve, reject) => {
    const child = fork(playwright(repo), ['test', '--config=playwright.config.js', '--reporter', reporter, ...args],
      { cwd: repo, silent: true, windowsHide: true, execArgv: [] });
    let diagnostics = '';
    const capture = chunk => { diagnostics = (diagnostics + chunk).slice(-4000); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('message', onEvent);
    child.once('error', reject);
    child.once('close', code => resolve({ code, diagnostics: stripVTControlCharacters(diagnostics) }));
  });
}

async function serve(repo) {
  if (!isRepo(repo) || !fs.existsSync(playwright(repo))) throw Error('Нужна подготовленная копия cloud-e2e. Проверьте путь и установку зависимостей по README.');
  let current = null;
  let catalog, loading;
  async function syncCatalog() {
    if (catalog && await source.head() === catalog.revision) return catalog;
    const copy = await source.snapshot(repo);
    try {
      let tests, target, listingError;
      const listing = await launch(copy.dir, ['--list'], event => {
        if (event.type === 'catalog') { tests = event.tests; target = event.target; }
        if (event.type === 'error') listingError = event.message;
      });
      if (listing.code !== 0 || !tests) throw Error(listingError || 'Playwright не смог прочитать список сценариев.');
      catalog?.dispose();
      catalog = { ...copy, tests, target, byId: new Map(tests.map(test => [test.id, test])) };
      return catalog;
    } catch (error) { copy.dispose(); throw error; }
  }
  function latest() {
    if (current?.status === 'running') return Promise.resolve(catalog);
    loading ??= syncCatalog().finally(() => { loading = null; });
    return loading;
  }
  process.once('exit', () => { if (current?.status !== 'running') catalog?.dispose(); });

  async function execute(selected, run) {
    const rows = new Map(run.rows.map(row => [row.id, row]));
    let temp;
    try {
      temp = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-run-'));
      const list = path.join(temp, 'selection.txt');
      fs.writeFileSync(list, selected.map(test => test.selector).join('\n'));
      let outcome;
      let sequence = 0;
      const { code, diagnostics } = await launch(catalog.dir, ['--test-list', list, '--workers=1'], event => {
        if (event.type === 'error') run.error = event.message;
        if (event.type === 'end') outcome = event.status;
        const row = rows.get(event.id);
        if (!row) return;
        row.order ??= ++sequence;
        if (event.type === 'running') row.status = 'running';
        if (event.type === 'result') Object.assign(row, { status: event.status, duration: event.duration, error: event.error });
      });
      const incomplete = run.rows.some(row => ['queued','running'].includes(row.status));
      run.status = code === 0 && outcome === 'passed' && !incomplete ? 'done' : 'failed';
      if (run.status === 'failed' && !run.error && !run.rows.some(row => row.error)) {
        run.error = diagnostics || 'Playwright не завершил все выбранные сценарии. Проверьте стенд и актуальность списка тестов.';
      }
    } catch (error) { run.status = 'failed'; run.error = error.message; }
    finally {
      for (const row of run.rows) if (['running', 'queued'].includes(row.status)) row.status = 'unfinished';
      if (temp) fs.rmSync(temp, { recursive: true, force: true });
    }
  }

  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
    if (req.headers.host !== host) return send(403, 'Доступ только с этого компьютера.');
    try {
      if (req.url.startsWith('/api/') && req.headers['sec-fetch-site'] === 'cross-site') return send(403, 'Откройте локальный пульт.');
      if (req.method === 'GET' && req.url === '/api/catalog') {
        const { revision, target, tests } = await latest();
        return send(200, { revision, target, tests: tests.map(({ selector, ...test }) => test) });
      }
      if (req.method === 'GET' && req.url === '/api/run') return send(200, current);
      if (req.method === 'POST' && req.url === '/api/run') {
        if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') return send(403, 'Запуск доступен из локального пульта.');
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 100000) return send(413, 'Слишком большой выбор.');
        }
        const { ids, revision } = JSON.parse(body) || {};
        if (current?.status === 'running') return send(409, 'Дождитесь окончания текущего прогона.');
        const fresh = await latest();
        if (current?.status === 'running') return send(409, 'Дождитесь окончания текущего прогона.');
        if (revision !== fresh.revision) return send(412, 'В Stash изменились тесты. Проверьте обновлённый список и подтвердите запуск.');
        const { byId } = fresh;
        if (!Array.isArray(ids) || !ids.length || ids.some(id => !byId.has(id))) return send(400, 'Выберите тесты из каталога.');
        const selected = [...new Set(ids)].map(id => byId.get(id));
        current = { status: 'running', revision, started: Date.now(), rows: selected.map(({ id, title }) => ({ id, title, status: 'queued' })) };
        void execute(selected, current);
        return send(202, current);
      }
      const asset = req.method === 'GET' && assets.get(req.url.split('?')[0]);
      if (!asset) return send(404, 'Не найдено.');
      const [name, type] = asset;
      const file = [path.join(__dirname, name), path.join(__dirname, '..', name)].find(fs.existsSync);
      const content = fs.readFileSync(file);
      res.writeHead(200, { 'Content-Type': type + '; charset=utf-8' });
      res.end(content);
    } catch (error) { send(error instanceof SyntaxError ? 400 : 503, error instanceof SyntaxError ? 'Не удалось прочитать выбор тестов.' : error.message); }
  });
  server.on('error', err => { console.error(err.code === 'EADDRINUSE' ? 'Порт занят. Если пульт уже открыт, используйте его окно.' : err.message); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log('Пульт готов: ' + origin));
}
chooseRepo().then(serve).catch(error => { console.error(error.message); process.exitCode = 1; });
