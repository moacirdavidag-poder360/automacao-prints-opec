import logger from "../../config/logger.config.js";
import mongoose from "../../database/db.js";

import type { ICampaignDatabase } from "../../types/campaign-database.type.js";

const CampaignSchema = new mongoose.Schema(
  {},
  { strict: false, collection: "campanhas" }
);

const CampaignModel = mongoose.model("Campanhas", CampaignSchema);

interface IReadCampaignsParams {
  data_inicio: Date;
  data_fim: Date;
}

export const readCampaignsRepository = async ({
  data_inicio,
  data_fim,
}: IReadCampaignsParams): Promise<ICampaignDatabase[]> => {
  try {
    logger.info("[MongoDB] Buscando campanhas por período", {
      data_inicio,
      data_fim,
    });

    const campaigns = await CampaignModel.find({
      data_inicio_obj: { $lte: data_fim },
      data_fim_obj: { $gte: data_inicio },
    })
      .lean<ICampaignDatabase[]>()
      .exec();

    return campaigns;

  } catch (error) {
    logger.error("[MongoDB] Erro ao buscar campanhas", {
      data_inicio,
      data_fim,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
};
