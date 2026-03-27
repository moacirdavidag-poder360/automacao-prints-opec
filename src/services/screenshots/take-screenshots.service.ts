import puppeteer from "puppeteer";
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
      `[WARNING] A campanha ${name} não tá em período de veiculação: ${startDate} à ${endDate} - Hoje é: ${TODAY}`
    );
    return;
  }

  let typeSuffix = type.toLowerCase().includes("desktop")
    ? "D"
    : type.toLowerCase().includes("mobile")
    ? "M"
    : "";

  let kvPart = kvTotal && kvTotal > 1 ? `_KV${kvIndex}` : "";

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

  let browser: any = null;

  try {
    const isMobile = type.toLowerCase().includes("mobile");

    const userDataPath = isMobile
      ? process.env.GOOGLE_CHROME_PROFILE_PATH_MOBILE
      : process.env.GOOGLE_CHROME_PROFILE_PATH;

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    const executablePath = process.env.GOOGLE_CHROME_PATH as string;
    const extensionPath = process.env.GOOGLE_CHROME_EXTENSION_PATH as string;

    logger.debug(`[DEBUG] Abrindo Chrome com perfil: ${userDataPath}`);

    browser = await puppeteer.launch({
      headless: false,
      pipe: true,
      userDataDir: userDataPath,
      executablePath: executablePath,
      defaultViewport: null,
      enableExtensions: isMobile ? [extensionPath] : [],
      args: [
        "--start-maximized",
        "--disable-infobars",
        "--no-first-run",
        "--no-default-browser-check",
        ...(isMobile ? [`--load-extension=${extensionPath}`] : []),
      ],
    });

    const page = await browser.newPage();

    logger.debug(`[DEBUG] Página criada: ${page}`);

    logger.debug(`[DEBUG] Navegando para: ${previewLink}`);

    await page.goto(previewLink, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    logger.debug(`[DEBUG] Página carregada`);

    const shortcut = process.env.EXTENSION_TOGGLE_SHORTCUT as string;

    if (isMobile && shortcut) {
      logger.debug('[DEBUG] Ativando extensão mobile para tirar prints...');
      const keys = shortcut.split("+");

      for (const key of keys.slice(0, -1)) {
        await page.keyboard.down(key);
      }

      await page.keyboard.press(keys[keys.length - 1]);

      for (const key of keys.slice(0, -1).reverse()) {
        await page.keyboard.up(key);
      }

      logger.debug('[DEBUG] Extensão mobile ativada!');

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    await new Promise((resolve) => setTimeout(resolve, 6000));

    const pageUrl = page.url();
    const pageTitle = await page.title();

    logger.info(`[INFO] URL: ${pageUrl} | Título: ${pageTitle}`);

    await new Promise((resolve) => setTimeout(resolve, 4000));

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

    await new Promise((resolve) => setTimeout(resolve, 4000));

    await page.evaluate(() => {
      const adVideoBlock = document.querySelector(".HPR_VIDEO") as HTMLElement;
      if (adVideoBlock) adVideoBlock.style.display = "none";
    });

    await page.evaluate(
      ({ width, height }: { width: number; height: number }) => {
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

        if (!(width === 970 && height === 90)) {
          const footerBanner = document.querySelector(
            ".box-banner-footer-desktop"
          ) as HTMLElement;

          if (footerBanner) {
            const button = footerBanner.querySelector("button") as HTMLElement;

            if (button) {
              button.click();
            }
          }
        }
      },
      { width, height }
    );

    const iframes = await page.$$(
      `iframe[id^="google_ads_iframe_"][width="${width}"][height="${height}"]`
    );

    if (iframes.length === 0) {
      logger.error(
        `[ERRO] Nenhum anúncio encontrado - Campanha: ${name}, Formato: ${width}x${height}`
      );
      return;
    }

    for (const iframe of iframes) {
      await iframe.evaluate((el: any) => el.scrollIntoView());
      await new Promise((resolve) => setTimeout(resolve, 6000));
    }

    const filename = path.join(
      screenshotsDir,
      `${width}x${height}${kvPart}_${typeSuffix}.png`
    );

    await page.evaluate(() => {
      history.replaceState({}, "", location.origin + "/");
    });

    const DELAY_MS = Number(process.env.DELAY_PRINT_MS) || 1000;
    await delay(DELAY_MS);

    await screenshot({ filename: filename })
      .catch((error) => {
        logger.error(
          `[ERRO] Falha ao tirar print: ${name} - ${width}x${height} - ${error}`
        );
      })
      .finally(() => {
        logger.info(`[INFO] Print tirado com sucesso: ${filename}`);
      });

    try {
      await uploadFileToDrive({
        filePath: filename,
        campaingName: safeDirectoryName,
      });

      logger.info(
        `[INFO] Upload para Google Drive realizado: ${safeDirectoryName}/${TODAY}`
      );
    } catch (uploadError) {
      logger.error("[ERRO] Falha ao fazer upload para Google Drive", {
        file: filename,
        error: uploadError,
      });
    }
  } catch (error) {
    logger.error(
      `[ERRO] Falha no serviço de screenshots: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

export default takeScreenshotsService;
