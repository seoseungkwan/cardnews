// 카드 한 장을 SVG 문자열로 조립하는 공용 모듈.
// 캔버스 비율을 인자로 받는다. 4:5(카드뉴스) 와 9:16(릴스) 이 같은 코드를 쓴다.
import fs from 'fs';
import opentype from 'opentype.js';

export const INK = '#0E1116', PAPER = '#E9EAEC', ACC = '#F2C230', DEEP = '#8A6A00', MUTED = '#7A8290';
const DARK_SUB = '#8A93A3', DARK_TEXT = '#9AA3B2';

// 캔버스 프리셋. 글자 크기는 가로 1080 기준 절대값이라 W 는 두 프리셋이 같다.
// safeTop / safeBottom 은 인스타 UI(상단 바, 하단 캡션·버튼)가 덮는 영역.
export const SIZES = {
  card: { W: 1080, H: 1350, PAD: 88, BAND: 760, safeTop: 0, safeBottom: 0 },
  reel: { W: 1080, H: 1920, PAD: 88, BAND: 1020, safeTop: 120, safeBottom: 360 },
};

const FDIR = 'node_modules/pretendard/dist/public/static/';
const FACES = { 900: 'Black', 700: 'Bold', 600: 'SemiBold', 500: 'Medium', 400: 'Regular' };
const font = {};
export const fontFiles = [];
for (const [w, nm] of Object.entries(FACES)) {
  const p = FDIR + `Pretendard-${nm}.otf`;
  const f = opentype.parse(fs.readFileSync(p).buffer);
  f.family = f.names.windows.fontFamily.en;
  font[w] = f;
  fontFiles.push(p);
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- 텍스트 측정 ----------
function width(text, w, size, lsPx) {
  const f = font[w];
  let adv = 0;
  for (const g of f.stringToGlyphs(text)) adv += g.advanceWidth;
  return adv * size / f.unitsPerEm + lsPx * text.length;
}
const contentH = (w, size) => (font[w].ascender - font[w].descender) * size / font[w].unitsPerEm;
const ascPx = (w, size) => font[w].ascender * size / font[w].unitsPerEm;

// 어절 단위 줄바꿈 (word-break: keep-all)
function wrap(text, w, size, lsPx, maxW) {
  const out = [];
  let cur = '', start = 0, i = 0;
  for (const word of text.split(' ')) {
    const cand = cur ? cur + ' ' + word : word;
    if (!cur || width(cand, w, size, lsPx) <= maxW) { cur = cand; }
    else { out.push({ text: cur, start }); start = i; cur = word; }
    i += word.length + 1;
  }
  if (cur) out.push({ text: cur, start });
  return out;
}

// [강조] 파싱 → 순수문자열 + 하이라이트 구간
export function parseMark(raw) {
  let plain = '', ranges = [];
  const re = /\[(.+?)\]/g;
  let last = 0, m;
  while ((m = re.exec(raw))) {
    plain += raw.slice(last, m.index);
    const s = plain.length;
    plain += m[1];
    ranges.push([s, plain.length]);
    last = m.index + m[0].length;
  }
  plain += raw.slice(last);
  return { plain, ranges };
}

// ---------- 텍스트 블록 ----------
// 여러 줄 텍스트를 SVG 조각 + 높이로 반환
function textBlock(raw, { w, size, lh, color, ls = 0, maxW, mark = false, markColor }) {
  const lsPx = ls * size;
  const { plain, ranges } = mark ? parseMark(raw) : { plain: raw, ranges: [] };
  const lines = wrap(plain, w, size, lsPx, maxW);
  const lineH = size * lh;
  const half = (lineH - contentH(w, size)) / 2;
  const baseIn = half + ascPx(w, size);

  return {
    height: lineH * lines.length,
    draw(x, y) {
      let out = '';
      lines.forEach((ln, i) => {
        const top = y + lineH * i;
        const base = top + baseIn;
        // 형광펜: 글자 아래 46% 만 덮는다
        for (const [rs, re2] of ranges) {
          const ls2 = ln.start, le = ln.start + ln.text.length;
          const a = Math.max(rs, ls2), b = Math.min(re2, le);
          if (a >= b) continue;
          const pre = plain.slice(ls2, a), seg = plain.slice(a, b);
          const hx = x + width(pre, w, size, lsPx);
          const hw = width(seg, w, size, lsPx);
          const ch = contentH(w, size);
          const hy = base - ascPx(w, size) + ch * 0.54;
          out += `<rect x="${(hx - 3).toFixed(1)}" y="${hy.toFixed(1)}" width="${(hw + 6).toFixed(1)}" height="${(ch * 0.46).toFixed(1)}" fill="${markColor}"/>`;
        }
        out += `<text x="${x.toFixed(1)}" y="${base.toFixed(1)}" font-family="Pretendard" font-weight="${w}"`
          + ` font-size="${size}" fill="${color}"`
          + (lsPx ? ` letter-spacing="${lsPx.toFixed(2)}"` : '')
          + `>${esc(ln.text)}</text>`;
      });
      return out;
    }
  };
}

// ---------- 일러스트 ----------
// 사진을 카드 상단에 꽉 채운다(풀블리드) + 아래로 배경색 페이드
function bleedPhoto(file, bandH, bg, W) {
  if (!file || !fs.existsSync(file)) return null;
  const buf = fs.readFileSync(file);
  let iw = 1536, ih = 1024;
  if (buf.slice(1, 4).toString() === 'PNG') { iw = buf.readUInt32BE(16); ih = buf.readUInt32BE(20); }
  const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
  const href = `data:${mime};base64,${buf.toString('base64')}`;

  // cover 크롭: 가로/세로 중 큰 배율로 채우고 가운데 정렬
  const scale = Math.max(W / iw, bandH / ih);
  const dw = iw * scale, dh = ih * scale;
  const dx = (W - dw) / 2, dy = (bandH - dh) / 2;
  const fade = Math.round(bandH * 0.3);

  return `<defs>
      <clipPath id="band"><rect x="0" y="0" width="${W}" height="${bandH}"/></clipPath>
      <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${bg}" stop-opacity="0"/>
        <stop offset="1" stop-color="${bg}" stop-opacity="1"/>
      </linearGradient>
      <linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#000" stop-opacity="0.78"/>
        <stop offset="0.45" stop-color="#000" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#000" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#band)">
      <image x="${dx.toFixed(1)}" y="${dy.toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" href="${href}"/>
      <rect x="0" y="0" width="${W}" height="260" fill="url(#scrim)"/>
      <rect x="0" y="${bandH - fade}" width="${W}" height="${fade}" fill="url(#fade)"/>
    </g>`;
}

function illusBlock(file, maxH, W, PAD) {
  if (!file || !fs.existsSync(file)) return null;

  // 래스터 이미지(PNG/JPG)는 data URI 로 embed
  if (/\.(png|jpe?g)$/i.test(file)) {
    const buf = fs.readFileSync(file);
    let iw = 1536, ih = 1024;
    if (buf.slice(1, 4).toString() === 'PNG') { iw = buf.readUInt32BE(16); ih = buf.readUInt32BE(20); }
    const mime = /\.png$/i.test(file) ? 'image/png' : 'image/jpeg';
    const maxW = W - PAD * 2;
    const scale = Math.min(maxW / iw, maxH / ih);
    const w = iw * scale, h = ih * scale;
    const href = `data:${mime};base64,${buf.toString('base64')}`;
    return {
      height: h,
      draw: (x, y) => `<image x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" href="${href}"/>`
    };
  }

  const src = fs.readFileSync(file, 'utf8');
  const rootTag = (src.match(/<svg[^>]*>/) || [''])[0];
  const vb = (rootTag.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 600 400';
  // 루트 svg 의 표현 속성(fill="none" 등)을 잃으면 도형이 검게 칠해진다
  const rootFill = (rootTag.match(/\sfill="([^"]+)"/) || [])[1];
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const [, , vw, vh] = vb.split(/\s+/).map(Number);
  const maxW = W - PAD * 2;
  const scale = Math.min(maxW / vw, maxH / vh);
  const w = vw * scale, h = vh * scale;
  return {
    height: h,
    draw: (x, y) => `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"`
      + ` viewBox="${vb}"${rootFill ? ` fill="${rootFill}"` : ''}>${inner}</svg>`
  };
}

function listBlock(items, maxW, fg, accent) {
  const size = 44, lh = 1.4, padY = 30, padL = 54;
  const rows = items.map(t => {
    const { plain, ranges } = parseMark(t);
    const lines = wrap(plain, 600, size, 0, maxW - padL);
    return { plain, ranges, lines, h: lines.length * size * lh + padY * 2 };
  });
  return {
    height: rows.reduce((a, r) => a + r.h, 0),
    draw(x, y) {
      let out = '', cy = y;
      const lineH = size * lh;
      const baseIn = (lineH - contentH(600, size)) / 2 + ascPx(600, size);
      rows.forEach((r, idx) => {
        out += `<rect x="${x}" y="${cy.toFixed(1)}" width="${maxW}" height="1" fill="${MUTED}" opacity="0.28"/>`;
        r.lines.forEach((ln, li) => {
          const base = cy + padY + lineH * li + baseIn;
          for (const [rs, re2] of r.ranges) {
            const a = Math.max(rs, ln.start), b = Math.min(re2, ln.start + ln.text.length);
            if (a >= b) continue;
            const hx = x + padL + width(r.plain.slice(ln.start, a), 600, size, 0);
            const hw = width(r.plain.slice(a, b), 600, size, 0);
            const ch = contentH(600, size);
            out += `<rect x="${(hx - 3).toFixed(1)}" y="${(base - ascPx(600, size) + ch * 0.54).toFixed(1)}" width="${(hw + 6).toFixed(1)}" height="${(ch * 0.46).toFixed(1)}" fill="rgba(242,194,48,.75)"/>`;
          }
          out += `<text x="${x + padL}" y="${base.toFixed(1)}" font-family="Pretendard" font-weight="600" font-size="${size}" fill="${fg}">${esc(ln.text)}</text>`;
        });
        out += `<rect x="${x}" y="${(cy + padY + 14).toFixed(1)}" width="22" height="3" fill="${accent}"/>`;
        cy += r.h;
        if (idx === rows.length - 1) out += `<rect x="${x}" y="${cy.toFixed(1)}" width="${maxW}" height="1" fill="${MUTED}" opacity="0.28"/>`;
      });
      return out;
    }
  };
}

// ---------- 카드 한 장 ----------
// report 를 넘기면 본문이 놓인 범위와 넘침(px)을 채워 준다. 렌더러가 경고로 쓴다.
export function card(c, i, total, meta, geom = SIZES.card, report = null) {
  const { W, H, PAD, BAND, safeTop, safeBottom } = geom;
  const dark = c.type === 'cover' || c.type === 'quote' || c.type === 'cta';
  const bg = dark ? INK : PAPER;
  const fg = dark ? PAPER : INK;
  const accent = dark ? ACC : DEEP;
  const subCol = dark ? DARK_SUB : MUTED;
  const txtCol = dark ? DARK_TEXT : MUTED;
  const markCol = dark ? 'rgba(242,194,48,.88)' : 'rgba(242,194,48,.75)';
  const maxW = W - PAD * 2;

  // 사진 풀블리드 모드
  const bleed = meta.imageMode === 'bleed' && c.image && /\.(png|jpe?g)$/i.test(c.image);

  let s = `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  if (bleed) s += bleedPhoto(c.image, BAND, bg, W);

  // 사진 위에 얹히는 상단 바는 밝은 색이어야 읽힌다
  const topAcc = bleed ? ACC : accent;
  const topFg = bleed ? PAPER : fg;

  // 상단: 라벨 + 진행 바
  const barY = PAD + safeTop;
  const label = meta.label || '';
  const ew = label ? width(label, 600, 22, 22 * 0.16) : 0;
  if (label) {
    const base = barY + 11 - contentH(600, 22) / 2 + ascPx(600, 22);
    s += `<text x="${PAD}" y="${base.toFixed(1)}" font-family="Pretendard" font-weight="600" font-size="22"`
      + ` fill="${topAcc}" letter-spacing="${(22 * 0.16).toFixed(2)}">${esc(label)}</text>`;
  }
  const bx = PAD + (label ? ew + 28 : 0);
  const bw = (W - PAD - bx - 6 * (total - 1)) / total;
  for (let n = 0; n < total; n++) {
    const on = n <= i;
    s += `<rect x="${(bx + n * (bw + 6)).toFixed(1)}" y="${barY + 9}" width="${bw.toFixed(1)}" height="4" rx="2"`
      + ` fill="${on ? topAcc : topFg}"${on ? '' : ' opacity="0.3"'}/>`;
  }

  // 본문 블록 조립
  const blocks = [];
  const push = (b, mt = 0) => { if (b) blocks.push({ b, mt }); };

  let coverIllus = null;
  if (c.type === 'cover') {
    if (!bleed) coverIllus = illusBlock(c.image, 520, W, PAD);   // 커버는 본문 위쪽에 따로 배치
    push(textBlock(c.title, { w: 900, size: 112, lh: 1.16, ls: -0.045, color: fg, maxW, mark: true, markColor: markCol }));
    if (c.sub) push(textBlock(c.sub, { w: 500, size: 40, lh: 1.5, color: subCol, maxW }), 36);
  } else if (c.type === 'quote') {
    push(textBlock('“', { w: 900, size: 140, lh: 0.7, color: ACC, maxW }));
    push(textBlock(c.title, { w: 700, size: 62, lh: 1.42, ls: -0.03, color: fg, maxW, mark: true, markColor: markCol }), 20);
    if (c.by) push(textBlock('— ' + c.by, { w: 500, size: 32, lh: 1.4, color: subCol, maxW }), 44);
  } else if (c.type === 'list') {
    push(textBlock(c.title, { w: 900, size: 74, lh: 1.28, ls: -0.04, color: fg, maxW, mark: true, markColor: markCol }));
    push(listBlock(c.items || [], maxW, fg, accent), 48);
  } else if (c.type === 'cta') {
    push(textBlock(c.title, { w: 900, size: 74, lh: 1.28, ls: -0.04, color: fg, maxW, mark: true, markColor: markCol }));
    if (c.text) push(textBlock(c.text, { w: 400, size: 38, lh: 1.62, color: txtCol, maxW }), 36);
    if (!bleed) push(illusBlock(c.image, 400, W, PAD), 48);
  } else {
    push(textBlock(String(i + 1).padStart(2, '0'), { w: 600, size: 30, lh: 1.2, ls: 0.08, color: accent, maxW }));
    push(textBlock(c.title, { w: 900, size: 74, lh: 1.28, ls: -0.04, color: fg, maxW, mark: true, markColor: markCol }), 30);
    if (c.text) push(textBlock(c.text, { w: 400, size: 38, lh: 1.62, color: txtCol, maxW }), 36);
    if (!bleed) push(illusBlock(c.image, 400, W, PAD), 48);
  }

  // 세로 배치
  const totalH = blocks.reduce((a, x) => a + x.mt + x.b.height, 0);
  const top = bleed ? BAND : barY + 22;
  const bottom = H - PAD - safeBottom;
  let y = c.type === 'cover'
    ? bottom - 24 - totalH                       // 커버는 아래 정렬
    : bleed
      ? top + (bottom - top - totalH) / 2        // 사진 밴드 아래 영역의 세로 중앙
      : top + 64 + (bottom - 64 - (top + 64) - totalH) / 2;

  const startY = y;
  if (coverIllus) s += coverIllus.draw(PAD, top + 64);
  for (const { b, mt } of blocks) { y += mt; s += b.draw(PAD, y); y += b.height; }

  if (report) {
    // 위로는 사진 밴드/상단 바, 아래로는 안전영역을 넘으면 잘리거나 UI 에 가린다
    const ceiling = coverIllus ? top + 64 + coverIllus.height : top;
    report.top = startY;
    report.bottom = y;
    report.limit = bottom;
    report.overflow = Math.max(0, y - bottom) + Math.max(0, ceiling - startY);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

// 카드에 실린 글자 수 — 릴스 장면 길이(읽는 시간) 계산에 쓴다
export function charCount(c) {
  const t = [c.title, c.sub, c.text, c.by, ...(c.items || [])].filter(Boolean).join(' ');
  return parseMark(t).plain.length;
}
