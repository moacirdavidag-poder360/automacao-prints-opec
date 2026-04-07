import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";
import isBetween from "dayjs/plugin/isBetween.js";
import utc from "dayjs/plugin/utc.js";
dayjs.extend(utc);

import logger from "../../config/logger.config.js";
import { normalizeCampaigns } from "../../utils/functions.js";

import type { ICampaignsObjectType } from "../../types/campaigns.type.js";
import { readCampaignsRepository } from "../../repository/campaigns/read-campaigns.repository.js";

dayjs.extend(customParseFormat);
dayjs.extend(isBetween);

const getCampaignsService = async (): Promise<ICampaignsObjectType[]> => {
  try {
    logger.info("[Campaigns] Iniciando busca de campanhas");

    const startDateObject = dayjs().utc().startOf("month").toDate();
    const endDateObject = dayjs().utc().endOf("month").toDate();

    logger.debug(
      `[Campaigns] Período definido: ${startDateObject} à ${endDateObject}`
    );

    const campaigns = await readCampaignsRepository({
      data_inicio: startDateObject,
      data_fim: endDateObject,
    });

    logger.info(
      `[Campaigns] Campanhas recebidas do repository: ${campaigns.length}`
    );

    const normalizedCampaigns = normalizeCampaigns(campaigns);

    logger.info(
      `[Campaigns] Campanhas normalizadas: ${normalizedCampaigns.length}`
    );

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
