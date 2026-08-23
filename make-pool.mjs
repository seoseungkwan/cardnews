// 정형외과 카드뉴스용 재사용 사진 풀 생성
import fs from 'fs';

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('OPENAI_API_KEY 없음'); process.exit(2); }

const LOOK = `Photorealistic editorial photograph, 50mm lens at f/2, shallow depth of field, natural available light, no studio strobes, documentary feel. Muted desaturated color grade where mustard yellow is the only warm accent color; everything else grey, charcoal and off-white. Deep shadows, generous negative space. Nobody looks at the camera. CRITICAL: no text, no letters, no numbers, no signage, no watermark, no logo anywhere in the image.`;

const GRANDPA = `a Korean man in his early 70s with silver-grey hair, wearing a mustard yellow knit cardigan over a light grey collared shirt and warm grey trousers`;
const GRANDMA = `a Korean woman in her early 70s with short softly permed silver-grey hair, wearing a light grey cardigan over a mustard yellow blouse and a warm grey long skirt`;

// name: 파일명, s: 장면, use: 어떤 주제에 쓰는지 (매니페스트용)
const POOL = [
  { name: 'knee-stairs',      s: `${GRANDPA} pausing on a stairway landing, one hand on the handrail and the other pressing his knee, weight shifted to one leg.`, use: '무릎 관절염, 계단 통증' },
  { name: 'knee-sitting',     s: `${GRANDMA} sitting on a sofa rubbing her knee with both hands, leaning forward.`, use: '무릎 통증, 관절염' },
  { name: 'knee-exam',        s: `A doctor in a white coat, turned away from camera, examining the bent knee of an elderly patient seated on an exam table in a bright clinic room.`, use: '무릎 진찰, 진단' },
  { name: 'shoulder-reach',   s: `${GRANDMA} reaching up toward a high kitchen shelf and stopping mid-motion, her other hand gripping her shoulder, face turned away.`, use: '오십견, 회전근개, 어깨 통증' },
  { name: 'shoulder-night',   s: `${GRANDPA} lying awake in a dim bedroom at night, one hand holding his opposite shoulder, blanket pushed aside.`, use: '야간 어깨 통증, 오십견' },
  { name: 'back-standing',    s: `${GRANDPA} standing in a hallway with both hands pressed to his lower back, arching slightly backward.`, use: '허리 통증, 요통' },
  { name: 'walking-rest',     s: `${GRANDPA} sitting down on a park bench mid-walk, leaning forward with forearms on his knees, a walking path behind him.`, use: '척추관협착증, 간헐적 파행' },
  { name: 'walking-cane',     s: `${GRANDMA} walking slowly along a quiet outdoor path with a simple wooden cane, seen from behind at a low angle.`, use: '보행 장애, 협착증, 관절염' },
  { name: 'neck-desk',        s: `${GRANDPA} seated at a desk with a laptop, one hand kneading the back of his neck, head tilted forward.`, use: '목디스크, 거북목' },
  { name: 'neck-phone',       s: `${GRANDMA} sitting on a sofa looking down at a smartphone held low in her lap, neck bent far forward, seen from the side.`, use: '거북목, 일자목' },
  { name: 'wrist-night',      s: `${GRANDMA} sitting on the edge of a bed in a dark room shaking out one hand, holding her wrist with the other.`, use: '손목터널증후군, 야간 손 저림' },
  { name: 'wrist-brace',      s: `A close-up of an elderly persons forearm and hand wearing a simple grey wrist splint brace, resting on a table.`, use: '손목 보조기, 손목터널증후군' },
  { name: 'hand-fingers',     s: `A close-up of the weathered hands of an elderly person slowly curling and straightening the fingers of one hand, dark background.`, use: '방아쇠수지, 손가락 관절' },
  { name: 'elbow-lift',       s: `${GRANDPA} setting down a grocery bag on a counter and gripping his outer elbow with the other hand.`, use: '테니스엘보, 팔꿈치 통증' },
  { name: 'heel-morning',     s: `${GRANDMA} sitting on the edge of a bed in early morning light, one foot on the floor, hand reaching toward her heel.`, use: '족저근막염, 아침 발뒤꿈치 통증' },
  { name: 'foot-shoe',        s: `${GRANDPA} seated on a low bench in an entryway putting on a walking shoe, one hand steadying his foot.`, use: '족저근막염, 신발, 깔창' },
  { name: 'ankle-hold',       s: `${GRANDMA} seated on the floor of a living room holding her ankle with both hands, leg extended.`, use: '발목 염좌, 만성 불안정증' },
  { name: 'exercise-band',    s: `${GRANDPA} sitting on a chair doing a slow resistance band exercise with his leg, in a bright room.`, use: '재활 운동, 근력 강화' },
  { name: 'exercise-walk',    s: `${GRANDPA} and ${GRANDMA} walking together side by side on a quiet park path in soft morning light, seen from behind.`, use: '걷기 운동, 예방, 마무리 카드' },
  { name: 'xray-explain',     s: `A doctor in a white coat, turned away from camera, pointing at a backlit x-ray view box while two elderly patients look on, dim clinic room.`, use: '검사 설명, 진단, 골다공증' },
];

const OUT = 'photos';
fs.mkdirSync(OUT, { recursive: true });

for (const p of POOL) {
  const dest = `${OUT}/${p.name}.jpg`;
  if (fs.existsSync(dest)) { console.log('건너뜀', dest); continue; }
  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-image-2', prompt: `${p.s} ${LOOK}`,
        size: '1536x1024', quality: 'high', output_format: 'jpeg',
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j.error ?? j).slice(0, 200));
    fs.writeFileSync(dest, Buffer.from(j.data[0].b64_json, 'base64'));
    console.log('✓', dest);
  } catch (e) {
    console.error('✗', p.name, e.message);
  }
}

// 매니페스트 — 클라우드 에이전트가 이걸 읽고 고른다
fs.writeFileSync(`${OUT}/index.json`, JSON.stringify(
  POOL.map(p => ({ file: `photos/${p.name}.jpg`, use: p.use })), null, 2) + '\n');
console.log('✓ photos/index.json');
