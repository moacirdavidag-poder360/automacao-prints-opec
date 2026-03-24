import { chromium } from "playwright";
import type { Browser } from "playwright";
import screenshot from "screenshot-desktop";
import fs from "node:fs";
import path from "node:path";
import logger from "../../config/logger.config.js";
import type { ITakeScreenshotsType } from "../../types/take-screenshots.type.js";
import dayjs from "dayjs";
import { uploadFileToDrive } from "../googleDrive/google-drive-upload.service.js";

const takeScreenshotsService = async (args: ITakeScreenshotsType) => {
  const { width, height, ad_name, po_number } = args;

  logger.info(
    `[INFO] Iniciando o tirar prints da campanha ${ad_name} - ${width}x${height}...`
  );

  logger.debug(
    `[DEBUG] Iniciando o serviço de tirar prints para o tamanho ${width}x${height}`
  );

  let TODAY: string = dayjs().format("DD-MM-YYYY");

  const screenshotsDir = path.resolve(
    process.cwd(),
    "screenshots",
    po_number,
    TODAY
  );

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: [
        "--start-maximized",
        "--window-position=0,0",
        "--window-size=1920,1080",
      ],
    });

    const context = await browser.newContext({
      viewport: null,
    });

    const page = await context.newPage();

    await page.goto("https://www.poder360.com.br", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    await page.evaluate(async () => {
      await new Promise<void>((resolve) => {
        let total = 0;
        const distance = 400;

        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          total += distance;

          const scrollHeight = document.body.scrollHeight;
          if (total >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    await page.waitForTimeout(4000);

    await page.evaluate(() => {
      const adVideoBlock = document.querySelector(".HPR_VIDEO") as HTMLElement;
      adVideoBlock.style.display = "none";
    });

    await page.evaluate(
      ({ width, height }) => {
        const iframes = document.querySelectorAll(
          'iframe[id^="google_ads_iframe_"]'
        );

        iframes.forEach((iframe) => {
          const w = iframe.getAttribute("width");
          const h = iframe.getAttribute("height");

          if (w !== String(width) || h !== String(height)) {
            const el = iframe as HTMLElement;
            el.style.display = "none";

            const parent1 = el.parentElement;
            if (parent1) parent1.style.display = "none";

            const parent2 = parent1?.parentElement;
            if (parent2) parent2.style.display = "none";
          }
        });
      },
      { width, height }
    );

    const iframes = await page.$$(
      `iframe[id^="google_ads_iframe_"][width="${width}"][height="${height}"]`
    );

    for (const iframe of iframes) {
      await iframe.scrollIntoViewIfNeeded();
      await page.waitForTimeout(6000);
    }

    const filename = path.join(screenshotsDir, `${width}x${height}.png`);

    await screenshot({
      filename: filename,
    });

    logger.info(
      `[INFO] Print da campanha ${ad_name} - formato: ${width}x${height} tirado com sucesso em: ${filename}`
    );

    try {
      await uploadFileToDrive({
        filePath: filename,
        poNumber: po_number,
      });

      logger.info(
        `[GoogleDrive] Upload realizado com sucesso para ${po_number}/${TODAY}`
      );
    } catch (uploadError) {
      logger.error("[GoogleDrive] Falha ao enviar screenshot", {
        filePath: filename,
        poNumber: po_number,
        error: uploadError,
      });
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(
        `Erro ao iniciar o serviço de tirar prints: ${error.message}`
      );
    } else {
      logger.error("Erro ao iniciar o serviço de tirar prints:", error);
    }
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default takeScreenshotsService;
