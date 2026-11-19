const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const exec = require('node:util').promisify(execFile);

const remote = 'https://stash.roistat.com/scm/main/cloud-e2e.git';
const branch = 'master';
const gitOptions = { windowsHide: true, timeout: 90000,
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } };

async function head() {
  try {
    const { stdout } = await exec('git', ['ls-remote', '--exit-code', remote, 'refs/heads/' + branch], gitOptions);
    const sha = stdout.split(/\s/)[0];
    if (/^[a-f0-9]{40}$/.test(sha)) return sha;
  } catch { /* Report connection and sign-in failures without exposing credentials. */ }
  throw Error('Не удалось проверить master в Stash. Проверьте доступ к рабочей сети и вход в Git, затем обновите страницу.');
}

function sameManifest(local, copy, name) {
  return fs.readFileSync(path.join(local, name), 'utf8').replaceAll('\r\n', '\n') ===
    fs.readFileSync(path.join(copy, name), 'utf8').replaceAll('\r\n', '\n');
}

async function snapshot(local) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-stash-'));
  const links = [];
  const dispose = () => {
    // Detach borrowed directories before removing the private temporary clone.
    for (const link of links) if (fs.lstatSync(link, { throwIfNoEntry: false })?.isSymbolicLink()) fs.unlinkSync(link);
    fs.rmSync(dir, { recursive: true, force: true });
  };
  function linkDirectory(name) {
    const dest = path.join(dir, name);
    fs.symlinkSync(path.resolve(local, name), dest, process.platform === 'win32' ? 'junction' : 'dir');
    links.push(dest);
  }
  try {
    try { await exec('git', ['clone', '--quiet', '--depth=1', '--single-branch', '--branch', branch, remote, dir], gitOptions); }
    catch { throw Error('Не удалось загрузить тесты из Stash. Проверьте доступ к cloud-e2e и повторите попытку.'); }
    const { stdout } = await exec('git', ['-C', dir, 'rev-parse', 'HEAD'], gitOptions);
    if (fs.existsSync(path.join(local, 'config.js'))) {
      fs.writeFileSync(path.join(dir, 'config.js'), 'module.exports = require(' + JSON.stringify(path.resolve(local, 'config.js')) + ');', { flag: 'wx' });
    }
    fs.mkdirSync(path.join(local, 'artifacts'), { recursive: true });
    linkDirectory('artifacts');
    if (['package.json', 'package-lock.json'].every(name => sameManifest(local, dir, name))) {
      linkDirectory('node_modules');
    } else {
      try { await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['ci', '--no-audit', '--no-fund'],
        { cwd: dir, windowsHide: true, shell: process.platform === 'win32', timeout: 300000 }); }
      catch { throw Error('Изменились зависимости тестов. Не удалось установить их по package-lock.json из Stash. Проверьте доступ к npm.'); }
    }
    return { dir, revision: stdout.trim(), dispose };
  } catch (error) { dispose(); throw error; }
}
module.exports = { head, snapshot };
