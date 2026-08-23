import fs from "fs";
const dir = process.argv[2];                 // "images_ai" 또는 "images"
const ext = process.argv[3] ?? "png";
const doc = JSON.parse(fs.readFileSync("content.json", "utf8"));
doc.cards.forEach((c, i) => {
  const n = i + 1;
  const p = `${dir}/${n}.${ext}`;
  if (fs.existsSync(p)) c.image = p;
});
fs.writeFileSync("content.json", JSON.stringify(doc, null, 2) + "\n");
console.log(doc.cards.map((c, i) => `${i + 1}: ${c.image ?? "-"}`).join("\n"));
