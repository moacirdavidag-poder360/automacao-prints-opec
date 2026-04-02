import cron from "node-cron";
import logger from "./logger.config.js";

import takeScreenshotsService from "../services/screenshots/take-screenshots.service.js";
import readCampaignSheetService from "../services/campaignsSheets/read-campaign-sheet.service.js";
import writeCampaignsService from "../services/campaignsSheets/write-campaign-sheet.service.js";
import getCampaignsService from "../services/campaigns/get-campaigns.service.js";

import type { ICampaignsObjectType } from "../types/campaigns.type.js";

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

      result.push(baseData);
    });
  }

  return result;
};

const setupCronPrints = () => {
  cron.schedule("0 */1 * * * *", async () => {
    try {
      logger.info("[CRON] Iniciando fluxo completo de campanhas");

      const campaignsFromDB = await getCampaignsService();

      logger.info("[CRON] Campanhas vindas do banco", {
        total: campaignsFromDB.length,
      });

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
        await takeScreenshotsService(campaign);
      }

      logger.info("[CRON] Execução finalizada com sucesso");
    } catch (error) {
      logger.error("[CRON] Erro na execução do fluxo", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  });
};

export default setupCronPrints;
