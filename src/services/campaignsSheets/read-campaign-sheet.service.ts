import { google } from "googleapis";
import { getGoogleAuth } from "../googleDrive/google-drive-auth.service.js";

import type {
  ICampaignsObjectType,
  ICampaignsSheetType,
} from "../../types/campaigns.type.js";
import { mapRowToObject } from "../../utils/functions.js";

const readCampaignSheetService = async (): Promise<ICampaignsObjectType[]> => {
  const SHEET_NAME = process.env.NOME_ABA_PLANILHA;
  const auth = getGoogleAuth();

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheetId = process.env.PLANILHA_CAMPANHAS_ID;
  const range = `${SHEET_NAME}!A1:Z1000`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = response.data.values ?? [];

  if (!rows.length) return [];

  const headers = rows[0] as string[];
  const data = rows.slice(1);

  const campaigns: ICampaignsObjectType[] = data.map((row) => {
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

  return campaigns;
};

export default readCampaignSheetService;
