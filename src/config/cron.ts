import cron from "node-cron";
import logger from "./logger.config.js";
import takeScreenshotsService from "../services/screenshots/take-screenshots.service.js";
import readCampaignSheetService from "../services/campaignsSheets/read-campaign-sheet.service.js";

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
      logger.info(
        "Serviço do cron que vai tirar prints do Poder360 no futuro iniciado e rodando! :D"
      );
      const campaigns = await readCampaignSheetService();
      const normalizedCampaigns = normalizeCampaigns(campaigns);

      for (const campaign of normalizedCampaigns) {
        await takeScreenshotsService(campaign);
      }
    } catch (error) {
      if (error instanceof Error) {
        logger.error(
          `Erro ao iniciar o cron de tirar prints: ${error.message}`
        );
      } else {
        logger.error("Erro ao iniciar o cron de tirar prints:", error);
      }
    }
  });
};

export default setupCronPrints;
