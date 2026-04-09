import { Builder, WebDriver, By, WebElement } from "selenium-webdriver";
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
            logger.info(`[INFO] Anúncio encontrado dentro de iframe`);
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

        if (found) {
          logger.info(`[INFO] Anúncio encontrado no DOM principal`);
        }

        if (!found) {
          found = await findAdElement();
        }

        if (found) {
          logger.info(
            `[INFO] Anúncio ${width}x${height} localizado com sucesso`
          );
          return true;
        }

        logger.warn(
          `[WAIT] Anúncio ainda não encontrado, tentando novamente...`
        );

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

    logger.info(`[INFO] Iniciando fluxo da extensão para captura`);

    await driver!.switchTo().defaultContent();
    logger.info(`[INFO] Contexto resetado para página principal`);

    const clickWhenVisible = async (by: any, label: string) => {
      const el = (await driver!.wait(async () => {
        try {
          const element = await driver!.findElement(by);
          const visible = await element.isDisplayed();
          return visible ? element : null;
        } catch {
          return null;
        }
      }, 15000)) as WebElement;

      await el.click();
      logger.info(`[INFO] Clique realizado: ${label}`);
      await delay(1500);
    };

    await clickWhenVisible(By.css("button.icon-photo"), "botão abrir captura");

    await clickWhenVisible(
      By.xpath("//input[@value='without-frame']/ancestor::label"),
      "seleção device sem mockup"
    );

    await clickWhenVisible(
      By.xpath("//button[.//span[text()='Gerar uma captura']]"),
      "gerar captura"
    );

    await clickWhenVisible(
      By.xpath(
        "(//div[contains(@class,'actions')]//a[contains(@download,'.png')])[1]"
      ),
      "download PNG"
    );

    logger.info(`Print mobile tirado com a extensão!`);

    const DOWNLOAD_PATH_DIR = process.env.DOWNLOAD_PATH_DIR as string;

    const originalFileName = "iPhone-13-PRO-www.poder360.com.br.png";

    const sourcePath = path.join(DOWNLOAD_PATH_DIR, originalFileName);

    const finalFilename = `${width}x${height}${kvPart}_${typeSuffix}.png`;

    const destinationPath = path.join(screenshotsDir, finalFilename);

    const waitForDownload = async (filePath: string, timeout = 15000) => {
      const start = Date.now();

      while (Date.now() - start < timeout) {
        if (fs.existsSync(filePath)) {
          return true;
        }
        await delay(500);
      }

      return false;
    };

    const downloaded = await waitForDownload(sourcePath);

    if (!downloaded) {
      throw new Error(
        "Arquivo de print mobile não encontrado na pasta de Downloads"
      );
    }

    fs.copyFileSync(sourcePath, destinationPath);
    fs.unlinkSync(sourcePath);

    logger.info(`[INFO] Arquivo movido para: ${destinationPath}`);

    await uploadFileToDrive({
      filePath: destinationPath,
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
