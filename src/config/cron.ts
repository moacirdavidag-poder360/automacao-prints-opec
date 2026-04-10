import cron from "node-cron";
import logger from "./logger.config.js";
import takeDesktopScreenshotsService from "../services/screenshots/desktop-screenshot.service.js";
import takeMobileScreenshotsService from "../services/screenshots/mobile-screenshot.service.js";

import readCampaignSheetService from "../services/campaignsSheets/read-campaign-sheet.service.js";
import writeCampaignsService from "../services/campaignsSheets/write-campaign-sheet.service.js";
import getCampaignsService from "../services/campaigns/get-campaigns.service.js";

import type { ICampaignsObjectType } from "../types/campaigns.type.js";

import dotenv from "dotenv";
dotenv.config();


const normalizeCampaigns = (
  campaigns: ICampaignsObjectType[]
): ICampaignsObjectType[] => {
  const groups = new Map<string, ICampaignsObjectType[]>();

  for (const c of campaigns) {
    const key = `${c.customer}_${c.name}_${c.format.width}x${c.format.height}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(c);
  }

  const result: ICampaignsObjectType[] = [];

  for (const [, list] of groups) {
    const total = list.length;

    list.forEach((campaign, index) => {
      const kvIndex = index + 1;

      const type = campaign.format.type.toLowerCase();

      const isDesktop = type.includes("desktop");
      const isMobile = type.includes("mobile");
      const isInterno = type.includes("interno");

      const baseData: ICampaignsObjectType =
        total > 1
          ? {
              ...campaign,
              kvIndex,
              kvTotal: total,
            }
          : {
              ...campaign,
            };

      if (isDesktop && isMobile && isInterno) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Desktop" },
        });

        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Mobile" },
        });

        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Interno" },
        });

        return;
      }

      if (isDesktop && isMobile) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Desktop" },
        });

        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Mobile" },
        });

        return;
      }

      if (isMobile && isInterno) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Mobile" },
        });

        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Interno" },
        });

        return;
      }

      if (isDesktop && isInterno) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Desktop" },
        });

        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Interno" },
        });

        return;
      }

      if (isDesktop) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Desktop" },
        });
        return;
      }

      if (isMobile) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Mobile" },
        });
        return;
      }

      if (isInterno) {
        result.push({
          ...baseData,
          format: { ...campaign.format, type: "Interno" },
        });
        return;
      }

      result.push(baseData);
    });
  }

  return result;
};

let isRunning = false;

const setupCronPrints = () => {
  const CRON = process.env.BOT_CRON || '0 0 */3 * * *';
  cron.schedule(CRON, async () => {
    if (isRunning) {
      logger.warn("[CRON] Execução já em andamento, pulando...");
      return;
    }

    isRunning = true;

    try {
      logger.info("[CRON] Iniciando fluxo completo de campanhas");

      const campaignsFromDB = await getCampaignsService();

      logger.info(`[CRON] Campanhas vindas do banco: ${campaignsFromDB.length}`);

      await writeCampaignsService(campaignsFromDB);

      logger.info("[CRON] Planilha atualizada");

      const campaignsFromSheet = await readCampaignSheetService();

      logger.info("[CRON] Campanhas lidas da planilha", {
        total: campaignsFromSheet.length,
      });

      const normalizedCampaigns = normalizeCampaigns(campaignsFromSheet);

      logger.info("[CRON] Campanhas normalizadas para execução", {
        total: normalizedCampaigns.length,
      });

      for (const campaign of normalizedCampaigns) {
        const isMobile = campaign.format.type.toLowerCase() === "mobile";
        const isDesktop = campaign.format.type.toLowerCase() === "desktop";
        const isInterno = campaign.format.type.toLowerCase() === "interno";
        if (isMobile) {
          await takeMobileScreenshotsService(campaign);
        }
        if (isDesktop || isInterno) {
          await takeDesktopScreenshotsService(campaign);
        }
      }

      logger.info("[CRON] Execução finalizada com sucesso");
    } catch (error) {
      logger.error("[CRON] Erro na execução do fluxo", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    } finally {
      isRunning = false;
    }
  });
};

export default setupCronPrints;
