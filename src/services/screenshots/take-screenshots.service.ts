import { Builder, WebDriver } from "selenium-webdriver";
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
      logger.debug(`[DEBUG] Extensão carregada: ${extensionPath}`);
    }

    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    const cdpConnection = await driver.createCDPConnection("page");

    await cdpConnection.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
            (function () {
      
              const TARGET_WIDTH = ${width};
              const TARGET_HEIGHT = ${height};
      
              const hideAds = () => {
      
                const divs = document.querySelectorAll('#google_image_div');
      
                for (let i = 0; i < divs.length; i++) {
                  const div = divs[i];
                  const img = div.querySelector('img');
      
                  if (img) {
                    const w = img.getAttribute('width');
                    const h = img.getAttribute('height');
      
                    if (w !== String(TARGET_WIDTH) || h !== String(TARGET_HEIGHT)) {
                      div.style.cssText = 'display:none !important; visibility:hidden !important; height:0;width:0;overflow:hidden;';
                    }
                  }
                }
      
                const iframes = document.querySelectorAll('iframe[id^="google_ads_iframe_"]');
      
                for (let i = 0; i < iframes.length; i++) {
                  const iframe = iframes[i];
                  const w = iframe.getAttribute('width');
                  const h = iframe.getAttribute('height');
      
                  if (w !== String(TARGET_WIDTH) || h !== String(TARGET_HEIGHT)) {
                    iframe.style.display = 'none';
      
                    let parent = iframe.parentElement;
                    let depth = 0;
      
                    while (parent && depth < 3) {
                      parent.style.display = 'none';
                      parent = parent.parentElement;
                      depth++;
                    }
                  }
                }
      
              };
      
              const start = () => {
                hideAds();

                const observer = new MutationObserver(hideAds);
                observer.observe(document.documentElement, {
                  childList: true,
                  subtree: true
                });

                setInterval(hideAds, 300);
              };

              start();
      
            })();
          `,
    });

    logger.debug(`[DEBUG] Navegando para: ${previewLink}`);
    await driver.get(previewLink);

    await driver.executeScript(
      `(width, height) => {
    
        const hideAds = () => {
    
          document.querySelectorAll('[id^="google_"], [class*="google"], iframe').forEach((el) => {
    
            const w = el.getAttribute?.('width');
            const h = el.getAttribute?.('height');
    
            if (w && h) {
              if (w !== String(width) || h !== String(height)) {
                el.style.display = 'none';
                el.style.visibility = 'hidden';
              }
            } else {
              if (el.id?.includes('google') || el.className?.toString().includes('google')) {
                el.style.display = 'none';
              }
            }
    
          });
    
        };
    
        hideAds();
    
      }`,
      width,
      height
    );

    await delay(3000);

    if (isMobile) {
      logger.debug(
        "[DEBUG] Ativando extensão do simulador móvel via RobotJS..."
      );
      await delay(1000);

      try {
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

        logger.info("[INFO] Atalho CTRL+SHIFT+M enviado via RobotJS!");
        await delay(4000);

        logger.debug("[DEBUG] Recarregando página com extensão ativa...");
        await driver.navigate().refresh();
        await delay(6000);

        const isDevToolsActive = await driver.executeScript(`
          return window.innerWidth !== window.screen.availWidth ||
                 window.innerHeight !== window.screen.availHeight;
        `);

        if (isDevToolsActive) {
          logger.info(
            "[INFO] Extensão de simulador móvel ativada com sucesso!"
          );
        } else {
          logger.warn("[WARNING] Extensão pode não estar ativada corretamente");
        }
      } catch (err) {
        logger.error(`[ERRO] Falha ao ativar extensão: ${err}`);
      }
    }

    const pageUrl = await driver.getCurrentUrl();
    const pageTitle = await driver.getTitle();
    logger.info(`[INFO] URL: ${pageUrl} | Título: ${pageTitle}`);

    await delay(2000);

    await driver.executeScript(`
      const adVideoBlock = document.querySelector('.HPR_VIDEO');
      if (adVideoBlock) adVideoBlock.style.display = 'none';
    `);

    let iframeElements = await driver.findElements({
      css: `iframe[id^="google_ads_iframe_"][width="${width}"][height="${height}"]`,
    });

    if (iframeElements.length === 0) {
      logger.info(
        `[INFO] Nenhum anúncio encontrado na viewport. Fazendo scroll para encontrar ${width}x${height}...`
      );

      const found = await driver.executeScript(`
        return new Promise((resolve) => {
          let total = 0;
          const distance = 500;
          const targetWidth = ${width};
          const targetHeight = ${height};

          const timer = setInterval(() => {
            const iframes = document.querySelectorAll(
              'iframe[id^="google_ads_iframe_"][width="' + targetWidth + '"][height="' + targetHeight + '"]'
            );

            if (iframes.length > 0) {
              clearInterval(timer);
              resolve(true);
              return;
            }

            window.scrollBy(0, distance);
            total += distance;

            if (total >= document.body.scrollHeight) {
              clearInterval(timer);
              resolve(false);
            }
          }, 300);
        });
      `);

      await delay(2000);

      if (!found) {
        logger.error(
          `[ERRO] Nenhum anúncio da campanha ${name} - Formato: ${width}x${height} foi encontrado após scroll completo!`
        );
        return;
      }

      iframeElements = await driver.findElements({
        css: `iframe[id^="google_ads_iframe_"][width="${width}"][height="${height}"]`,
      });
    }

    if (iframeElements.length === 0) {
      logger.error(
        `[ERRO] Nenhum anúncio da campanha ${name} - Formato: ${width}x${height} foi encontrado!`
      );
      return;
    }

    logger.info(
      `[INFO] Anúncio encontrado! Centralizando e capturando ${width}x${height}...`
    );

    for (const iframe of iframeElements) {
      await driver.executeScript(
        "arguments[0].scrollIntoView({ behavior: 'auto', block: 'center' });",
        iframe
      );
      await delay(1500);
    }

    await driver.executeScript(
      `(width, height) => {
        document.querySelectorAll('div[style*="position:absolute"][style*="overflow:hidden"]').forEach((el) => {
          const attrs = el.attributes;
          let isAd = false;

          for (let attr of attrs) {
            if (attr.name.includes('google') || attr.value.includes('google')) {
              isAd = true;
              break;
            }
          }

          if (isAd) {
            const iframe = el.querySelector('iframe');
            const w = iframe?.getAttribute('width');
            const h = iframe?.getAttribute('height');

            if (w !== String(width) || h !== String(height)) {
              el.style.display = 'none';
              el.style.visibility = 'hidden';
              el.style.height = '0';
              el.style.width = '0';
              el.style.overflow = 'hidden';
            }
          }
        });

        const iframes = document.querySelectorAll('iframe[id^="google_ads_iframe_"]');

        iframes.forEach((iframe) => {
          const w = iframe.getAttribute('width');
          const h = iframe.getAttribute('height');

          if (w !== String(width) || h !== String(height)) {
            iframe.style.display = 'none';
            iframe.style.visibility = 'hidden';

            const parent1 = iframe.parentElement;
            if (parent1) {
              parent1.style.display = 'none';
              parent1.style.visibility = 'hidden';
              parent1.style.height = '0';
              parent1.style.width = '0';
              parent1.style.overflow = 'hidden';
            }

            const parent2 = parent1?.parentElement;
            if (parent2) {
              parent2.style.display = 'none';
              parent2.style.visibility = 'hidden';
              parent2.style.height = '0';
              parent2.style.width = '0';
              parent2.style.overflow = 'hidden';
            }

            const parent3 = parent2?.parentElement;
            if (parent3) {
              parent3.style.display = 'none';
              parent3.style.visibility = 'hidden';
              parent3.style.height = '0';
              parent3.style.width = '0';
              parent3.style.overflow = 'hidden';
            }
          }
        });

        document.querySelectorAll('[id^="google_image_div"]').forEach((div) => {
          div.style.display = 'none';
          div.style.visibility = 'hidden';
          div.style.height = '0';
          div.style.width = '0';
          div.style.overflow = 'hidden';

          const parent1 = div.parentElement;
          if (parent1) {
            parent1.style.display = 'none';
            parent1.style.visibility = 'hidden';
            parent1.style.height = '0';
            parent1.style.width = '0';
            parent1.style.overflow = 'hidden';
          }

          const parent2 = parent1?.parentElement;
          if (parent2) {
            parent2.style.display = 'none';
            parent2.style.visibility = 'hidden';
            parent2.style.height = '0';
            parent2.style.width = '0';
            parent2.style.overflow = 'hidden';
          }

          const parent3 = parent2?.parentElement;
          if (parent3) {
            parent3.style.display = 'none';
            parent3.style.visibility = 'hidden';
            parent3.style.height = '0';
            parent3.style.width = '0';
            parent3.style.overflow = 'hidden';
          }
        });

        if (!(width === 970 && height === 90)) {
          const bannerFooter = document.getElementById("google_image_div");
          if (bannerFooter) bannerFooter.style.display = "none";
          const footerBanner = document.querySelector('.box-banner-footer-desktop');
          if (footerBanner) {
            footerBanner.style.display = 'none';
            footerBanner.style.visibility = 'hidden';
          }
        }
      }`,
      width,
      height
    );

    await delay(2000);

    await driver.executeScript(`
      history.replaceState({}, "", location.origin + "/");
    `);

    await delay(1000);

    const filename = path.join(
      screenshotsDir,
      `${width}x${height}${kvPart}_${typeSuffix}.png`
    );

    await screenshot({ filename })
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
    if (driver) await driver.quit();
  }
};

export default takeScreenshotsService;
