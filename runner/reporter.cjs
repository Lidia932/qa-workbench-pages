const path = require('node:path');
const { stripVTControlCharacters } = require('node:util');

function reason(error) {
  return stripVTControlCharacters(error?.message || error?.value || '').slice(0, 5000);
}

module.exports = class WorkbenchReporter {
  onBegin(config, suite) {
    const tests = suite.allTests().map(test => {
      const file = path.relative(config.rootDir, test.location.file).split(path.sep).join('/');
      const titles = [test.title];
      for (let parent = test.parent; parent; parent = parent.parent) {
        if (parent.type === 'describe' && parent.title) titles.unshift(parent.title);
      }
      const project = test.parent.project()?.name;
      const selector = [...(project ? ['[' + project + ']'] : []), file, ...titles].join(' › ');
      return { id: test.id, group: file.includes('/') ? file.split('/')[0] : 'Общие',
        title: titles.join(' · '), file, selector };
    });
    const baseUrl = config.projects[0]?.use.baseURL;
    process.send({ type: 'catalog', tests, target: baseUrl ? new URL(baseUrl).origin : '' });
  }
  onTestBegin(test) { process.send({ type: 'running', id: test.id }); }
  onTestEnd(test, result) {
    const statuses = { expected: 'passed', unexpected: 'failed', flaky: 'flaky', skipped: 'skipped' };
    process.send({ type: 'result', id: test.id, status: statuses[test.outcome()],
      duration: result.duration, error: reason(result.error) });
  }
  onError(error) { process.send({ type: 'error', message: reason(error) }); }
  onEnd(result) { process.send({ type: 'end', status: result.status }); }
};
