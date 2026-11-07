// 歴史ならべの検査。できごとのデータ（形・時代と年の順）・今日の5問と上級の組み方（3年分）・練習ととことんの問題（何百回）・
// 通しで遊ぶ・まちがい・ヒント・続きから・上級・練習・とことん・年表帳・実績・カレンダー・あとから・古いタブ・
// 記録の形を直す・スマホ幅・PWA・引き継ぎコード・見やすさを確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail).slice(0, 400) });
const G = createRequire(import.meta.url)(path.join(root, "data.js"));

// ---- 1. できごとのデータと問題の作り方（ブラウザを使わない）----
{
  const ids = G.EV.map((e) => e.id), eras = new Set(G.ERAS.map((e) => e[0])), bad = [];
  for (const e of G.EV) {
    if (!/^[a-k]\d\d$/.test(e.id)) bad.push(e.id + " id の形");
    if (!Number.isInteger(e.y) || e.y < 1 || e.y > 2100) bad.push(e.id + " 年");
    if (!eras.has(e.era)) bad.push(e.id + " 時代");
    if ([...e.t].length > 20) bad.push(e.id + " できごとが20字より長い");
    if ([...e.w].length > 40) bad.push(e.id + " 一言が40字より長い");
    if (!e.w.endsWith("。")) bad.push(e.id + " 一言が。で終わらない");
  }
  check("できごと：id は重ならない・年は整数・時代がある・できごとは20字以内・一言は40字以内", new Set(ids).size === ids.length && bad.length === 0, bad.slice(0, 6).join(","));
  // 時代の並びと年がくいちがわない（時代の順に並べると年も古い順）
  const off = [];
  for (const a of G.EV) for (const b of G.EV) if (G.ERA[a.era].i < G.ERA[b.era].i && a.y > b.y) off.push(`${a.id}>${b.id}`);
  check("時代の順と年の順がくいちがわない（ヒントの時代で並べても矛盾しない）", off.length === 0, off.slice(0, 5).join(","));
  check("できごとは130以上・年表帳のまとまりは11（どれも5つ以上）", G.EV.length >= 130 && G.GROUPS.length === 11 && G.GROUPS.every((_, g) => G.EV.filter((e) => G.ERA[e.era].g === g).length >= 5), G.EV.length);
  // 前の版からの id が消えていない・年が変わっていない（記録の年表帳と過去の日の問題を守る）
  const FIXED = { a01: 57, a12: 701, c01: 794, d01: 1192, e11: 1573, f08: 1600, g01: 1603, g22: 1867, h09: 1889, j09: 1945, k09: 2019, k10: 2021 };
  check("前からあるできごとの id と年を変えていない", Object.entries(FIXED).every(([id, y]) => G.BY[id] && G.BY[id].y === y));
}
const solvedOK = (P, rule) => { const [n, gap, win] = rule, ys = P.order.map((e) => e.y); return P.order.length === n && ys.every((y, i) => i === 0 || y >= ys[i - 1]) && ys.every((y, i) => ys.every((z, j) => i === j || Math.abs(y - z) >= gap)) && (!win || ys[n - 1] - ys[0] <= win) && P.shown.some((e, i) => e !== P.order[i]); };
{
  // 今日の5問・上級の組み方（3年分）。別に書いた並べ方（年の数の大小）で正しい順を作り直して比べる
  const bad = [], used = new Set(); let sameAsPrev = 0, prev = "";
  const d0 = Date.parse("2026-11-07");
  for (let i = 0; i < 365 * 3; i++) {
    const d = new Date(d0 + i * 864e5).toISOString().slice(0, 10), dl = G.dailyTags(d), hl = G.hardTags(d);
    const dp = dl.map(G.make), hp = hl.map(G.make);
    if (dl.length !== 5 || dp.map((P) => P.lv).join() !== "0,0,1,1,2" || dp.some((P) => !solvedOK(P, G.RULE[P.lv]))) bad.push(d + " 今日");
    if (hl.length !== 3 || hp.some((P) => P.lv !== 3 || !solvedOK(P, G.RULE[3]))) bad.push(d + " 上級");
    const ev = [...dp, ...hp].flatMap((P) => P.order.map((e) => e.id));
    if (new Set(ev).size !== ev.length) bad.push(d + " 同じ日に同じできごと");
    for (const P of [...dp, ...hp]) { const re = P.shown.slice().sort((a, b) => a.y - b.y || a.n - b.n); if (re.map((e) => e.id).join() !== P.order.map((e) => e.id).join()) bad.push(d + " 正しい順"); }
    if (JSON.stringify(dl) !== JSON.stringify(G.dailyTags(d)) || JSON.stringify(G.make(dl[0])) !== JSON.stringify(G.make(dl[0]))) bad.push(d + " 同じにならない");
    if (dl.join() === prev) sameAsPrev++; prev = dl.join();
    if (i < 90) ev.forEach((id) => used.add(id));
  }
  check("今日の5問（やさしい3枚×2・ふつう4枚×2・むずかしい4枚）と上級（5枚×3）を3年分作れる・年の差と幅の決まり・同じ日に同じできごとなし・はじめから正しい順に並ばない", bad.length === 0, bad.slice(0, 5).join(","));
  check("3か月のうちに、できごとの8割以上が出る・前の日と同じ日が無い", used.size >= G.EV.length * 0.8 && sameAsPrev === 0, `${used.size}/${G.EV.length}・同じ ${sameAsPrev}日`);
  // 今日の問題は前の値と同じ（データや作り方を変えても、過去の日の問題を変えない。shared-workflows game-dev.md F7）
  const PIN = { "2026-11-07": G.dailyTags("2026-11-07").join() };
  check("今日の問題の作り方を固定：2026-11-07 の5問が決まった値", PIN["2026-11-07"] === "0|i05.d03.f08,0|d04.c09.i01,1|c13.c01.a01.j08,1|j18.e11.c08.h16,2|i03.j16.k07.k03", PIN["2026-11-07"]);
}
{
  // 練習・とことん：何百回作っても作れない問題が無い。1回のとことんの中で同じ組は出ない・続けて同じできごとを出さない
  let fail = 0; const keys = new Set();
  for (let lv = 0; lv < 4; lv++) for (let i = 0; i < 500; i++) { const t = G.randomTag(Math.random, lv, new Set()); if (!t || !solvedOK(G.make(t), G.RULE[lv])) fail++; else keys.add(G.keyOf(t)); }
  for (let g = 0; g < G.GROUPS.length; g++) for (let i = 0; i < 200; i++) { const t = G.randomTag(Math.random, 0, new Set(), g); if (!t || G.make(t).order.some((e) => G.ERA[e.era].g !== g)) fail++; }
  check("練習：4つの難しさ×500回・11の時代×200回で、いつも決まりどおりの問題を作れる", fail === 0, fail);
  check("練習・とことんの問題は300種類以上（好きなだけ遊べる。game-dev.md F6）", keys.size >= 300, keys.size);
}
// ---- 2. ファイルの中身 ----
const html = readFileSync(path.join(root, "index.html"), "utf8"), gen = readFileSync(path.join(root, "data.js"), "utf8");
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$|^https:\/\/(journals\.sagepub\.com|pubmed\.ncbi\.nlm\.nih\.gov|www\.gsi\.go\.jp)\//.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない（出典のリンクは押したときに開くだけ）", ext.length === 0 && ![...html.matchAll(/<script[^>]+src="([^"]+)"/g)].some((m) => /^https?:/.test(m[1])), ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんと回の名札だけ（今日の5問・上級は日付の乱数。data.js には無い）", (html.match(/Math\.random/g) || []).length === 3 && !/Math\.random/.test(gen));
check("乱数は sort の比較の中で引かない（ブラウザで引く回数が変わる）", !/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/.test(html + gen));
check("一行の式の途中にコメント // を足さない（行の残りが消える。rosen-hitofude 2026-11-04）", !/;\s*\/\/[^\n]*;\s*\w/.test(gen.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ツッコミ|なんでやねん|（うそ）/.test(html + gen));
check("チケット・回数の上限・🔒で開くモードを入れない（好きなだけ遊べる。game-dev.md F1・F2）", !/🎫|チケット|のこり\d|すると開く|🔒/.test(html));
check("引き継ぎ：transfer.js をゲームの script より前に、このゲームの記録のキーだけで読む", /<script src="transfer\.js" data-game="rekishi-narabe" data-keys="rekishi-v1,rekishi-fs"><\/script>\s*<\/head>/.test(html) && html.indexOf('src="transfer.js"') < html.indexOf('src="data.js"') && /data-hk/.test(html) && existsSync(path.join(root, "transfer.js")));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/rekishi-narabe/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（2字だとフォームが出ない。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3);
  check("感想フォームは名前・メールを聞かない", /id: fun/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(path.join(root, "README.md"), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：sw.js は画面のファイルを全部保存し（引き継ぎの transfer.js も）、取り直しで保存し、外へ何も送らない", ["./index.html", "./data.js", "./transfer.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && /cache: "reload"/.test(sw) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "歴史ならべ" && mf.icons.length >= 2 && mf.start_url === "./"); }

// ---- 3. ブラウザで遊ぶ ----
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname), f = path.join(root, p === "/" ? "index.html" : p);
  if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0);
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
const TODAY = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const dayBefore = (n) => new Date(Date.parse(TODAY) - n * 864e5).toISOString().slice(0, 10);
async function newPage(w = 390, ctx) {
  const c = ctx || await browser.newContext({ viewport: { width: w, height: 800 } });
  await c.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  await p.goto(url); await p.waitForTimeout(200);
  return p;
}
const closeHow = async (p) => { if (await p.locator("#howto[open]").count()) await p.click("#howto-ok"); };
const nextId = (p) => p.evaluate(() => { const c = __rk.cur(); return c.P.order[c.placed].id; });
const wrongId = (p) => p.evaluate(() => { const c = __rk.cur(); return c.P.order.slice(c.placed + 1).map((e) => e.id).find((id) => !c.wrong.includes(c.placed + ":" + id)); });
const mem = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("rekishi-v1") || "{}"));
async function solve(p, { wrong = 0 } = {}) {
  for (let i = 0; i < wrong; i++) await p.click(`.card[data-id="${await wrongId(p)}"]`);
  for (let k = 0; k < 6 && !(await p.locator(".verdict").count()); k++) await p.click(`.card[data-id="${await nextId(p)}"]`);
  await p.waitForSelector(".verdict");
}

try {
  // はじめて：遊び方が出る・文字の大きさ
  const p = await newPage();
  check("はじめて開くと遊び方が出る", await p.locator("#howto[open]").count() === 1);
  { const c = await browser.newContext(); const r = await c.newPage(); await r.goto(url); await r.waitForTimeout(200); let again = 0;
    for (let i = 0; i < 10; i++) { await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200); await r.keyboard.press("Escape"); await r.reload(); await r.waitForTimeout(200); again += await r.locator("#howto[open]").count(); }
    check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0);
    await r.evaluate(() => localStorage.clear()); await r.reload(); await r.waitForTimeout(200);
    check("「わかった」を押したその場で「見た」が残る", await r.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
    await r.reload(); await r.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない（その場で残す）", await r.locator("#howto[open]").count() === 0); await c.close(); }
  await p.keyboard.press("Escape"); await p.waitForTimeout(100);
  check("遊び方を Esc で閉じても覚える（次は開かない）", await p.locator("#howto[open]").count() === 0 && await p.evaluate(() => __rk.load().tut === true));
  await p.reload(); await p.waitForTimeout(250);
  check("Esc で閉じたあと開き直しても遊び方が出ない", await p.locator("#howto[open]").count() === 0);
  check("文字の大きさ：はじめは「ふつう」（17px）", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "17px");
  await p.click('.fsrow button[data-fs="3"]');
  await p.reload(); await p.waitForTimeout(150);
  check("文字の大きさ：「とても大きい」にすると開き直しても残る", await p.evaluate(() => getComputedStyle(document.documentElement).fontSize) === "24px" && await p.locator('.fsrow button[data-fs="3"][aria-pressed="true"]').count() === 1);
  await p.click('.fsrow button[data-fs="1"]');
  check("ホームに今日の目じるし（手がかり）が出る・上級・とことんははじめから押せる", (await p.textContent("#tip")).includes("今日の目じるし") && await p.locator("#go-h:not([disabled])").count() === 1 && await p.locator("#go-e:not([disabled])").count() === 1);

  // 今日の5問：1問目はまちがえる、2問目はヒント2回、ほかはそのまま
  await p.click("#go-d");
  const tags = await p.evaluate(() => __rk.load().runs.d.list);
  check("今日の5問は日付から決まる（data.js の dailyTags と同じ）", JSON.stringify(tags) === JSON.stringify(G.dailyTags(TODAY)));
  check("問題の画面：年表のます・札・時代のものさし", await p.locator(".slot").count() === 3 && await p.locator(".card").count() === 3 && await p.locator("#ruler span").count() === G.ERAS.length);
  check("札は高さ56px以上・ボタン", (await p.$$eval(".card", (b) => b.map((x) => x.getBoundingClientRect().height))).every((h) => h >= 56));
  const wid = await wrongId(p);
  await p.click(`.card[data-id="${wid}"]`);
  check("まちがえると ✕ の印・破線（色だけで分けない）・知らせは role=status", await p.locator(".card.ng").count() === 1 && (await p.evaluate(() => getComputedStyle(document.querySelector(".card.ng"), "::after").content)).includes("✕") && (await p.textContent("#msg")).includes("ちがいます") && await p.getAttribute("#msg", "role") === "status");
  const first = await nextId(p);
  await p.click(`.card[data-id="${first}"]`);
  check("正しい札を押すと年表に年が書きこまれ、札は下から消える", (await p.textContent("#slot0")).includes(String(G.BY[first].y)) && await p.locator(`.card[data-id="${first}"]:visible`).count() === 0 && await p.locator(".card.ng").count() === 0);
  // 開き直しても、並べた所から
  await p.reload(); await p.waitForTimeout(150); await p.click("#go-d");
  check("途中で閉じても続きから（同じ問題・並べた所から）", await p.evaluate(() => __rk.cur().placed) === 1 && await p.evaluate(() => __rk.cur().i) === 0 && (await p.textContent("#slot0")).includes(String(G.BY[first].y)));
  await solve(p);
  check("並べ終えると ✓・全部の年と一言・★2（まちがい1回）", (await p.textContent(".verdict .hd")).includes("✓") && await p.locator(".verdict li").count() === 3 && (await p.getAttribute(".verdict .stars", "aria-label")) === "星2つ");
  await p.click("#next");
  await p.click("#hint");
  check("ヒント1は札に時代を出し、ものさしに印（年は言わない）", await p.locator(".card .era:visible").count() === 3 && await p.locator("#ruler span.hit").count() >= 1 && !/\d{3,4}年/.test(await p.textContent("#cards")));
  await p.click("#hint");
  check("ヒント2は次の1枚を年表に置く・ヒントは2回まで", await p.evaluate(() => __rk.cur().placed) === 1 && await p.locator("#hint:disabled").count() === 1);
  await solve(p);
  check("ヒント2回は★1", (await p.getAttribute(".verdict .stars", "aria-label")) === "星1つ");
  await p.click("#next");
  for (let i = 2; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const s1 = await mem(p);
  check("5問で結果：今日の記録に1問ごとのまちがい（1・2・0・0・0）", JSON.stringify(s1.days[TODAY]?.m) === "[1,2,0,0,0]");
  const share = await p.textContent(".share");
  check("シェアの文に答え（できごと・年）を出さない（印だけ）", /第\d+回/.test(share) && /🟢/.test(share) && !G.EV.some((e) => share.includes(e.t)) && !/\d{3,4}年/.test(share), share);
  check("まちがいのある日は Ko-fi の一言を出さない", await p.locator(".kofi").count() === 0);
  check("結果に「覚えた年表」・あと少しの実績・続けて遊ぶ・上級のボタン", await p.locator(".rlist > div").count() === 5 && await p.locator("#achnext").count() === 1 && await p.locator("#go-e").count() === 1 && await p.locator("#go-h").count() === 1);
  const ev5 = G.dailyTags(TODAY).flatMap((t) => t.split("|")[1].split("."));
  check("年表帳に並べたできごとが載る", ev5.every((id) => s1.dex[id] > 0) && Object.keys(s1.dex).length === ev5.length && s1.solved === 5);
  await p.click("#back");
  check("今日を終えたら、ホームは「今日の結果を見る」", (await p.textContent("#go-d")).includes("結果"));
  // 上級：ヒントなし・5枚×3問
  await p.click("#go-h");
  check("上級はヒントのボタンが無い・5枚×3問", await p.locator("#hint").count() === 0 && await p.locator(".card").count() === 5 && (await p.evaluate(() => __rk.load().runs.h.list.length)) === 3);
  for (let i = 0; i < 3; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  check("上級の記録は hdays に入る", (await mem(p)).hdays[TODAY]?.m.length === 3);
  // 練習：記録を増やさない
  await p.click("#back"); await p.click("#go-p"); await p.click('.lv button[data-t="2"]');
  const before = await mem(p);
  for (let i = 0; i < 5; i++) { await solve(p); await p.click("#next"); }
  await p.waitForTimeout(150);
  const after = await mem(p);
  check("練習は今日の記録を増やさない（年表帳と並べた数はふえる）", JSON.stringify(after.days) === JSON.stringify(before.days) && after.solved === before.solved + 5 && Object.values(after.dex).reduce((a, b) => a + b) === Object.values(before.dex).reduce((a, b) => a + b) + 20);
  // 年表帳から、その時代だけで練習
  await p.click("#back"); await p.click("#go-dex");
  check("年表帳は11の時代・数の文字", await p.locator(".book button").count() === 11);
  await p.click('.book button[data-g="6"]');
  check("時代の中：並べたできごとは年と一言、まだのものは「？」", await p.locator("#evlist .no").count() === G.EV.filter((e) => G.ERA[e.era].g === 6).length);
  await p.click("#go-pg");
  check("時代を押すと、その時代だけで練習（5問・4枚）", (await p.evaluate(() => __rk.load().runs.p.list)).every((t) => t.split("|")[1].split(".").every((id) => G.ERA[G.BY[id].era].g === 6)) && await p.locator(".card").count() === 4);
  // とことん：まちがえても続く・ここで降りる・一度で並べた数が自己ベスト
  await p.click("#back"); await p.click("#go-e");
  const el = await p.evaluate(() => __rk.load().runs.e.list);
  check("とことんは45問の並びから始まり、同じ組を出さない", el.length === 45 && new Set(el.map(G.keyOf)).size === 45);
  await solve(p); await p.click("#next"); await solve(p); await p.click("#next");
  await solve(p, { wrong: 2 }); await p.click("#next");
  await p.click(`.card[data-id="${await wrongId(p)}"]`); await p.click(`.card[data-id="${await wrongId(p)}"]`).catch(() => {});
  check("とことんはまちがえても続き、ヒントも押せる（好きなだけ遊べる）", await p.locator(".verdict").count() === 0 && await p.locator("#hint:not([disabled])").count() === 1 && await p.locator(".card").count() > 0);
  await p.reload(); await p.waitForTimeout(200); await p.click("#go-e");
  check("とことんは途中で閉じても続きから（4問目）", await p.evaluate(() => __rk.cur().i) === 3);
  await p.click("#quit"); await p.waitForTimeout(150);
  check("「ここで降りる」で終わり、一度で並べた数（2問）が自己ベスト", (await mem(p)).ebest === 2 && (await p.textContent("#eres")).includes("3問") && !(await mem(p)).runs.e);
  {
    // とことんは並びを使い切っても終わらない（足して続く）
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = __rk.load(); __rk.save((s2) => { s2.runs.e = { mode: "e", date: __rk.todayKey(), list: __rk.endlessList().slice(0, 4), res: [{ m: 0 }, { m: 0 }], cur: null, id: "qa", ok: 2, a0: [] }; }); });
    await q.reload(); await q.waitForTimeout(150); await q.click("#go-e");
    for (let i = 0; i < 4; i++) { await solve(q); await q.click("#next"); }
    const r = await q.evaluate(() => __rk.load().runs.e);
    check("とことんは並びを使い切っても足して続き、足した分でも同じ組を出さない", r && r.list.length > 4 && r.res.length === 6 && new Set(r.list.map(G.keyOf)).size === r.list.length);
    await q.context().close();
  }
  {
    // とことんの並びを何百回作って、1回の中で同じ組を出さない・続けて同じできごとを出さない
    const bad = await (async () => { const q = await newPage(); const r = await q.evaluate(() => { let dup = 0, adj = 0, len = 0; for (let i = 0; i < 300; i++) { const l = __rk.endlessList(); __rk.extend(l, 2, 40); len += l.length; if (new Set(l.map(__rk.G.keyOf)).size !== l.length) dup++; for (let j = 1; j < l.length; j++) { const a = l[j - 1].split("|")[1].split("."), b = l[j].split("|")[1].split("."); if (a.some((x) => b.includes(x))) adj++; } } return { dup, adj, len }; }); await q.context().close(); return r; })();
    check("とことんの並び300回：1回の中で同じ組なし・続けて同じできごとなし", bad.dup === 0 && bad.adj === 0 && bad.len === 300 * 85, JSON.stringify(bad));
  }
  {
    // 引き継ぎコードなどで数の所に文字が入っても、画面に HTML として出さない
    const q = await newPage(); await closeHow(q);
    await q.evaluate(() => { const s = JSON.parse(localStorage.getItem("rekishi-v1")) || { v: 1 }; s.ebest = '<img id="xss" src=x>'; s.solved = '"><b id="xss4">'; s.dex = { a01: '"><b id="xss2">', zz: 3 }; s.runs = { e: { mode: "e", id: "x", date: "2026-11-07", list: ["0|a01.c01.g01"], res: [], ok: "abc", life: 2, cur: { i: 0, tag: "0|a01.c01.g01", placed: '"><i id="xss3">', wrong: [], hints: 9 } }, h: { list: "bad", res: [] }, p: { mode: "p", id: "y", date: "2026-11-07", list: ["0|constructor"], res: [] }, d: { mode: "d", id: "z", date: "x", list: ["0|a01.c01.g01"], res: [] }, a1: { mode: "a", id: "a1", date: "2026-11-06", list: ["0|a01.c01.g01"], res: [null] }, "a:2026-11-05": { mode: "x", id: "w", date: "2026-11-05", list: ["0|a01.c01.g01"], res: [] }, "a:2026-11-04": { mode: "d", id: "v", date: "2026-11-04", list: ["0|a01.c01.g01"], res: [] } }; s.days = { "2026-11-07": { m: "x" }, bad: { m: [0] }, "2026-02-30": { m: [0] } }; localStorage.setItem("rekishi-v1", JSON.stringify(s)); });
    await q.reload(); await q.waitForTimeout(250);
    const st = await q.evaluate(() => __rk.load());
    check("記録の形を直す：数の所の文字は0に・知らないできごと・形のちがう途中経過と日ごとの記録は捨てる・前の版の life は読まない", st.ebest === 0 && st.solved === 0 && st.dex.a01 === 0 && !("zz" in st.dex) && st.runs.e && !("life" in st.runs.e) && st.runs.e.cur.placed === 0 && st.runs.e.cur.hints === 2 && !("h" in st.runs) && !("p" in st.runs) && !("d" in st.runs) && !("a1" in st.runs) && Object.keys(st.days).length === 0);
    check("記録の形を直す：知らない遊び方・置き場所と遊び方が合わない途中経過は捨て、文字の ok は0にする", st.runs.e.ok === 0 && !("a:2026-11-05" in st.runs) && !("a:2026-11-04" in st.runs));
    await q.click("#go-e").catch(() => {}); await q.waitForTimeout(150);
    check("記録の文字を HTML として出さない", await q.locator("#xss, #xss2, #xss3, #xss4").count() === 0);
    await q.context().close();
  }
  // 実績・このゲームについて
  await p.click("#back"); await p.click("#go-ach");
  check("実績は14個で、腕前・集める・続けるの3つの組", await p.locator(".ach").count() === 14 && await p.locator(".agrp").count() === 3 && await p.locator(".ach.got").count() >= 2);
  check("達成した実績は ✓ の文字も付く（色だけで分けない）", (await p.textContent(".ach.got b")).startsWith("✓"));
  await p.click("#back"); await p.click("#f-about");
  check("このゲームについて：年の出どころと研究の出典", (await p.textContent("#about")).includes("年の出どころ") && await p.locator("#about a").count() >= 3);
  await p.context().close();

  // まちがいなしの日は Ko-fi を1回だけ
  {
    const q = await newPage(); await closeHow(q); await q.click("#go-d");
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    check("全部まちがいなしで初めて終えたときだけ Ko-fi の一言", await q.locator(".kofi").count() === 1 && (await q.textContent(".big")).includes("まちがいなし"));
    await q.click("#back"); await q.click("#go-d");
    check("結果をもう一度見ても Ko-fi は出さない", await q.locator(".kofi").count() === 0);
    await q.context().close();
  }

  // カレンダー・あとから：第1回より前は出さない。第1回の日を少し前に見立てて確かめる
  {
    const q = await newPage();
    await q.evaluate(([d2, d3]) => { localStorage.setItem("rekishi-v1", JSON.stringify({ v: 1, tut: true, days: { [d2]: { m: [0, 0, 0, 0, 0] }, [d3]: { m: [1, 0, 0, 2, 0] } }, hdays: {}, adays: {}, dex: {}, runs: {}, kofi: {}, ach: {}, ebest: 0 })); }, [dayBefore(2), dayBefore(3)]);
    await q.reload(); await q.waitForTimeout(150);
    check("ホームの「続けて」は、きのうを休んだら — （休んだ日を責めない）", (await q.textContent(".stats")).includes("—"));
    const lateList = await q.evaluate(() => __rk.lateDays(__rk.load()));
    const exp = [1, 4, 5, 6, 7].map(dayBefore).filter((d) => d >= "2026-11-07");
    check("取りこぼした日は過去7日・第1回（2026-11-07）より後だけ", JSON.stringify(lateList) === JSON.stringify(exp), lateList.join(","));
    // 第1回より前でも作れることを、関数で確かめる（あとから遊ぶ流れ）
    const d = dayBefore(1);
    await q.evaluate((d) => { __rk.save((s) => { s.runs["a:" + d] = { mode: "a", date: d, list: __rk.G.dailyTags(d), res: [], cur: null, id: "a" + d, a0: [] }; }); }, d);
    await q.evaluate((d) => __rk.play("a:" + d), d); await q.waitForTimeout(100);
    check("あとから：その日の今日の5問と同じ問題", JSON.stringify(await q.evaluate((d) => __rk.load().runs["a:" + d].list, d)) === JSON.stringify(G.dailyTags(d)));
    for (let i = 0; i < 5; i++) { await solve(q); await q.click("#next"); }
    await q.waitForTimeout(150);
    const s = await mem(q);
    check("あとからは adays に入り、今日の記録・続けた日・シェア・Ko-fi には数えない", s.adays[d] && !s.days[d] && (await q.locator(".share").count()) === 0 && (await q.locator(".kofi").count()) === 0);
    await q.click("#go-cal");
    check("カレンダー：遊んだ日は★の数・あとからは ↺ の文字も付く", (await q.locator(".cal .c.p3, .cal .c.p2, .cal .c.p1").count()) >= (dayBefore(3).slice(0, 7) === TODAY.slice(0, 7) ? 2 : 0) && (await q.locator(".cal .c.late").count()) >= (d.slice(0, 7) === TODAY.slice(0, 7) ? 1 : 0));
    await q.context().close();
  }

  // 古いタブ：同じ問題を2つのタブで開き、片方で並べたら、もう片方は二重に入れない
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
    const a = await newPage(390, ctx); await closeHow(a); await a.click("#go-d");
    const b = await ctx.newPage(); b.on("pageerror", (e) => errors.push(e.message)); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await solve(a);
    await b.click(`.card[data-id="${await nextId(b)}"]`);
    await b.waitForTimeout(200);
    const s = await mem(a);
    check("古いタブで同じ問題を並べても二重に数えない", s.runs.d.res.length === 1 && s.solved === 1);
    // ヒントの数は、別のタブで使った分も減らさない
    await a.click("#next"); await b.goto(url); await b.waitForTimeout(150); await b.click("#go-d");
    await a.click("#hint"); await a.click("#hint");
    await b.click("#hint");
    check("別のタブで使ったヒントの数・並べた枚数を減らさない", (await mem(a)).runs.d.cur.hints === 2 && (await mem(a)).runs.d.cur.placed === 1);
    await ctx.close();
  }

  // スマホ幅・とても大きい文字でもはみ出さない・押す所は44px以上
  {
    const bad = [], small = [];
    for (const [w, fs] of [[320, 3], [390, 2], [320, 1]]) {
      const q = await newPage(w); await closeHow(q);
      await q.evaluate((fs) => localStorage.setItem("rekishi-fs", String(fs)), fs); await q.reload(); await q.waitForTimeout(150);
      for (const go of [null, "#go-d", "hint", "solve", "#go-h", "#go-cal", "#go-dex", "#go-ach", "#go-e"]) {
        if (go === "solve") { await solve(q); }
        else if (go === "hint") { await q.click("#hint"); }
        else if (go) { await q.goto(url); await q.waitForTimeout(100); await q.click(go); }
        await q.waitForTimeout(100);
        const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (ov > 0) bad.push(`${w}px 文字${fs} ${go || "ホーム"} ${ov}px`);
        small.push(...(await q.$$eval("button:not([disabled]), a[href]", (bs) => bs.filter((b) => b.checkVisibility() && !b.closest(".cal")).filter((b) => b.getBoundingClientRect().height < 44).map((b) => (b.id || b.className || b.textContent).slice(0, 20)))).map((x) => `${w}/${fs}/${go}:${x}`));
      }
      if (w === 320 && fs === 3) { await q.goto(url); await q.waitForTimeout(100); await q.click("#go-h"); await q.screenshot({ path: path.join(root, "qa-report", "hard-320.png"), fullPage: true }); }
      await q.context().close();
    }
    check("幅320px・とても大きい文字でも横にはみ出さない", bad.length === 0, bad.join(" / "));
    check("押せる所は高さ44px以上", small.length === 0, [...new Set(small)].slice(0, 8).join(","));
  }

  // 見やすさの設定を全部入れても、ページの一番下まで動ける
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 } });
    await ctx.addInitScript(() => localStorage.setItem("a11y-v1", JSON.stringify({ read: true, cvd: true, calm: true, say: true, ruby: true })));
    const q = await newPage(390, ctx); await closeHow(q);
    const r = await q.evaluate(() => { window.scrollTo(0, 1e5); const f = document.querySelector("footer").getBoundingClientRect(); return [scrollY, Math.round(f.bottom), innerHeight, getComputedStyle(document.documentElement).position]; });
    check("見やすさの設定を全部入れても、いちばん下まで動ける（html が固定されない）", r[0] > 0 && r[1] <= r[2] && r[3] === "static", r.join(","));
    await ctx.close();
  }
  // キーボードだけで遊べる（Tab と Enter）
  {
    const q = await newPage(); await closeHow(q);
    await q.focus("#go-d"); await q.keyboard.press("Enter"); await q.waitForTimeout(100);
    for (let k = 0; k < 3; k++) { const id = await nextId(q); await q.focus(`.card[data-id="${id}"]`); await q.keyboard.press("Enter"); await q.waitForTimeout(80); }
    check("キーボードだけで札を選んで並べられる", await q.locator(".verdict").count() === 1);
    await q.context().close();
  }
} catch (e) { check("ブラウザでの検査が最後まで動く", false, e.stack.split("\n").slice(0, 3).join(" ")); }

// 引き継ぎコード（shared-workflows template/qa/transfer-check.mjs）
try {
  const sample = { "rekishi-v1": JSON.stringify({ v: 1, tut: true, days: { "2026-11-07": { m: [0, 1, 0, 0, 2] } }, hdays: {}, adays: {}, dex: { a01: 1, c01: 2, g01: 1 }, runs: {}, kofi: {}, ach: {}, ebest: 7, solved: 5, t: 1 }), "rekishi-fs": "3" };
  await checkTransfer({ browser, url, game: "rekishi-narabe", sample, check, open: async (pg) => { if (await pg.locator("#howto[open]").count()) await pg.click("#howto-ok"); } });
} catch (e) { check("引き継ぎの検査が最後まで動く", false, e.message.split("\n")[0]); }
await browser.close();
server.close();
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 歴史ならべ QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
