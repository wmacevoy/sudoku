import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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
      if (pathname === '/') pathname = '/contest.html';
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
  const options = new chrome.Options().addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  );
  const service = new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH || '/usr/bin/chromedriver');
  return new Builder().forBrowser('chrome').setChromeOptions(options).setChromeService(service).build();
}

async function withContestPage(handler) {
  const server = createStaticServer(docsRoot);
  await new Promise((resolveFn) => server.listen(0, resolveFn));
  const { port } = server.address();
  const url = new URL(`http://127.0.0.1:${port}/contest.html`);
  const driver = await buildDriver();

  try {
    await driver.get(url.toString());
    await handler(driver);
  } finally {
    await driver.quit();
    server.close();
  }
}

function countPdfPages(base64Pdf) {
  const text = Buffer.from(base64Pdf, 'base64').toString('latin1');
  const matches = text.match(/\/Type\s*\/Page\b/g);
  return matches ? matches.length : 0;
}

test(
  'printing default contest keeps one puzzle per PDF page',
  { timeout: 60000 },
  async () => {
    await withContestPage(async (driver) => {
      // Prevent the UI click from opening the print dialog in headless Chrome.
      await driver.executeScript(() => {
        window.print = () => {};
      });
      const printBtn = await driver.findElement(By.id('btn-print'));
      await printBtn.click();

      await driver.wait(until.elementsLocated(By.css('#print-area .page')), 20000);
      const expectedPages = await driver.executeScript(() => {
        return document.querySelectorAll('#print-area .page').length;
      });
      assert.ok(expectedPages > 0, 'default contest should create pages to print');

      // Allow layout to settle before printing
      await driver.sleep(250);

      const pdfBase64 = await driver.printPage();
      const pdfPages = countPdfPages(pdfBase64);
      assert.equal(
        pdfPages,
        expectedPages,
        'PDF page count should match generated puzzle pages (one per page)'
      );
    });
  }
);
