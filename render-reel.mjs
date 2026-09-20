// content.json → 인스타 릴스용 세로 동영상 (1080×1920 MP4)
// 카드뉴스와 같은 원고·같은 디자인을 9:16 으로 다시 조판하고,
// 장면마다 느린 줌(켄번스) + 크로스페이드를 걸어 한 편으로 잇는다.
//
//   node render-reel.mjs                      # out_reel/reel.mp4
//   node render-reel.mjs --audio bgm.m4a      # 배경음 깔기
//   node render-reel.mjs --style fade         # 전환 방식 바꾸기
//
// ffmpeg 는 ffmpeg-static 패키지의 것을 쓴다. 시스템 설치 불필요.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { card, charCount, fontFiles, SIZES } from './card-svg.mjs';

// ---------- 인자 ----------
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };

const CONTENT = arg('content', 'content.json');
const OUT = arg('out', 'out_reel');
const FPS = Number(arg('fps', 30));
const XFADE = Number(arg('transition', 0.45));   // 장면 전환 길이(초)
const STYLE = arg('style', 'slideleft');          // xfade 전환 종류. fade 는 글자가 겹쳐 보인다
const AUDIO = arg('audio', null);                 // 배경음 파일 (없으면 무음 트랙)
const SCALE = 2;                                  // 줌 여유를 위해 2배로 래스터화

const geom = SIZES.reel;
const FFMPEG = path.join('node_modules', 'ffmpeg-static', 'ffmpeg');
if (!fs.existsSync(FFMPEG)) {
  console.error('ffmpeg 가 없다. npm install ffmpeg-static 후 다시 실행할 것.');
  process.exit(1);
}

// ---------- 장면 길이 ----------
// 한글 기준 읽는 속도 약 15자/초 + 화면 파악에 필요한 고정 시간.
// 표지는 훅이라 조금 더 붙잡아 둔다.
function duration(c) {
  const raw = 2.2 + charCount(c) / 15;
  const bonus = c.type === 'cover' ? 0.5 : 0;
  return Math.round(Math.min(Math.max(raw + bonus, 2.8), 5.2) * 100) / 100;
}

// ---------- 프레임 렌더 ----------
const doc = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
const meta = doc.meta ?? {};
const cards = doc.cards ?? doc;
if (!cards.length) { console.error('카드가 없다.'); process.exit(1); }

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const frameDir = path.join(OUT, 'frames');
fs.mkdirSync(frameDir);

const warn = [];
const scenes = cards.map((c, i) => {
  const report = {};
  const svg = card(c, i, cards.length, meta, geom, report);
  if (report.overflow > 0) warn.push(`${i + 1}장면: 본문이 ${Math.round(report.overflow)}px 넘친다`);
  if (report.orphan) warn.push(`${i + 1}장면: 제목 마지막 줄에 "${report.orphan}" 한 어절만 남는다`);
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: geom.W * SCALE },
    font: { fontFiles, loadSystemFonts: false }
  }).render().asPng();
  const file = path.join(frameDir, `scene-${String(i + 1).padStart(2, '0')}.png`);
  fs.writeFileSync(file, png);
  const d = duration(c);
  console.log(`✓ ${file}  ${d.toFixed(2)}s`);
  return { file, d, zoomIn: i % 2 === 0 };
});

// 전환이 장면보다 길면 겹침 계산이 무너진다
const minD = Math.min(...scenes.map(s => s.d));
const xfade = scenes.length > 1 ? Math.min(XFADE, minD / 2) : 0;
const total = scenes.reduce((a, s) => a + s.d, 0) - xfade * (scenes.length - 1);

// ---------- 커버 이미지 (릴스 썸네일용) ----------
const coverFile = path.join(OUT, 'cover.jpg');
await sharp(scenes[0].file).resize(geom.W, geom.H).jpeg({ quality: 92 }).toFile(coverFile);
console.log('✓', coverFile);

// ---------- 필터 그래프 ----------
// 장면마다: 확대 래스터 → 켄번스 줌 → 1080×1920
// 이어서: xfade 로 앞뒤를 이어 붙이고, 처음·끝에 암전 페이드.
// 기본 전환이 슬라이드인 이유: 디졸브는 앞뒤 카드 글자가 겹쳐 읽히지 않는다.
const filters = [];
scenes.forEach((s, i) => {
  const n = Math.max(Math.round(s.d * FPS), 2);
  const z = s.zoomIn
    ? `1+0.05*on/${n - 1}`
    : `1.05-0.05*on/${n - 1}`;
  filters.push(
    `[${i}:v]scale=${geom.W * SCALE}:${geom.H * SCALE},setsar=1,`
    + `zoompan=z='${z}':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`
    + `:s=${geom.W}x${geom.H}:fps=${FPS},`
    + `trim=duration=${s.d},setpts=PTS-STARTPTS,`
    // xfade 는 두 입력의 픽셀 포맷·타임베이스·프레임레이트가 같아야 붙는다
    + `format=yuv420p,settb=AVTB,fps=${FPS}[v${i}]`
  );
});

let last = 'v0', acc = scenes[0].d;
for (let i = 1; i < scenes.length; i++) {
  const off = (acc - xfade).toFixed(3);
  const out = i === scenes.length - 1 ? 'xf' : `x${i}`;
  filters.push(`[${last}][v${i}]xfade=transition=${STYLE}:duration=${xfade}:offset=${off}[${out}]`);
  last = out;
  acc += scenes[i].d - xfade;
}
if (scenes.length === 1) filters.push(`[v0]null[xf]`);

filters.push(
  `[xf]fade=t=in:st=0:d=0.4,fade=t=out:st=${(total - 0.5).toFixed(3)}:d=0.5,`
  + `format=yuv420p[vout]`
);

// ---------- 입력 ----------
const args = ['-y', '-hide_banner', '-loglevel', 'error'];
for (const s of scenes) args.push('-loop', '1', '-framerate', String(FPS), '-t', String(s.d), '-i', s.file);

if (AUDIO) {
  args.push('-stream_loop', '-1', '-i', AUDIO);
  filters.push(
    `[${scenes.length}:a]atrim=duration=${total.toFixed(3)},asetpts=PTS-STARTPTS,`
    + `afade=t=in:st=0:d=1,afade=t=out:st=${Math.max(total - 1.5, 0).toFixed(3)}:d=1.5[aout]`
  );
} else {
  // 무음이라도 오디오 트랙이 있어야 업로드 처리가 매끄럽다
  args.push('-f', 'lavfi', '-t', total.toFixed(3), '-i', 'anullsrc=r=44100:cl=stereo');
  filters.push(`[${scenes.length}:a]anull[aout]`);
}

const mp4 = path.join(OUT, 'reel.mp4');
args.push(
  '-filter_complex', filters.join(';'),
  '-map', '[vout]', '-map', '[aout]',
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'medium',
  '-crf', '20', '-maxrate', '10M', '-bufsize', '16M',
  '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 2),
  '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
  '-movflags', '+faststart', '-t', total.toFixed(3),
  mp4
);

console.log(`\n인코딩 중… ${scenes.length}장면 / ${total.toFixed(1)}초`);
execFileSync(FFMPEG, args, { stdio: 'inherit' });

if (meta.caption || meta.hashtags) {
  fs.writeFileSync(path.join(OUT, 'caption.txt'),
    [meta.caption ?? '', '', (meta.hashtags ?? []).join(' ')].join('\n').trim());
  console.log('✓', path.join(OUT, 'caption.txt'));
}

if (warn.length) {
  console.log('\n⚠ 손봐야 할 장면 — 글자를 줄이거나 어절을 조정하고 다시 렌더할 것');
  for (const w of warn) console.log('  ', w);
}

const mb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(1);
console.log(`\n✓ ${mp4}  ${geom.W}×${geom.H} · ${total.toFixed(1)}초 · ${mb}MB`);
console.log(`  썸네일 ${coverFile} · 장면 원본 ${frameDir}/`);
