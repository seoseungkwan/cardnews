import fs from "fs";
const doc = JSON.parse(fs.readFileSync("content.json", "utf8"));
doc.meta.imageMode = "bleed";
doc.cards.forEach((c, i) => {
  const p = `images_photo/${i + 1}.png`;
  if (fs.existsSync(p)) c.image = p; else delete c.image;
});
fs.writeFileSync("content.json", JSON.stringify(doc, null, 2) + "\n");
console.log("imageMode:", doc.meta.imageMode);
console.log(doc.cards.map((c, i) => `${i + 1}: ${c.image ?? "-"}`).join("\n"));
