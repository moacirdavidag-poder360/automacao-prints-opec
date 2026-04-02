import fs from "fs";
import logger from "../config/logger.config.js";
import type { ICampaignsObjectType } from "../types/campaigns.type.js";

export const sanitize = (value: string) =>
  value.replace(/[<>:"/\\|?*]+/g, "").trim();

export const delay = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(() => {
      logger.info(`[INFO] Esperando delay de ${ms} ms terminar...`);
      resolve();
    }, ms)
  );

export const getKvSuffix = (
  dir: string,
  width: string,
  height: string,
  typeSuffix: string
) => {
  if (!fs.existsSync(dir)) return "";

  const files = fs.readdirSync(dir);

  const base = `${width}x${height}`;

  const sameFiles = files.filter(
    (f) => f.startsWith(`${base}`) && f.includes(`_${typeSuffix}`)
  );

  if (sameFiles.length === 0) return "";

  return `_KV${sameFiles.length + 1}`;
};

export function mapRowToObject<T extends Record<string, any>>(
  headers: string[],
  row: string[]
): T {
  const obj = {} as T;

  headers.forEach((header, index) => {
    obj[header as keyof T] = (row[index] ?? "") as any;
  });

  return obj;
}

export const normalizeCampaigns = (campaigns: any[]): ICampaignsObjectType[] => {
  const result: ICampaignsObjectType[] = [];

  campaigns.forEach((campaign) => {
    const baseName = campaign.order_nome;
    const customer = campaign.nome_agencia;
    const startDate = campaign.data_inicio_str;
    const endDate = campaign.data_fim_str;
    const poNumber = campaign.poNumber;

    campaign.itens_linha?.forEach((item: any) => {
      item.criativos?.forEach((creative: any) => {
        const width = String(creative.size?.width ?? "");
        const height = String(creative.size?.height ?? "");

        let type = "Desktop";

        if (width === "320") type = "Mobile";

        result.push({
          customer,
          name: baseName,
          format: { width, height, type },
          startDate,
          endDate,
          poNumber,
          previewLink: "",
        });
      });
    });
  });

  return result;
};