import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import isBetween from "dayjs/plugin/isBetween.js";

import logger from "../../config/logger.config.js";
import { normalizeCampaigns } from "../../utils/functions.js";

import type { ICampaignsObjectType } from "../../types/campaigns.type.js";
import { readCampaignsRepository } from "../../repository/campaigns/read-campaigns.repository.js";

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

const getCampaignsService = async (): Promise<ICampaignsObjectType[]> => {
  try {
    logger.info("[Campaigns] Iniciando busca de campanhas");

    const TODAY_DATE = dayjs();

    const startDateObject = TODAY_DATE.startOf("month");
    const endDateObject = TODAY_DATE.endOf("month");

    logger.debug("[Campaigns] Período definido", {
      data_inicio: startDateObject.toDate(),
      data_fim: endDateObject.toDate(),
    });

    const campaigns = await readCampaignsRepository({
      data_inicio: startDateObject.toDate(),
      data_fim: endDateObject.toDate(),
    });

    logger.info("[Campaigns] Campanhas recebidas do repository", {
      total: campaigns.length,
    });

    const normalizedCampaigns = normalizeCampaigns(campaigns);

    logger.info("[Campaigns] Campanhas normalizadas", {
      total: normalizedCampaigns.length,
    });

    return normalizedCampaigns;
  } catch (error) {
    logger.error("[Campaigns] Erro ao buscar campanhas", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
};

export default getCampaignsService;
