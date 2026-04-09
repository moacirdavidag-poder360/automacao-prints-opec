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

const takeMobileScreenshotsService = async (campaign: ICampaignsObjectType) => {
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

    const options = new chrome.Options();

    if (executablePath) {
      options.setChromeBinaryPath(executablePath);
    }

    options.addArguments(
      "--start-maximized",
      `--user-data-dir=${userDataPath}`,
      "--profile-directory=Default",
      "--no-sandbox",
      "--disable-dev-shm-usage"
    );

    options.addArguments("--homepage=about:blank");
    options.addArguments("--no-first-run");
    options.addArguments("--restore-last-session=false");

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

      await delay(3000);

      await driver.executeScript(`
        return new Promise((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve(true);
            });
          });
        });
      `);
    }

    await delay(2000);

    const iframe = await driver.findElement({
      css: "iframe[name='simulator']",
    });
    await driver.switchTo().frame(iframe);

    const html = await driver.getPageSource();

    const tmpFilePath = path.resolve(process.cwd(), "tmp.html");
    fs.writeFileSync(tmpFilePath, html, "utf-8");

    logger.info(`[INFO] HTML da página salvo em: ${tmpFilePath}`);

    const findAdElement = async () => {
      const frames = await driver!.findElements({ css: "iframe" });

      for (const frame of frames) {
        try {
          await driver!.switchTo().frame(frame);

          const found = await driver!.executeScript(
            `
              const el = Array.from(document.querySelectorAll('*')).find(el => {
                const rect = el.getBoundingClientRect();
                return rect.width === arguments[0] && rect.height === arguments[1];
              });
              return el || null;
            `,
            width,
            height
          );

          if (found) {
            return true;
          }

          await driver!.switchTo().parentFrame();
        } catch {
          await driver!.switchTo().parentFrame();
        }
      }

      return false;
    };

    const waitForAd = async () => {
      const start = Date.now();

      while (Date.now() - start < 20000) {
        let found = await driver!.executeScript(`
            return Array.from(document.querySelectorAll('*')).some(el => {
              const rect = el.getBoundingClientRect();
              return rect.width === ${width} && rect.height === ${height};
            });
          `);

        if (!found) {
          found = await findAdElement();
        }

        if (found) return true;

        robot.scrollMouse(0, -400);
        await delay(700);
      }

      return false;
    };

    const found = await waitForAd();

    if (!found) {
      logger.error(
        `[ERRO] Anúncio ${width}x${height} não encontrado após espera`
      );
      return;
    }

    await driver.executeScript(
      `
        function findAd(win) {
          try {
            const el = Array.from(win.document.querySelectorAll('*')).find(el => {
              const rect = el.getBoundingClientRect();
              return rect.width === arguments[0] && rect.height === arguments[1];
            });
      
            if (el) return { el, win };
      
            const iframes = win.document.querySelectorAll("iframe");
      
            for (const iframe of iframes) {
              try {
                if (iframe.contentWindow) {
                  const result = findAd(iframe.contentWindow);
                  if (result) return result;
                }
              } catch {}
            }
          } catch {}
      
          return null;
        }
      
        const result = findAd(window);
      
        if (result && result.el) {
          const el = result.el;
      
          el.scrollIntoView({ block: 'center' });
          el.setAttribute('data-target-ad', 'true');
      
          let parent = el.parentElement;
          while (parent) {
            parent.setAttribute('data-target-ad', 'true');
            parent = parent.parentElement;
          }
      
          const hide = (el) => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
          };
      
          result.win.document.querySelectorAll('*').forEach(el => {
            if (!el.closest('[data-target-ad="true"]')) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                hide(el);
              }
            }
          });
        }
        `,
      width,
      height
    );

    await delay(1500);

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

export default takeMobileScreenshotsService;
