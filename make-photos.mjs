// 실사 카드뉴스 이미지 생성 (커버 1번은 이미 있음 → 건너뜀)
import fs from 'fs';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY 없음'); process.exit(2); }

// 덱 전체를 한 세트로 묶는 촬영 규칙
const LOOK = `Photorealistic editorial photograph, shot on a 50mm lens at f/2, shallow depth of field, natural available light, no studio strobes, documentary feel. Muted desaturated color grade where mustard yellow is the only warm accent color; everything else is grey, charcoal and off-white. Deep shadows, generous negative space. Nobody looks at the camera. CRITICAL: no text, no letters, no numbers, no signage, no watermark, no logo anywhere in the image.`;

const GRANDPA = `a Korean man in his early 70s with silver-grey hair, wearing a mustard yellow knit cardigan over a light grey collared shirt and warm grey trousers`;
const GRANDMA = `a Korean woman in her early 70s with short softly permed silver-grey hair, wearing a light grey cardigan over a mustard yellow blouse and a warm grey long skirt`;

const SCENES = [
  { n: 2, s: `${GRANDMA} lying on her side on a sofa in a dim living room, one hand pressed to her lower back, a small pill bottle on the low table in the foreground.` },
  { n: 3, s: `${GRANDPA} standing outdoors in a quiet park at early morning, both arms raised overhead stretching his back, shoulders open, seen from a low angle against soft grey sky.` },
  { n: 4, s: `${GRANDPA} sitting on a wooden chair leaning forward, one hand pressing his lower back and the other resting on his thigh, weight shifted off one leg, dim room, strong side light.` },
  { n: 5, s: `A close-up still life on a stainless steel clinical tray: one prepared syringe and a small clear glass vial resting on sterile blue cloth, dark clinical background, no people.` },
  { n: 7, s: `A close-up still life of three identical syringes lined up in a row on a stainless steel clinical tray, with a plain round wall clock blurred in the background, dark clinical room, no people.` },
  { n: 8, s: `${GRANDPA} and ${GRANDMA} seated side by side in a bright clinic consultation room, facing a doctor in a white coat who is turned away from camera and gesturing while explaining. Warm daylight through a window.` },
];

const OUT = 'images_photo';
fs.mkdirSync(OUT, { recursive: true });

for (const sc of SCENES) {
  const dest = `${OUT}/${sc.n}.png`;
  if (fs.existsSync(dest)) { console.log('건너뜀', dest); continue; }
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2', prompt: `${sc.s} ${LOOK}`,
        size: '1536x1024', quality: 'high', output_format: 'png',
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j.error ?? j).slice(0, 250));
    const buf = Buffer.from(j.data[0].b64_json, 'base64');
    fs.writeFileSync(dest, buf);
    console.log('✓', dest, buf.length, 'bytes');
  } catch (e) {
    console.error('✗', sc.n, e.message);
  }
}
console.log('완료');
