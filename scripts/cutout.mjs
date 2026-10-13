// Dev helper: uploads a generated transparent PNG (a head-and-shoulders silhouette) through the real
// Inspector file input, makes it the first photo of the lead story and screenshots the page.
// Usage: node scripts/cutout.mjs <out.png> [page type, default feature] [story id, default kisan-house-arrest]
import puppeteer from "puppeteer-core";

const out = process.argv[2] ?? "cutout.png";
const kind = process.argv[3] ?? "feature";
const storyId = process.argv[4] ?? "kisan-house-arrest";
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 2300, height: 2100, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.log("console.error:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("http://localhost:3100", { waitUntil: "networkidle0" });
const [btn] = await page.$$("xpath/.//button[contains(., 'Load sample page')]");
await btn.click();
await page.waitForSelector(".page .sb", { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));

const pick = async (fn, arg) => {
  await page.evaluate(fn, arg);
  await new Promise((r) => setTimeout(r, 4000));
};
await pick((k) => {
  const sel = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.value === k && x.options.length === 7));
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(sel, k);
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}, kind);

// select the story, then feed a transparent PNG to the hidden file input
await page.click(`.page .sb[data-story-id="${storyId}"]`);
await new Promise((r) => setTimeout(r, 500));
const upload = await page.evaluate(async () => {
  const c = document.createElement("canvas");
  c.width = 600;
  c.height = 800;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 600, 800); // fully transparent background
  const body = g.createLinearGradient(0, 400, 0, 800);
  body.addColorStop(0, "#1f3a5f");
  body.addColorStop(1, "#0e1c30");
  g.fillStyle = body;
  g.beginPath();
  g.moveTo(40, 800);
  g.bezierCurveTo(50, 560, 180, 470, 300, 470);
  g.bezierCurveTo(420, 470, 550, 560, 560, 800);
  g.closePath();
  g.fill();
  g.fillStyle = "#c68642";
  g.beginPath();
  g.ellipse(300, 290, 120, 150, 0, 0, Math.PI * 2);
  g.fill();
  g.fillRect(260, 420, 80, 70);
  const blob = await new Promise((r) => c.toBlob(r, "image/png"));
  const file = new File([blob], "cutout.png", { type: "image/png" });
  const input = document.querySelector('input[type="file"][accept="image/*"]');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  return !!input;
});
console.log("uploaded:", upload);
await new Promise((r) => setTimeout(r, 1500));

// the new photo is last in the list: move it first
const [first] = await page.$$("xpath/.//button[contains(., '↑ first')]");
const firsts = await page.$$("xpath/.//button[contains(., '↑ first')]");
if (firsts.length) await firsts[firsts.length - 1].click();
await new Promise((r) => setTimeout(r, 4000));
void first;

const info = await page.evaluate((id) => {
  const b = document.querySelector(`.page .sb[data-story-id="${id}"]`);
  const checks = [...document.querySelectorAll('input[type="checkbox"]')].map((c) => c.checked);
  return {
    overlayCut: !!b.querySelector(".sb-overlay-cut"),
    overlay: !!b.querySelector(".sb-overlay"),
    rowCut: !!b.querySelector(".sb-img-cut"),
    cutoutFlags: checks,
    overflow: b.scrollHeight > Math.ceil(b.getBoundingClientRect().height) + 1,
    imgs: [...b.querySelectorAll("img")].map((i) => ({ w: i.naturalWidth, h: i.naturalHeight, png: i.src.startsWith("data:image/png") })),
  };
}, storyId);
console.log(JSON.stringify(info));
await (await page.$(".page")).screenshot({ path: out });
await browser.close();
