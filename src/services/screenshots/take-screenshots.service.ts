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

const takeScreenshotsService = async (campaign: ICampaignsObjectType) => {
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

  if (!width || height) {
    logger.error(`[ERROR] A campanha ${name} - não tem largura ou altura definida! Preencha na planilha!`);
    return;
  }

  if (!previewLink) {
    logger.error(`[ERROR] A campanha ${name} - largura: ${width} - altura: ${height} - não tem link de preview! Preencha na planilha!`);
    return;
  }

  logger.debug(
    `[DEBUG] Iniciando o serviço de tirar prints para o tamanho ${width}x${height}`
  );

  let typeSuffix = "";

  if (type.toLowerCase().includes("desktop")) {
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

    await page.goto(previewLink, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForTimeout(4000);

    await page.evaluate(
      ({ width, height }) => {
        const adIframe = Array.from(
          document.querySelectorAll(`iframe[id^="google_ads_iframe_"]`)
        ).find(
          (iframe) =>
            iframe.getAttribute("width") === String(width) &&
            iframe.getAttribute("height") === String(height)
        );
    
        if (adIframe) {
          adIframe.scrollIntoView({ block: "center", behavior: "auto" });
        }
      },
      { width, height }
    );
    
    await page.waitForTimeout(2000);

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

    if (iframes.length === 0) {
      logger.error(
        `[ERRO] Nenhum anúncio da campanha ${name} - Formato: ${width}x${height} foi encontrado!`
      );
      return;
    }

    for (const iframe of iframes) {
      await iframe.scrollIntoViewIfNeeded();
      await page.waitForTimeout(6000);
    }

    const filename = path.join(
      screenshotsDir,
      `${width}x${height}${kvPart}_${typeSuffix}.png`
    );

    await page.evaluate(() => {
      history.replaceState({}, "", location.origin + "/");
    });

    await page.evaluate(() => {
      history.replaceState({}, "", location.origin + "/");
    });

    await delay(1000);

    await screenshot({
      filename: filename,
    })
      .catch((error) => {
        logger.error(
          `Erro ao tirar print da campanha: ${name} - formato: ${width}x${height} - Erro: ${error}`
        );
      })
      .finally(() => {
        logger.info(
          `[INFO] Print da campanha ${name} - formato: ${width}x${height} - Cliente ${customer} - tirado com sucesso em: ${filename}`
        );
      });

    try {
      await uploadFileToDrive({
        filePath: filename,
        campaingName: safeDirectoryName,
      });

      logger.info(
        `[GoogleDrive] Upload realizado com sucesso para ${safeDirectoryName}/${TODAY}`
      );
    } catch (uploadError) {
      logger.error("[GoogleDrive] Falha ao enviar screenshot", {
        filePath: filename,
        customerName: name,
        format: `${width}x${height}`,
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
