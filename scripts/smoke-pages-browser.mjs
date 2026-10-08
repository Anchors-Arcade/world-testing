import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:4173/';
const candidates = [
  process.env.CHROME_BIN,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const browser = candidates.find((candidate) => existsSync(candidate)) || candidates.find((candidate) => !candidate.includes(':\\') && candidate.startsWith('/'));
assert.ok(browser, 'Set CHROME_BIN to a Chrome/Chromium executable to run the browser smoke test');

const profile = mkdtempSync(path.join(os.tmpdir(), 'anchors-pages-smoke-'));
const child = spawn(browser, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-extensions',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, url,
], { stdio: 'ignore' });
const exited = new Promise((resolve) => child.once('exit', resolve));
let cdp;
let socket;
try {
  const portFile = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 15000;
  while (!existsSync(portFile) && Date.now() < deadline && child.exitCode === null) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(existsSync(portFile), 'Chrome did not start its DevTools endpoint');
  const port = Number(readFileSync(portFile, 'utf8').split(/\r?\n/)[0]);
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page' && target.url.startsWith(url));
  assert.ok(page, `Chrome did not open ${url}`);

  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
    }
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => message.error ? reject(new Error(message.error.message)) : resolve(message));
    socket.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Runtime.enable');
  const titleDeadline = Date.now() + 15000;
  let guestButtonReady = false;
  while (!guestButtonReady && Date.now() < titleDeadline) {
    const result = await cdp('Runtime.evaluate', {
      expression: `Boolean(document.querySelector('#g'))`,
      returnByValue: true,
    });
    guestButtonReady = result.result.result.value;
    if (!guestButtonReady) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(guestButtonReady, 'title screen did not render its guest-play button');
  await cdp('Runtime.evaluate', { expression: `document.querySelector('#g')?.click()` });

  let state;
  const gameDeadline = Date.now() + 20000;
  do {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const result = await cdp('Runtime.evaluate', {
      expression: `JSON.stringify({canvases:document.querySelectorAll('#game canvas').length, veil:!!document.querySelector('.loading-veil'), startupError:document.querySelector('.startup-error')?.textContent || null})`,
      returnByValue: true,
    });
    state = JSON.parse(result.result.result.value);
    if (state.canvases && !state.veil) break;
  } while (Date.now() < gameDeadline);

  assert.ok(state.canvases > 0, `guest flow did not create a game canvas: ${JSON.stringify(state)}`);
  assert.equal(state.veil, false, 'room loading veil should disappear after the world enters');
  assert.equal(state.startupError, null, state.startupError || 'bootstrap reported a startup failure');
  assert.deepEqual(errors, [], `browser reported runtime errors: ${errors.join('\n')}`);
  console.log(`ok - GitHub Pages preview loads and the guest enters the game (${state.canvases} canvas)`);
} finally {
  try { await cdp?.('Browser.close'); } catch {}
  socket?.close();
  child.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
}
