// Read-only visual inventory: render original game art into browser review boards.
import { ALL_CARDS } from '../src/data/cardCatalog.js';
import { RELIC_CATALOG } from '../src/core/relics.js';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(isAbsolute(modulePath) ? pathToFileURL(modulePath).href : modulePath);
const out = await mkdtemp(join(tmpdir(), 'hoi-art-review-'));
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXECUTABLE });
const page = await browser.newPage({ viewport: { width: 1320, height: 1600 }, deviceScaleFactor: 1 });
const cards = [...ALL_CARDS, ...RELIC_CATALOG];
try {
  for (let index = 0; index < cards.length; index += 12) {
    const batch = cards.slice(index, index + 12);
    await page.setContent(`<html><head><style>*{box-sizing:border-box}body{margin:0;background:#172127;color:#fff;font:15px sans-serif}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px}figure{margin:0;min-width:0}img{width:100%;height:424px;object-fit:contain;background:#202d34}figcaption{height:42px;padding:5px;font-weight:700}</style></head><body><div class="grid">${batch.map(card => `<figure><img src="http://127.0.0.1:1426/${card.image.replace(/^\.\//, '')}"/><figcaption>${card.id} · ${card.name}</figcaption></figure>`).join('')}</div></body></html>`);
    await page.waitForFunction(() => [...document.images].every(img => img.complete && img.naturalWidth > 0));
    const path = join(out, `board-${String(index / 12 + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(JSON.stringify({ path, cards: batch.map(card => card.id) }));
  }
} finally { await browser.close(); }
