import { chromium } from "playwright";
import type { Browser } from "playwright";
import screenshot from "screenshot-desktop";
import dayjs from "dayjs";
import fs from "node:fs";
import path from "node:path";
import logger from "../../config/logger.config.js";

import customParseFormat from "dayjs/plugin/customParseFormat.js";
import isBetween from "dayjs/plugin/isBetween.js";
dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

import { uploadFileToDrive } from "../googleDrive/google-drive-upload.service.js";

import type { ICampaignsObjectType } from "../../types/campaigns.type.js";

import { delay, sanitize } from "../../utils/functions.js";

const takeDesktopScreenshotsService = async (
  campaign: ICampaignsObjectType
) => {
  const {
    customer,
    format,
    startDate,
    endDate,
    name,
    previewLink,
    kvIndex,
    kvTotal,
  } = campaign;

  const { width, height, type } = format;

  logger.info(
    `[INFO] Iniciando o tirar prints da campanha ${name} - ${width}x${height} - ${type} - Cliente ${customer}...`
  );

  const TODAY = dayjs().format("DD-MM-YYYY");
  const TODAY_DATE = dayjs();
  const startDateObject = dayjs(startDate, "DD/MM/YYYY");
  const endDateObject = dayjs(endDate, "DD/MM/YYYY");

  const isCampaignPeriodValid = TODAY_DATE.isBetween(
    startDateObject,
    endDateObject,
    "day",
    "[]"
  );

  if (!isCampaignPeriodValid) {
    logger.warn(
      `[WARNING] A campanha ${name} não tá em período de veiculação: ${startDate} à ${endDate}`
    );
    return;
  }

  if (!width || !height) {
    logger.error(
      `[ERROR] A campanha ${name} - não tem largura ou altura definida!`
    );
    return;
  }

  if (!previewLink) {
    logger.error(`[ERROR] A campanha ${name} - não tem link de preview!`);
    return;
  }

  let typeSuffix = "";

  if (
    type.toLowerCase().includes("desktop") ||
    type.toLowerCase().includes("interno")
  ) {
    typeSuffix = "D";
  }

  if (type.toLowerCase().includes("mobile")) {
    typeSuffix = "M";
  }

  let kvPart = "";

  if (kvTotal && kvTotal > 1) {
    kvPart = `_KV${kvIndex}`;
  }

  const safeDirectoryName = sanitize(name);

  const screenshotsDir = path.resolve(
    process.cwd(),
    "screenshots",
    safeDirectoryName,
    TODAY
  );

  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  let browser: Browser | null = null;

  try {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const executablePath = process.env.GOOGLE_CHROME_PATH as string;

    browser = await chromium.launch({
      headless: false,
      args: [
        "--start-maximized",
        "--window-position=0,0",
        "--window-size=1920,1080",
      ],
      executablePath,
    });

    const context = await browser.newContext({
      viewport: null,
    });

    const page = await context.newPage();

    await page.goto(previewLink, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    if (type.toLowerCase().includes("interno")) {
      const links = await page.$$eval(".box-news-list__subhead a", (els) =>
        els.map((el) => (el as HTMLAnchorElement).href)
      );

      if (links.length > 0) {
        const randomLink = links[Math.floor(Math.random() * links.length)];

        logger.info(`[INFO] Acessando matéria interna: ${randomLink}`);

        await page.goto(randomLink!, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        await page.waitForTimeout(4000);

        // @moacirdavidag - Eu diminuo o zoom para 50% para tirar print pq esse formato é muito grande
        if(width === "300" && height === "1050") {
          await page.evaluate(() => {
            document.body.style.zoom = '0.5'; 
          });
        }
      }
    }

    await page.evaluate(() => {
      const closeBtn = document.querySelector(
        ".ym-video-sticky-close"
      ) as HTMLElement;

      if (closeBtn) closeBtn.click();
    });

    if (!(width === "970" && height === "90")) {
      await page.evaluate(() => {
        const btn = document.querySelector(
          ".box-banner__banner button"
        ) as HTMLElement;

        if (btn) btn.click();
      });
    }

    const findAndScroll = async () => {
      for (let i = 0; i < 30; i++) {
        const found = await page.evaluate(
          ({ width, height }) => {
            const iframe = Array.from(
              document.querySelectorAll('iframe[id^="google_ads_iframe_"]')
            ).find(
              (el) =>
                el.getAttribute("width") === String(width) &&
                el.getAttribute("height") === String(height)
            );

            if (iframe) {
              iframe.scrollIntoView({
                block: "center",
                behavior: "auto",
              });
              return true;
            }

            window.scrollBy(0, window.innerHeight * 0.7);
            return false;
          },
          { width, height }
        );

        if (found) {
          logger.info("[INFO] Anúncio encontrado e centralizado");
          return true;
        }

        await page.waitForTimeout(800);
      }

      return false;
    };

    const found = await findAndScroll();

    if (!found) {
      logger.error(`[ERRO] Anúncio ${width}x${height} não encontrado`);
      return;
    }

    await page.evaluate(
      ({ width, height }) => {
        const closeBtn = document.querySelector(
          ".ym-video-sticky-close"
        ) as HTMLElement;

        if (closeBtn) closeBtn.click();

        const iframes = document.querySelectorAll(
          'iframe[id^="google_ads_iframe_"]'
        );

        iframes.forEach((iframe) => {
          const w = iframe.getAttribute("width");
          const h = iframe.getAttribute("height");

          if (w !== String(width) || h !== String(height)) {
            const el = iframe as HTMLElement;
            el.style.display = "none";

            const p1 = el.parentElement;
            if (p1) p1.style.display = "none";

            const p2 = p1?.parentElement;
            if (p2) p2.style.display = "none";
          }
        });
      },
      { width, height }
    );

    logger.info("[INFO] Anúncio encontrado e outros ocultados no desktop");

    await page.waitForTimeout(2000);

    const filename = path.join(
      screenshotsDir,
      `${width}x${height}${kvPart}_${typeSuffix}.png`
    );

    await page.evaluate(() => {
      const cleanUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, "", cleanUrl);
    });

    logger.info("[INFO] URL limpa para base sem query params");

    await delay(1000);

    await screenshot({
      filename,
    });

    logger.info(`[INFO] Print salvo: ${filename}`);

    // @moacirdavidag - Volto ao zoom normal
    if(width === "300" && height === "1050") {
      await page.evaluate(() => {
        document.body.style.zoom = '1.0'; 
      });
    }

    await uploadFileToDrive({
      filePath: filename,
      campaingName: safeDirectoryName,
    });

    logger.info(`[GoogleDrive] Upload realizado com sucesso`);
  } catch (error) {
    logger.error(
      `[ERRO] ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default takeDesktopScreenshotsService;
