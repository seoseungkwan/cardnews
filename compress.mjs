// 인스타 업로드용 축소 (1080x1350 JPEG)
import fs from 'fs';
import sharp from 'sharp';

const q = Number(process.argv[2] ?? 82);
const w = Number(process.argv[3] ?? 1080);
fs.mkdirSync('out_small', { recursive: true });

let total = 0;
for (const f of fs.readdirSync('out').filter(x => x.endsWith('.png'))) {
  const dest = 'out_small/' + f.replace('.png', '.jpg');
  await sharp('out/' + f).resize({ width: w }).jpeg({ quality: q, mozjpeg: true }).toFile(dest);
  const kb = fs.statSync(dest).size / 1024;
  total += kb;
  console.log(dest, Math.round(kb) + ' KB');
}
console.log(`\n합계 ${(total / 1024).toFixed(2)} MB  (base64 환산 약 ${(total * 1.37 / 1024).toFixed(2)} MB)`);
