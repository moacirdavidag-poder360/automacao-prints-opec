import { Builder, WebDriver, By } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import screenshot from "screenshot-desktop";
import dayjs from "dayjs";
import fs from "node:fs";
import path from "node:path";
import robot from "robotjs";
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

  let driver: WebDriver | null = null;

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

    const options = new chrome.Options();

    if (executablePath) {
      options.setChromeBinaryPath(executablePath);
    }

    options.addArguments(
      "--start-maximized",
      `--user-data-dir=${userDataPath}`
    );

    if (isMobile && extensionPath && fs.existsSync(extensionPath)) {
      options.addArguments(`--load-extension=${extensionPath}`);
    }

    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    await driver.get(previewLink);

    await driver.wait(async () => {
      const readyState = await driver!.executeScript(
        "return document.readyState"
      );
      return readyState === "interactive" || readyState === "complete";
    }, 10000);

    if (isMobile) {
      await delay(1000);

      const windowHandle = await driver.getWindowHandle();
      await driver.switchTo().window(windowHandle);
      await delay(800);

      robot.moveMouse(500, 500);
      robot.mouseClick();
      await delay(1000);

      robot.keyToggle("control", "down");
      robot.keyToggle("shift", "down");
      robot.keyToggle("m", "down");

      await delay(500);

      robot.keyToggle("control", "up");
      robot.keyToggle("shift", "up");
      robot.keyToggle("m", "up");

      await delay(2000);

      await delay(3000);
    }

    await delay(3000);

    logger.info(
      `[INFO] Iniciando scroll inteligente para encontrar anúncio ${width}x${height}...`
    );

    const targetAdFound = await driver.executeScript(`
      return new Promise((resolve) => {
        const targetWidth = ${width};
        const targetHeight = ${height};
        let scrollAttempts = 0;
        const maxAttempts = 50;
        const distance = 400;
    
        const getSize = (el) => {
          let w = el.getAttribute('width');
          let h = el.getAttribute('height');
    
          if (!w || !h) {
            w = el.offsetWidth;
            h = el.offsetHeight;
          }
    
          if (!w || !h || w == 0 || h == 0) {
            const rect = el.getBoundingClientRect();
            w = rect.width;
            h = rect.height;
          }
    
          return {
            w: Math.round(Number(w)),
            h: Math.round(Number(h))
          };
        };
    
        const findTargetAd = () => {
          const elements = [
            ...document.querySelectorAll('iframe[id^="google_ads_iframe_"]'),
            ...document.querySelectorAll('.img_ad'),
            ...document.querySelectorAll('#google_image_div'),
            ...document.querySelectorAll('a[href*="googleads"]')
          ];
    
          for (const el of elements) {
            const { w, h } = getSize(el);
    
            if (w === targetWidth && h === targetHeight) {
              return true;
            }
          }
    
          return false;
        };
    
        const scrollAndCheck = () => {
          if (findTargetAd()) {
            resolve(true);
            return;
          }
    
          scrollAttempts++;
    
          if (scrollAttempts >= maxAttempts) {
            resolve(false);
            return;
          }
    
          window.scrollBy(0, distance);
          setTimeout(scrollAndCheck, 500);
        };
    
        scrollAndCheck();
      });
    `);

    if (!targetAdFound) {
      logger.error(
        `[ERRO] Anúncio ${width}x${height} não encontrado após scroll inteligente`
      );
      return;
    }

    logger.info(`[INFO] Anúncio ${width}x${height} encontrado na página!`);

    await delay(1500);

    let iframeElements = await driver.findElements(
      By.css(`iframe[id*="google_ads_iframe_"]`)
    );

    const imgElements = await driver.findElements(
      By.css(
        `img[src*="googlesyndication.com"], .img_ad, #google_image_div, a[href*="googleads"]`
      )
    );

    const googleDivElements = await driver.findElements(
      By.css(`#google_image_div`)
    );

    const allElements = [
      ...iframeElements,
      ...imgElements,
      ...googleDivElements,
    ];

    logger.info(
      `[INFO] ${iframeElements.length} iframe(s) + ${imgElements.length} imagem(ns) = ${allElements.length} elemento(s) total`
    );

    let targetIframe = null;

    for (let i = 0; i < allElements.length; i++) {
      const element = allElements[i];

      try {
        let w = await element!.getAttribute("width");
        let h = await element!.getAttribute("height");

        if (!w || !h || w === "0" || h === "0") {
          const rect = await element!.getRect();
          w = String(Math.round(rect.width));
          h = String(Math.round(rect.height));
        }

        if (!w || !h) {
          const rect = await element!.getRect();
          w = String(rect.width);
          h = String(rect.height);
        }

        logger.info(
          `[INFO] Elemento ${i}: ${w}x${h} (alvo: ${width}x${height})`
        );

        if (String(w) === String(width) && String(h) === String(height)) {
          targetIframe = element;
          logger.info(`[INFO] Anúncio alvo encontrado no índice ${i}`);
          break;
        }
      } catch (err) {
        logger.warn(
          `[WARNING] Erro ao verificar elemento ${i}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }

    if (!targetIframe) {
      logger.error(
        `[ERRO] Nenhum anúncio ${width}x${height} encontrado entre os ${allElements.length} elementos`
      );
      return;
    }

    await driver.executeScript(
      "arguments[0].scrollIntoView({ block: 'center' });",
      targetIframe
    );

    logger.info(`[INFO] Anúncio alvo centralizado na tela`);

    await delay(2000);

    await driver.executeScript(
      `(target) => {
        const hideEl = (el) => {
          if (!el) return;
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('height', '0px', 'important');
          el.style.setProperty('width', '0px', 'important');
          el.style.setProperty('overflow', 'hidden', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.style.setProperty('position', 'absolute', 'important');
          el.style.setProperty('z-index', '-9999', 'important');
        };
    
        const mark = (el) => {
          if (!el) return;
          el.setAttribute('data-target-ad', 'true');
        };
    
        mark(target);
    
        let parent = target.parentElement;
        while (parent) {
          mark(parent);
          parent = parent.parentElement;
        }
    
        const allAdNodes = document.querySelectorAll(
          [
            'div[id^="google_ads_iframe_"]',
            'div[id*="google_ads_iframe_"][id*="container"]',
            'iframe[id^="google_ads_iframe_"]',
            '#google_image_div',
            '.img_ad',
            'a[href*="googleads"]'
          ].join(',')
        );
    
        allAdNodes.forEach((el) => {
          if (!el.closest('[data-target-ad="true"]')) {
            hideEl(el);
          }
        });
    
        document.querySelectorAll('#google_image_div').forEach((div) => {
          if (!div.closest('[data-target-ad="true"]')) {
            hideEl(div);
            let parent = div.parentElement;
            let depth = 0;
            while (parent && depth < 3) {
              hideEl(parent);
              parent = parent.parentElement;
              depth++;
            }
          }
        });
      }`,
      targetIframe
    );

    logger.info(`[INFO] Outros anúncios ocultados`);

    await driver.executeScript(`
      history.replaceState({}, "", location.origin + "/");
    `);

    await delay(1000);

    const filename = path.join(
      screenshotsDir,
      `${width}x${height}${kvPart}_${typeSuffix}.png`
    );

    await screenshot({ filename });

    logger.info(`[INFO] Print tirado: ${filename}`);

    await uploadFileToDrive({
      filePath: filename,
      campaingName: safeDirectoryName,
    });

    logger.info(`[INFO] Print enviado para o Google Drive`);
  } catch (error) {
    logger.error(
      `[ERRO] ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    if (driver) await driver.quit();
  }
};

export default takeScreenshotsService;
