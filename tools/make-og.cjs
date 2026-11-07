// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の問題（答え）は入れず、遊び方の例（年表に3つ並べた所）だけ。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const row = (n, y, t) => `<div style="display:flex;align-items:center;gap:22px;height:78px;border-bottom:2px dashed #2a242030"><span style="width:44px;height:44px;border-radius:50%;background:#b23a24;color:#fff;display:grid;place-items:center;font-size:26px;font-weight:900">${n}</span><span style="font-family:'Noto Serif CJK JP',serif;font-size:44px;font-weight:900;color:#7f2414;width:170px;text-align:right">${y}</span><span style="font-size:38px;font-weight:700">${t}</span></div>`;
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP','IPAPGothic',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:56px 80px;background:#f3ead8;color:#2a2420">
    <div style="font-size:32px;color:#7f2414;letter-spacing:.1em">古い順に押して、年表にする</div>
    <div style="font-family:'Noto Serif CJK JP',serif;font-size:110px;font-weight:900;margin-top:4px;letter-spacing:.12em">歴史<span style="color:#b23a24">ならべ</span></div>
    <div style="margin-top:22px;background:#fffaf0;border:3px solid #2a242026;border-radius:10px;padding:8px 36px;width:880px">
      ${row(1, "794年", "平安京に都をうつす")}${row(2, "1603年", "徳川家康が征夷大将軍になる")}${row(3, "？", "どれが次に古い？")}
    </div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
