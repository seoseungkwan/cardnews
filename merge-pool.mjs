import fs from "fs";
const idx = JSON.parse(fs.readFileSync("photos/index.json", "utf8"));

// 허리주사 편에서 만든 7장을 풀에 합친다
const extra = [
  { file: "photos/back-bed.png",       use: "허리 통증, 아침 기상 시 통증, 요통 커버" },
  { file: "photos/back-sofa.png",      use: "허리 통증, 누워서 쉬는 장면, 진통제 복용" },
  { file: "photos/stretch-park.png",   use: "스트레칭, 호전, 예방 운동, 야외 운동" },
  { file: "photos/leg-sitting.png",    use: "다리 저림, 앉아서 허리·다리 짚기" },
  { file: "photos/syringe-tray.png",   use: "주사 치료, 신경차단술, 스테로이드, 시술 기구" },
  { file: "photos/syringes-clock.png", use: "주사 횟수·간격 제한, 치료 주기" },
  { file: "photos/consult-couple.png", use: "진료 상담, 전문의 설명, 마무리 카드" },
];

const merged = [...idx, ...extra].filter(p => fs.existsSync(p.file));
fs.writeFileSync("photos/index.json", JSON.stringify(merged, null, 2) + "\n");
console.log(`풀 ${merged.length}장`);
for (const p of merged) console.log(" ", p.file.replace("photos/", "").padEnd(22), p.use);
