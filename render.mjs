import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const W = 1080, H = 1350, SCALE = 2;   // 인스타 캐러셀 4:5, 2배 해상도

const doc = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const meta = doc.meta ?? {};
const cards = doc.cards ?? doc;         // 배열만 있어도 동작

fs.rmSync('out', { recursive: true, force: true });
fs.mkdirSync('out', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: W, height: H },
  deviceScaleFactor: SCALE,
});
await page.goto('file://' + path.resolve('template.html'));
await page.evaluate(() => document.fonts.ready);

const warnings = [];
for (const [i, card] of cards.entries()) {
  await page.evaluate(
    ([c, i, t, m]) => window.render(c, i, t, m),
    [card, i, cards.length, meta]
  );
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => Promise.all(
    [...document.images].map(img => img.complete ? null : img.decode().catch(() => null))
  ));

  if (await page.evaluate(() => window.overflow())) {
    warnings.push(`${i + 1}번 카드 넘침 — "${card.title}" 텍스트를 줄이세요`);
  }
  const file = `out/card-${String(i + 1).padStart(2, '0')}.png`;
  await page.screenshot({ path: file });
  console.log('✓', file);
}
await browser.close();

// 인스타 캡션 파일
if (meta.caption || meta.hashtags) {
  const caption = [meta.caption ?? '', '', (meta.hashtags ?? []).join(' ')].join('\n');
  fs.writeFileSync('out/caption.txt', caption.trim());
  console.log('✓ out/caption.txt');
}

if (warnings.length) {
  console.log('\n⚠ 오버플로우 ' + warnings.length + '건');
  warnings.forEach(w => console.log('  -', w));
  process.exitCode = 1;
} else {
  console.log(`\n${cards.length}장 생성 완료`);
}
