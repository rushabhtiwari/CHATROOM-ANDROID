/**
 * Drive the KiranOS APK on an emulator and check what only a device shows.
 *
 * The unit tests run the screens in jsdom; they cannot see the native shell.
 * This installs the real APK, uses it through real taps and the real
 * keyboard, and reads the web view's state over the DevTools protocol (a debug
 * build exposes it). It checks:
 *
 *   - the app starts, renders the chat list, and does not crash
 *   - the web view starts below the status bar, not under it
 *   - a tapped conversation opens
 *   - the web view shrinks for the keyboard and the composer stays above it
 *   - typed text reaches the composer, and a sent message appears
 *   - the Back button returns to the chat list
 *   - conversations survive a restart (the file-backed storage)
 *
 * Screenshots, the log and a report are written to $SMOKE_OUT (default
 * `smoke/`). Exits non-zero if any check fails.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const PKG = 'in.kirancable.kiranos';
const APK = process.env.APK ?? 'KiranOS.apk';
const OUT = process.env.SMOKE_OUT ?? 'smoke';
const MESSAGE = 'Hello from Android';
const COMPOSER = 'textarea[aria-label="Message"]';

mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const adb = (...args) => execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 << 20 });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function shot(name) {
  const png = execFileSync('adb', ['exec-out', 'screencap', '-p'], { maxBuffer: 64 << 20 });
  writeFileSync(`${OUT}/${name}.png`, png);
}

function launch() {
  adb('shell', 'am', 'start', '-W', '-n', `${PKG}/.MainActivity`);
}

/** Attach to the app's web view over the DevTools protocol. */
async function connect() {
  let pid = '';
  for (let i = 0; i < 20 && !pid; i++) {
    try {
      pid = adb('shell', 'pidof', PKG).trim();
    } catch {
      await sleep(1000);
    }
  }
  if (!pid) throw new Error('the app is not running');

  adb('forward', '--remove-all');
  adb('forward', 'tcp:9222', `localabstract:webview_devtools_remote_${pid}`);

  let page;
  for (let i = 0; i < 30 && !page; i++) {
    try {
      const targets = await (await fetch('http://127.0.0.1:9222/json')).json();
      page = targets.find((target) => target.type === 'page');
    } catch {
      /* the socket appears once the web view has started */
    }
    if (!page) await sleep(1000);
  }
  if (!page) throw new Error('no web view to attach to');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let sequence = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = ++sequence;
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evaluate = async (expression) => {
    const { result, error } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (error) throw new Error(error.message);
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    }
    return result.result.value;
  };

  return { pid, evaluate, close: () => ws.close() };
}

/** Where the web view sits on screen, in device pixels. */
function webviewBounds() {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml');
      const xml = adb('shell', 'cat', '/sdcard/ui.xml');
      const match = xml.match(
        /class="android\.webkit\.WebView"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/,
      );
      if (match) {
        const [left, top, right, bottom] = match.slice(1).map(Number);
        return { left, top, right, bottom };
      }
    } catch (error) {
      console.log(`uiautomator dump failed: ${error.message.split('\n')[0]}`);
    }
  }
  return null;
}

/** The bottom edge of the status bar, in device pixels, if the system reports it. */
function statusBarBottom() {
  const dump = adb('shell', 'dumpsys', 'window');
  const match = dump.match(
    /type=(?:statusBars|ITYPE_STATUS_BAR)[^\n]*?frame=\[\d+,\d+\]\[\d+,(\d+)\]/,
  );
  return match ? Number(match[1]) : null;
}

let origin = { left: 0, top: 0 };

/** A real tap, through the touchscreen, on the first element matching `selector`. */
async function tap(app, selector) {
  const point = await app.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, dpr: devicePixelRatio };
  })()`);
  if (!point) throw new Error(`nothing matches ${selector}`);
  const x = Math.round(origin.left + point.x * point.dpr);
  const y = Math.round(origin.top + point.y * point.dpr);
  adb('shell', 'input', 'tap', String(x), String(y));
}

async function run() {
  const webview = adb('shell', 'dumpsys', 'webviewupdate').match(/Current WebView package[^\n]*/);
  console.log(`Android ${adb('shell', 'getprop', 'ro.build.version.release').trim()}, ${webview?.[0] ?? 'WebView unknown'}`);

  // An emulator may report a hardware keyboard, and Android then never shows
  // the on-screen one — which is the one the composer has to stay above.
  adb('shell', 'settings', 'put', 'secure', 'show_ime_with_hard_keyboard', '1');

  adb('install', '-r', APK);
  adb('logcat', '-c');
  launch();
  await sleep(12000);
  shot('1-chats');

  let app = await connect();
  check('the app is running after launch', true, `pid ${app.pid}`);

  const start = await app.evaluate(`({
    path: location.pathname,
    origin: location.origin,
    rendered: document.getElementById('root')?.childElementCount ?? 0,
    rows: document.querySelectorAll('li [role=button]').length,
    userAgent: navigator.userAgent,
  })`);
  console.log(`User agent: ${start.userAgent}`);
  check('the chat list is the first screen', start.path === '/chats', start.path);
  check('the bundle is served from http://localhost', start.origin === 'http://localhost', start.origin);
  check('the chat list rendered', start.rendered > 0 && start.rows > 0, `${start.rows} conversations`);

  const bounds = webviewBounds();
  const barBottom = statusBarBottom();
  if (bounds) origin = bounds;
  else if (barBottom !== null) origin = { left: 0, top: barBottom };
  check(
    'the web view starts below the status bar',
    bounds && bounds.top > 0 && (barBottom === null || bounds.top >= barBottom),
    `web view top ${bounds?.top ?? '?'}px, status bar bottom ${barBottom ?? '?'}px`,
  );

  await tap(app, 'li [role=button]');
  await sleep(2500);
  const room = await app.evaluate('location.pathname');
  check('tapping a conversation opens it', /^\/chats\/[^/]+$/.test(room), room);
  shot('2-conversation');

  const heightBefore = await app.evaluate('innerHeight');
  await tap(app, COMPOSER);
  await sleep(3000);
  const keyboard = await app.evaluate(`(() => {
    const t = document.querySelector(${JSON.stringify(COMPOSER)});
    const r = t.getBoundingClientRect();
    return { focused: document.activeElement === t, height: innerHeight, top: r.top, bottom: r.bottom };
  })()`);
  shot('3-keyboard');
  check('the composer takes focus', keyboard.focused);
  check(
    'the web view shrinks for the keyboard',
    keyboard.height < heightBefore - 100,
    `${heightBefore} -> ${keyboard.height} CSS px`,
  );
  check(
    'the composer stays above the keyboard',
    keyboard.top >= 0 && keyboard.bottom <= keyboard.height,
    `composer ${Math.round(keyboard.top)}-${Math.round(keyboard.bottom)} of ${keyboard.height}`,
  );

  adb('shell', 'input', 'text', MESSAGE.replaceAll(' ', '%s'));
  await sleep(1500);
  const typed = await app.evaluate(`document.querySelector(${JSON.stringify(COMPOSER)}).value`);
  check('typing reaches the composer', typed === MESSAGE, JSON.stringify(typed));

  await tap(app, 'button[aria-label="Send"]');
  await sleep(3000);
  const sent = await app.evaluate(`document.body.innerText.includes(${JSON.stringify(MESSAGE)})`);
  shot('4-sent');
  check('the sent message appears in the conversation', sent);

  // The first Back closes the keyboard if it is still open; the next leaves
  // the conversation. A Back on the chat list would close the app, so stop
  // as soon as it is there.
  let path = room;
  for (let press = 0; press < 2 && path !== '/chats'; press++) {
    adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await sleep(1500);
    path = await app.evaluate('location.pathname');
  }
  shot('5-back');
  check('the Back button returns to the chat list', path === '/chats', path);

  // Saves are queued, not delayed; give the queue a moment to drain.
  await sleep(3000);
  app.close();
  adb('shell', 'am', 'force-stop', PKG);
  launch();
  await sleep(10000);
  app = await connect();
  const kept = await app.evaluate(
    `(localStorage.getItem('kiranos-chat-v1') ?? '').includes(${JSON.stringify(MESSAGE)})`,
  );
  check('the sent message survives a restart', kept);
  const files = adb('shell', 'run-as', PKG, 'ls', '-R', 'files');
  check('conversations are kept as files in the app data directory', /kiranos-chat-v1/.test(files));
  shot('6-after-restart');
  app.close();
}

try {
  await run();
} catch (error) {
  check('the run completed', false, error.message);
  try {
    shot('error');
  } catch {
    /* nothing more to capture */
  }
}

const log = adb('logcat', '-d');
writeFileSync(`${OUT}/logcat.txt`, log);
check('no crash in the log', !/FATAL EXCEPTION/.test(log));
const consoleErrors = log.split('\n').filter((line) => / E Capacitor\/Console/.test(line));
console.log(`\n${consoleErrors.length} console error(s) from the web app:`);
for (const line of consoleErrors.slice(0, 25)) console.log(`  ${line}`);

writeFileSync(`${OUT}/report.json`, JSON.stringify({ results, consoleErrors }, null, 2));
const failures = results.filter((result) => !result.ok);
console.log(`\n${results.length - failures.length}/${results.length} checks passed`);
process.exit(failures.length ? 1 : 0);
