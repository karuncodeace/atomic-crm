import { chromium } from "playwright";
const out = process.argv[2];
const browser = await chromium.launch();
const shoot = async (name, width, height, path) => {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto("http://localhost:5199/" + path);
  await page.waitForTimeout(2500);
  if (await page.getByRole("button", { name: /sign in/i }).count()) {
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForTimeout(2500);
    await page.goto("http://localhost:5199/" + path);
    await page.waitForTimeout(2500);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.close();
};
await shoot("dash-1440", 1440, 960, "");
await shoot("dash-1100", 1100, 800, "");
await shoot("brochures-1440", 1440, 900, "brochures");
await shoot("dash-mobile", 390, 844, "");
await browser.close();
