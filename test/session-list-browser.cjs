// Synthetic browser harness only; never loaded by Hermes Desktop.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async () => {
  const channel = process.env.PLAYWRIGHT_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 600 } });
    await page.setContent(`<style>:root{--ui-bg-elevated:#202630;--ui-text-primary:#f4f5f7;--ui-stroke-secondary:#68788c;color-scheme:dark}body{background:#131820;color:#f4f5f7;font:16px system-ui}button,input{font:inherit}dialog::backdrop{background:#0006}</style><h1>Synthetic fixture preview</h1><p>Alpha and Beta are fictional sessions. Not a live Hermes screenshot.</p><button id="before">Before</button>`);
    const source = fs.readFileSync(path.join(__dirname, '../desktop/plugin.js'), 'utf8').replace(/^import .*?;\s*/gm, '').replace('export default', 'return');
    // Dynamic compilation is confined to this fixture harness, not the runtime.
    await page.evaluate(source => {
      window.calls = [];
      const host = { state: { profile: { get: () => 'default' } }, listPersistedSessions: async () => ({ sessions: [{ id: 'a', title: 'Alpha' }, { id: 'b', title: 'Beta' }] }), openSession: async (...args) => window.calls.push(args), notify: () => {} };
      let bundles;
      const ctx = { register: () => {}, onDispose: () => {}, i18n: { register: value => { bundles = value; }, t: (key, ...args) => { const value = bundles.en[key]; return typeof value === 'function' ? value(...args) : value; } } };
      new Function('host', 'PALETTE_AREA', source)(host, 'palette').register(ctx);
      document.querySelector('#before').focus();
    }, source);
    const open = async () => { await page.keyboard.press('Control+h'); await page.locator('option').nth(1).waitFor({ state: 'attached' }); };
    await open();
    assert.equal(await page.evaluate(() => document.activeElement.tagName), 'SELECT');
    if (process.argv.includes('--screenshot')) {
      const target = path.join(__dirname, '../docs/synthetic-session-list.png');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      await page.screenshot({ path: target });
      console.log('Created docs/synthetic-session-list.png (fictional Alpha/Beta fixture only)');
    }
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('select').inputValue(), 'b');
    assert.deepEqual(await page.evaluate(() => calls), []);
    await page.keyboard.press('Shift+Enter');
    assert.deepEqual(await page.evaluate(() => calls), [['b', { profile: 'default', intent: 'tab' }]]);
    await open(); await page.keyboard.press('Enter');
    assert.equal((await page.evaluate(() => calls))[1][1].intent, 'in-place');
    await open(); await page.keyboard.press('Shift+F10');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('role')), 'menuitem');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    assert.equal((await page.evaluate(() => calls))[2][1].intent, 'tab');
    await open(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog').count(), 0);
    console.log('PASS Chromium: native ArrowDown selection without navigation, Enter, Shift+Enter, keyboard context menu, Escape');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
