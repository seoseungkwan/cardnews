// 고정 캐릭터 시트 생성 → 그 시트를 레퍼런스로 카드별 일러스트 생성
import fs from 'fs';
import path from 'path';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY 없음'); process.exit(2); }

const STYLE_LIGHT = `STYLE: Flat vector editorial illustration, thin uniform dark outlines (#0E1116, consistent stroke weight, no line weight variation). Shapes filled with irregular flat color patches deliberately OFFSET from the outlines, overlapping and spilling past the line work like a misregistered risograph print. Absolutely no shading, no gradients, no highlights, no drop shadows, no texture, no 3D, no glow. PALETTE - use ONLY these five colors: #0E1116 near-black (all outlines), #F2C230 golden yellow, #8A6A00 deep amber, #7A8290 warm grey, #E9EAEC light grey. BACKGROUND: fully transparent. No background shape, no frame, no ground plane unless a single thin horizontal line is needed. CRITICAL: no text, no letters, no numbers, no labels, no watermark anywhere.`;

const STYLE_DARK = STYLE_LIGHT
  .replace('thin uniform dark outlines (#0E1116,', 'thin uniform LIGHT outlines (#E9EAEC,')
  .replace('#0E1116 near-black (all outlines), ', '#E9EAEC light grey (all outlines), ')
  + ' IMPORTANT: this illustration sits on a very dark near-black background, so every outline must be light (#E9EAEC) and clearly visible against dark. Never use dark outlines.';

// 고정 캐릭터 설정 — 매 컷에 그대로 붙인다 (한국 노년 부부)
const CHAR = `The two recurring characters are an elderly Korean couple in their early 70s, drawn with warm dignity, never frail or comical.
GRANDPA: thin swept-back silver-grey hair, slightly receded hairline, round thin-rimmed glasses, small rounded shoulders, slightly stooped posture. He ALWAYS wears the same outfit: a mustard yellow (#F2C230) knit cardigan over a light grey (#E9EAEC) collared shirt, and warm grey (#7A8290) trousers.
GRANDMA: short softly permed silver-grey hair, no glasses, small build. She ALWAYS wears the same outfit: a light grey (#E9EAEC) cardigan over a mustard yellow (#F2C230) blouse, and warm grey (#7A8290) long skirt.
Both faces have no facial features beyond a simple closed-eye line - no eyes, nose or mouth details. Keep hair shape, body proportions and outfit colors EXACTLY consistent in every image.`;

const SHEET_PROMPT = `A character reference sheet against empty space showing an elderly Korean couple: on the left the GRANDPA three times (standing facing forward, standing in profile facing right, seated on a plain stool in profile), on the right the GRANDMA three times (standing facing forward, standing in profile facing left, seated on a plain stool in profile). ${CHAR} ${STYLE_LIGHT}`;

const SCENES = [
  { n: 1, dark: true,  s: `The GRANDPA sitting on the edge of a bed, one hand gripping his lower back, shoulders hunched forward.` },
  { n: 2, dark: false, s: `The GRANDMA lying on a sofa on her side holding her lower back, a small pill bottle on the floor beside her.` },
  { n: 3, dark: false, s: `The GRANDPA standing upright and stretching his back with both arms raised overhead, looking relieved.` },
  { n: 4, dark: false, s: `The GRANDPA standing in profile with jagged zigzag lightning lines radiating from his lower back down the back of his leg, and a medical syringe angled toward that lower back.` },
  { n: 5, dark: false, s: `A large anatomically accurate lumbar spine cross-section with a medical syringe angled toward it, and the GRANDMA standing small beside it looking up at the diagram.` },
  { n: 7, dark: false, s: `The GRANDPA looking at three medical syringes arranged in a row beside a simple round clock face with no numbers on it.` },
  { n: 8, dark: true,  s: `The GRANDPA and the GRANDMA seated side by side across from a doctor in a white coat, all leaning slightly forward in conversation.` },
];

const OUT = 'images_ai';
fs.mkdirSync(OUT, { recursive: true });
const REF = path.join(OUT, 'character.png');

async function api(url, body, isForm) {
  const r = await fetch(url, {
    method: 'POST',
    headers: isForm ? { Authorization: `Bearer ${KEY}` } : { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`HTTP ${r.status} ${JSON.stringify(j.error ?? j).slice(0, 300)}`);
  return Buffer.from(j.data[0].b64_json, 'base64');
}

// 1) 캐릭터 시트
if (!fs.existsSync(REF)) {
  console.log('캐릭터 시트 생성 중...');
  const png = await api('https://api.openai.com/v1/images/generations', {
    model: 'gpt-image-2', prompt: SHEET_PROMPT, size: '1536x1024',
    quality: 'high', output_format: 'png', background: 'transparent',
  });
  fs.writeFileSync(REF, png);
  console.log('✓', REF, png.length, 'bytes');
} else {
  console.log('캐릭터 시트 재사용:', REF);
}

// 2) 시트를 레퍼런스로 각 컷 생성
const refBuf = fs.readFileSync(REF);
for (const sc of SCENES) {
  const dest = path.join(OUT, `${sc.n}.png`);
  const prompt = `${sc.s} The man MUST be the exact same character as the person in the reference image - same hair, same face treatment, same mustard sweater, same grey slacks, same proportions. ${CHAR} ${sc.dark ? STYLE_DARK : STYLE_LIGHT}`;
  const fd = new FormData();
  fd.append('model', 'gpt-image-2');
  fd.append('prompt', prompt);
  fd.append('size', '1536x1024');
  fd.append('quality', 'high');
  fd.append('background', 'transparent');
  fd.append('image[]', new Blob([refBuf], { type: 'image/png' }), 'character.png');
  try {
    const png = await api('https://api.openai.com/v1/images/edits', fd, true);
    fs.writeFileSync(dest, png);
    console.log('✓', dest, png.length, 'bytes');
  } catch (e) {
    console.error('✗', sc.n, e.message);
  }
}
console.log('완료');
