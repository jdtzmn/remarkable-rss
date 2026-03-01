import puppeteer from "puppeteer-core";

const EXECUTABLE_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

/**
 * Render an HTML string to a PDF buffer using Puppeteer.
 * Page size matches reMarkable Paper Pro native resolution: 1404×1872px.
 */
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    executablePath: EXECUTABLE_PATH,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdf = await page.pdf({
      width: "1404px",
      height: "1872px",
      printBackground: true,
      margin: {
        top: "60px",
        bottom: "60px",
        left: "0px",
        right: "0px",
      },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
