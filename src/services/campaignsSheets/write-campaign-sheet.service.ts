import { google } from "googleapis";
import logger from "../../config/logger.config.js";
import { getGoogleAuth } from "../googleDrive/google-drive-auth.service.js";

import type { ICampaignsObjectType } from "../../types/campaigns.type.js";
import { normalizeCampaigns } from "../../utils/functions.js";

const SHEET_NAME = "Página 1";

const buildRow = (c: ICampaignsObjectType): string[] => [
  c.customer ?? "",
  c.name ?? "",
  c.poNumber ?? "",
  c.startDate ?? "",
  c.endDate ?? "",
  `${c.format.width}x${c.format.height} - ${c.format.type}`,
];

const writeCampaignsService = async (rawCampaigns: any[]) => {
  try {
    logger.info("[GoogleSheets] Iniciando escrita de campanhas");

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.PLANILHA_CAMPANHAS_ID as string;

    if (!spreadsheetId) {
      throw new Error("PLANILHA_CAMPANHAS_ID não definido");
    }

    const normalized = normalizeCampaigns(rawCampaigns);

    logger.debug("[GoogleSheets] Campanhas normalizadas", {
      total: normalized.length,
    });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:Z1000`,
    });

    const rows = (getRes.data.values ?? []).filter((row): row is string[] =>
      Array.isArray(row)
    );

    if (!rows.length) {
      const newRows: string[][] = normalized.map(buildRow);

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: "RAW",
        requestBody: {
          values: newRows,
        },
      });

      logger.info("[GoogleSheets] Planilha criada do zero", {
        totalLinhas: newRows.length,
      });

      return;
    }

    const headers = rows[0] as string[];
    const data = rows.slice(1);

    let finalRows: string[][] = [...data].filter(Boolean);

    const groupedIncoming = normalized.reduce((acc, c) => {
        const customer = c.customer ?? "UNKNOWN";
      
        if (!acc[customer]) acc[customer] = [];
        acc[customer].push(c);
      
        return acc;
      }, {} as Record<string, ICampaignsObjectType[]>);

    Object.entries(groupedIncoming).forEach(([customer, campaigns]) => {
      const existingIndexes = finalRows
        .map((row, index) => ({ row, index }))
        .filter(({ row }) => row?.[0] === customer);

      if (!existingIndexes.length) {
        logger.info("[GoogleSheets] Novo cliente inserido", { customer });

        finalRows = [...finalRows, ...campaigns.map(buildRow)];
        return;
      }

      const lastIndex = existingIndexes[existingIndexes.length - 1]?.index ?? 0;

      const existingFormats = new Set(
        existingIndexes.map(({ row }) => row?.[5]).filter(Boolean)
      );

      const newRows = campaigns
        .map(buildRow)
        .filter((row) => !existingFormats.has(row[5]));

      if (!newRows.length) {
        logger.debug("[GoogleSheets] Nenhum novo formato", { customer });
        return;
      }

      logger.info("[GoogleSheets] Inserindo novos formatos no bloco", {
        customer,
        quantidade: newRows.length,
      });

      finalRows.splice(lastIndex + 1, 0, ...newRows);
    });

    const updateValues: string[][] = [headers, ...finalRows];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: updateValues,
      },
    });

    logger.info("[GoogleSheets] Planilha atualizada com sucesso", {
      totalLinhas: finalRows.length,
    });
  } catch (error) {
    logger.error("[GoogleSheets] Erro ao escrever campanhas", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
};

export default writeCampaignsService;
