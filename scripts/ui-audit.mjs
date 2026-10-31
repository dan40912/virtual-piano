// UI quality gate: readable text, reachable targets and the 60/40 stage on
// five screen sizes. Run with `npm run audit:ui` after `npm run build`.
import { preview } from "vite";
import { chromium, devices } from "playwright";

const sizes = {
  "desktop 1440×900": { viewport: { width: 1440, height: 900 } },
  "laptop 1280×720": { viewport: { width: 1280, height: 720 } },
  "phone 390×844": { ...devices["iPhone 13"] },
  "phone landscape": { ...devices["iPhone 13 landscape"] },
  "small 320×640": { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
};

function inspect() {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.opacity !== "0" &&
      r.bottom > 0 && r.top < innerHeight && !el.closest('[inert],[aria-hidden="true"]');
  };
  const coarse = matchMedia("(pointer: coarse)").matches;
  const min = coarse ? 44 : 32;
  const problems = [];
  for (const el of document.querySelectorAll("button, a, summary, [role=slider]")) {
    if (!visible(el) || el.classList.contains("piano-key")) continue;
    const r = el.getBoundingClientRect();
    const label = (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30);
    // A wide slider is easy to hit even when it is not 44px tall.
    const wideSlider = el.getAttribute("role") === "slider" && r.width >= 120 && r.height >= 28;
    if (!wideSlider && (r.width < min - 0.5 || r.height < min - 0.5))
      problems.push(`target "${label}" is ${Math.round(r.width)}×${Math.round(r.height)}px (min ${min})`);
  }
  for (const el of document.querySelectorAll("body *")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !visible(el)) continue;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11) problems.push(`text "${el.textContent.trim().slice(0, 30)}" is ${size}px`);
  }
  if (document.documentElement.scrollWidth > innerWidth + 1) problems.push("page scrolls horizontally");
  const keys = document.querySelector(".vp-keys")?.getBoundingClientRect().height ?? 0;
  const share = keys / innerHeight;
  if (Math.abs(share - 0.4) > 0.02) problems.push(`keyboard takes ${(share * 100).toFixed(1)}% of the height, not 40%`);
  return problems;
}

const server = await preview({ preview: { port: 4173, strictPort: true } });
const url = server.resolvedUrls.local[0];
const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
let failures = 0;
try {
  for (const [name, options] of Object.entries(sizes)) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(600);
    const states = { "closed lid": [] };
    states["closed lid"] = await page.evaluate(inspect);
    await page.locator(".cta").click();
    await page.waitForTimeout(2200);
    states["open lid"] = await page.evaluate(inspect);
    await page.locator(".settings-button").click();
    await page.waitForTimeout(500);
    states["settings drawer"] = await page.evaluate(inspect);
    for (const [state, problems] of Object.entries(states)) {
      for (const problem of problems) console.log(`✗ ${name} · ${state}: ${problem}`);
      failures += problems.length;
    }
    for (const error of errors) console.log(`✗ ${name}: page error ${error}`);
    failures += errors.length;
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
if (failures) {
  console.log(`\n${failures} UI problem(s) found.`);
  process.exit(1);
}
console.log("UI audit passed: text ≥ 11px, targets reachable, keyboard at 40%, no horizontal scroll.");
