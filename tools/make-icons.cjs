// アプリのアイコン（icon-192.png・icon-512.png）を作る。生成りの和紙に、朱の年表の線と3枚の札。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    const card = (y, w) => `<rect x="34" y="${y}" width="${w}" height="14" rx="3" fill="#fff" stroke="#2a2420" stroke-width="2"/><circle cx="24" cy="${y + 7}" r="5" fill="#b23a24"/>`;
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3ead8"/>
      <rect x="22.5" y="18" width="3" height="56" fill="#b23a24"/>
      ${card(20, 50)}${card(40, 42)}${card(60, 54)}
      <text x="50" y="92" font-size="13" text-anchor="middle" fill="#2a2420" font-family="'Noto Serif CJK JP',serif" font-weight="900">歴史</text></svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
