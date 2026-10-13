// Dev helper: loads the sample page in headless Chrome and saves a screenshot of the newspaper page.
import puppeteer from "puppeteer-core";

const out = process.argv[2] ?? "page.png";
// optional 2nd arg: page type (front, regional, feature, opinion, business, sports, world)
const kind = process.argv[3];
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
if (kind) {
  await page.evaluate((k) => {
    const sel = [...document.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.value === k && x.options.length === 7));
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set;
    set.call(sel, k);
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, kind);
  await new Promise((r) => setTimeout(r, 4000));
}
await page.select("select", "1");
await new Promise((r) => setTimeout(r, 500));
const el = await page.$(".page");
await el.screenshot({ path: out });
const info = await page.evaluate(() =>
  [...document.querySelectorAll(".page .sb")].map((b) => ({
    id: b.getAttribute("data-story-id"),
    h: Math.round(b.getBoundingClientRect().height),
    sh: b.scrollHeight,
    over: b.scrollHeight > Math.ceil(b.getBoundingClientRect().height) + 1,
    photos: b.querySelectorAll("img").length,
    slack: Math.round(b.getBoundingClientRect().bottom - [...b.children].reduce((m, c) => Math.max(m, c.getBoundingClientRect().bottom), 0)),
  })),
);
console.log(info.map((i) => `${i.id}: photos=${i.photos} slack=${i.slack}px`).join("\n"));
console.log("overflowing:", info.filter((i) => i.over).map((i) => i.id).join(",") || "none");
await browser.close();
