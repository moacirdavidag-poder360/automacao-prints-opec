import fs from "fs";
import path from "path";
import csvParser from "csv-parser";

import { fileURLToPath } from "url";
import type {
  ICampaignsObjectType,
  ICampaignsSheetType,
} from "../../types/campaigns.type.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const readCampaignSheetService = async (): Promise<ICampaignsObjectType[]> => {
  const campaignData: ICampaignsSheetType[] = [];
  const filePath = path.resolve(__dirname, "opec_mar_2026.csv");

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => {
        campaignData.push(data);
      })
      .on("end", () => {
        const campaigns: ICampaignsObjectType[] = campaignData.map(
          (campaign) => {
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
          }
        );

        resolve(campaigns);
      })
      .on("error", reject);
  });
};

export default readCampaignSheetService;
