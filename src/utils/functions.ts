import fs from "fs";
import logger from "../config/logger.config.js";

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

export const formatDate = (date: string) => {
  if (!date) return "";

  const [day, month, year] = date.split("/");
  return `${day?.padStart(2, "0") ?? ""}/${month?.padStart(2, "0") ?? ""}/${
    year ?? ""
  }`;
};

export const normalizeCampaigns = (campaigns: any[]) => {
  const result: any[] = [];

  console.log("[normalizeCampaigns] Recebeu", campaigns.length, "campanhas");

  campaigns.forEach((campaign, idx) => {
    console.log(`[normalizeCampaigns] Campanha ${idx}:`, {
      temItensLinha: !!campaign.itens_linha,
      lengthItensLinha: campaign.itens_linha?.length ?? "undefined",
      nome_agencia: campaign.nome_agencia,
    });

    const orderId = String(
      campaign.order_id?.$numberLong ?? campaign.order_id ?? ""
    );
    const customer = campaign.nome_agencia ?? "";
    const nameOrder = campaign.order_nome ?? "";
    const startDate = formatDate(campaign.data_inicio_str ?? "");
    const endDate = formatDate(campaign.data_fim_str ?? "");
    const poNumber = campaign.poNumber ?? "";

    campaign.itens_linha?.forEach((item: any, itemIdx: number) => {
      console.log(
        `[normalizeCampaigns] Campanha ${idx}, item ${itemIdx}:`,
        item.criativos?.length ?? 0,
        "criativos"
      );

      item.criativos?.forEach((creative: any) => {
        const creativeId = String(
          creative.creative_id?.$numberLong ?? creative.creative_id ?? ""
        );

        const rawName = creative.creative_name ?? "";
        const name = rawName.toLowerCase();

        const sizeMatch = rawName.match(/(\d+)x(\d+)/i);

        const width = sizeMatch?.[1] ?? "";
        const height = sizeMatch?.[2] ?? "";

        let types: string[] = [];

        if (name.includes("desktop e mobile")) {
          types = ["Desktop", "Mobile"];
        } else if (name.includes("mobile")) {
          types = ["Mobile"];
        } else if (name.includes("desktop")) {
          types = ["Desktop"];
        } else {
          if (width === "320" || width === "300") {
            types = ["Mobile"];
          } else if (width) {
            types = ["Desktop"];
          } else {
            types = ["Desktop"];
          }
        }

        types.forEach((type) => {
          result.push({
            orderId,
            creativeId,
            row: [
              customer,
              nameOrder,
              poNumber,
              startDate,
              endDate,
              width && height ? `${width}x${height} - ${type}` : "",
            ],
          });
        });
      });
    });
  });

  console.log("[normalizeCampaigns] Retornando", result.length, "linhas");

  return result;
};