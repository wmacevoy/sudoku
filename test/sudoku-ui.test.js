import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Builder, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = resolve(__dirname, '../docs');

function contentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    }[ext] || 'application/octet-stream'
  );
}

function createStaticServer(rootDir) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === '/') pathname = '/index.html';
      const filePath = join(rootDir, pathname);
      const resolved = resolve(filePath);
      if (!resolved.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      await stat(resolved);
      const data = await readFile(resolved);
      res.writeHead(200, { 'Content-Type': contentType(resolved) });
      res.end(data);
    } catch (err) {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  return server;
}

async function buildDriver() {
  const options = new chrome.Options()
    .addArguments('--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu');
  const service = new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH || '/usr/bin/chromedriver');
  return new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .setChromeService(service)
    .build();
}

async function withPage(t, handler) {
  const server = createStaticServer(docsRoot);
  await new Promise((resolveFn) => server.listen(0, resolveFn));
  const { port } = server.address();
  const url = new URL(`http://127.0.0.1:${port}/index.html`);
  url.searchParams.set('seed', 'ui-test-seed');
  const driver = await buildDriver();

  try {
    await driver.get(url.toString());
    await handler(driver);
  } finally {
    await driver.quit();
    server.close();
  }
}

test('UI renders grid and keypad', async (t) => {
  await withPage(t, async (driver) => {
    await driver.wait(until.elementsLocated(By.css('.cell')), 10000);
    const cells = await driver.findElements(By.css('.cell'));
    assert.equal(cells.length, 81, 'should render 81 grid cells');
    const keypadButtons = await driver.findElements(By.css('#keypad button'));
    assert.equal(keypadButtons.length, 10, 'should render keypad digits and ?');
  });
});

test('New button updates legend', async (t) => {
  await withPage(t, async (driver) => {
    const legend = await driver.findElement(By.id('legend'));
    const btnNew = await driver.findElement(By.id('btn-new'));
    await btnNew.click();
    await driver.wait(until.elementTextContains(legend, 'New'), 5000);
    const text = await legend.getText();
    assert.match(text, /New \w+ puzzle loaded\./);
  });
});

test('Toggle options button toggles state', async (t) => {
  await withPage(t, async (driver) => {
    const btnToggle = await driver.findElement(By.id('btn-toggle-options'));
    await btnToggle.click();
    await driver.wait(async () => {
      const cls = await btnToggle.getAttribute('class');
      return cls.includes('active');
    }, 3000);
    const cls = await btnToggle.getAttribute('class');
    assert.match(cls, /active/);
  });
});

test('Solve button fills the board', async (t) => {
  await withPage(t, async (driver) => {
    const btnSolve = await driver.findElement(By.id('btn-solve'));
    await btnSolve.click();
    const legend = await driver.findElement(By.id('legend'));
    await driver.wait(until.elementTextContains(legend, 'Solved'), 10000);
    const filled = await driver.executeScript(() => {
      return Array.from(document.querySelectorAll('.cell .value')).filter(
        (el) => el.textContent.trim() !== ''
      ).length;
    });
    assert.equal(filled, 81, 'all cells should be filled after solve');
  });
});
