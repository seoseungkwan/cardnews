// 브라우저 없이 카드뉴스 PNG 생성 (opentype.js 측정 + resvg 래스터화)
// 클라우드 샌드박스에서도 도는 것이 목적. playwright/크롬 불필요.
// 카드 조립 로직은 card-svg.mjs 에 있다. 릴스 렌더러(render-reel.mjs)와 공유한다.
import fs from 'fs';
import { Resvg } from '@resvg/resvg-js';
import { card, fontFiles, SIZES } from './card-svg.mjs';

const geom = SIZES.card, SCALE = 2;

const doc = JSON.parse(fs.readFileSync('content.json', 'utf8'));
const meta = doc.meta ?? {};
const cards = doc.cards ?? doc;

fs.rmSync('out', { recursive: true, force: true });
fs.mkdirSync('out', { recursive: true });

const warn = [];
cards.forEach((c, i) => {
  const report = {};
  const svg = card(c, i, cards.length, meta, geom, report);
  if (report.overflow > 0) warn.push(`${i + 1}장: 본문이 ${Math.round(report.overflow)}px 넘친다`);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: geom.W * SCALE },
    font: { fontFiles, loadSystemFonts: false }
  }).render().asPng();
  const file = `out/card-${String(i + 1).padStart(2, '0')}.png`;
  fs.writeFileSync(file, png);
  console.log('✓', file);
});

if (meta.caption || meta.hashtags) {
  fs.writeFileSync('out/caption.txt',
    [meta.caption ?? '', '', (meta.hashtags ?? []).join(' ')].join('\n').trim());
  console.log('✓ out/caption.txt');
}
console.log(`\n${cards.length}장 생성 완료 (브라우저 없이)`);
if (warn.length) {
  console.log('\n⚠ 넘침 — 해당 카드 글자를 줄이고 다시 렌더할 것');
  for (const w of warn) console.log('  ', w);
}
