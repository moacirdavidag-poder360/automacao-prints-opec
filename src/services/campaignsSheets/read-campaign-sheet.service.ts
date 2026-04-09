import { google } from "googleapis";
import { getGoogleAuth } from "../googleDrive/google-drive-auth.service.js";

import type {
  ICampaignsObjectType,
  ICampaignsSheetType,
} from "../../types/campaigns.type.js";
import { mapRowToObject, delay } from "../../utils/functions.js";
import logger from "../../config/logger.config.js";

const BATCH_SIZE = 100;
const BATCH_DELAY = 8000;

const readCampaignSheetService = async (): Promise<ICampaignsObjectType[]> => {
  const SHEET_NAME = process.env.NOME_ABA_PLANILHA;
  const spreadsheetId = process.env.PLANILHA_CAMPANHAS_ID as string;

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  logger.info("[Sheets] Iniciando leitura da planilha");

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_NAME}!A1:Z1`,
  });

  const headers = headerRes.data.values?.[0] as string[];

  if (!headers || !headers.length) {
    logger.warn("[Sheets] Nenhum header encontrado");
    return [];
  }

  logger.info("[Sheets] Headers carregados");

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  const sheet = meta.data.sheets?.find(
    (s) => s.properties?.title === SHEET_NAME
  );

  const totalRows = sheet?.properties?.gridProperties?.rowCount || 0;

  logger.info("[Sheets] Total de linhas detectadas", { totalRows });

  const campaigns: ICampaignsObjectType[] = [];

  let startRow = 2;

  while (startRow <= totalRows) {
    const endRow = startRow + BATCH_SIZE - 1;

    const range = `${SHEET_NAME}!A${startRow}:Z${endRow}`;

    logger.info("[Sheets] Lendo lote", { startRow, endRow });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    const rows = response.data.values ?? [];

    if (!rows.length) {
      logger.warn("[Sheets] Nenhum dado encontrado no lote", {
        startRow,
        endRow,
      });
      break;
    }

    const parsed = rows.map((row) => {
      const campaign = mapRowToObject<ICampaignsSheetType>(headers, row);

      const rawFormat = campaign["Formato (s)"] || "";

      const [sizePart, typePart] = rawFormat.split(" - ");

      const [width, height] = (sizePart || "")
        .split("x")
        .map((value) => value.trim());

      return {
        customer: campaign.Cliente,
        name: campaign["Nome da campanha"],
        format: {
          width: width || "",
          height: height || "",
          type: typePart?.trim() || "",
        },
        startDate: campaign["Data de início veiculação"],
        endDate: campaign["Data de término veiculação"],
        poNumber: campaign["Número PI/PO"],
        previewLink: campaign["Link de Preview"],
      };
    });

    campaigns.push(...parsed);

    logger.info("[Sheets] Lote processado", {
      quantidade: parsed.length,
      acumulado: campaigns.length,
    });

    startRow += BATCH_SIZE;

    if (startRow <= totalRows) {
      logger.warn("[Sheets] Aguardando próximo lote", {
        delay: BATCH_DELAY,
      });
      await delay(BATCH_DELAY);
    }
  }

  logger.info("[Sheets] Leitura finalizada", {
    total: campaigns.length,
  });

  return campaigns;
};

export default readCampaignSheetService;
