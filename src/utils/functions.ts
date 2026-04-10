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

        let width = sizeMatch?.[1] ?? "";
        let height = sizeMatch?.[2] ?? "";

        if (!width || !height) {
          width = String(creative.size?.width ?? "");
          height = String(creative.size?.height ?? "");
        }

        const size = width && height ? `${width}x${height}` : "";

        let types: string[] = [];

        if (name.includes("desktop e mobile")) {
          types = ["Desktop", "Mobile"];
        } else if (name.includes("mobile")) {
          types = ["Mobile"];
        } else if (name.includes("desktop")) {
          types = ["Desktop"];
        } else {
          if (width === "300" && height === "250") {
            types = ["Mobile", "Interno"];
          } else if (width === "300" && height === "600") {
            types = ["Mobile", "Desktop"];
          } else if (width === "300" && height === "1050") {
            types = ["Interno"];
          } else if (
            (width === "320" && height === "50") ||
            (width === "320" && height === "100")
          ) {
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
              size ? `${size} - ${type}` : "",
            ],
          });
        });
      });
    });
  });

  console.log("[normalizeCampaigns] Retornando", result.length, "linhas");

  return result;
};

export const batchWriteSheets = async (
  sheetsWriteFn: (values: any[][]) => Promise<void>,
  allValues: any[][],
  batchSize = 50,
  waitMs = 1000
) => {
  for (let i = 0; i < allValues.length; i += batchSize) {
    const batch = allValues.slice(i, i + batchSize);
    logger.info(`[GoogleSheets] Escrevendo batch ${i / batchSize + 1} de ${Math.ceil(allValues.length / batchSize)}`);
    await sheetsWriteFn(batch);
    if (i + batchSize < allValues.length) {
      await delay(waitMs);
    }
  }
};

export const batchReadSheets = async (
  sheetsReadFn: (range: string) => Promise<any[][]>,
  ranges: string[],
  waitMs = 1000
) => {
  const results: any[][] = [];
  for (let i = 0; i < ranges.length; i++) {
    const batchResult = await sheetsReadFn(ranges[i]!);
    results.push(...batchResult);
    if (i + 1 < ranges.length) {
      await delay(waitMs);
    }
  }
  return results;
};