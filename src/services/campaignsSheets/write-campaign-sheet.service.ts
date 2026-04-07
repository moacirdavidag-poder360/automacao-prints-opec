import { google } from "googleapis";
import logger from "../../config/logger.config.js";
import { getGoogleAuth } from "../googleDrive/google-drive-auth.service.js";

const SHEET_NAME = process.env.NOME_ABA_PLANILHA;

const writeCampaignsService = async (rawCampaigns: any[]) => {
  try {
    logger.info("[GoogleSheets] Iniciando escrita de campanhas");

    const auth = getGoogleAuth();
    const sheets = google.sheets({ version: "v4", auth });

    const spreadsheetId = process.env.PLANILHA_CAMPANHAS_ID as string;
    if (!spreadsheetId) throw new Error("PLANILHA_CAMPANHAS_ID não definido");

    const normalized = rawCampaigns;

    logger.debug("[GoogleSheets] Campanhas normalizadas", {
      total: normalized.length,
    });

    const getRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_NAME}!A1:I1000`,
    });

    const rows = (getRes.data.values || []).filter((row): row is string[] =>
      Array.isArray(row)
    );

    if (rows.length <= 1) {
      logger.info("[GoogleSheets] Planilha vazia detectada");

      const newRows = normalized
        .map((c) => [
          c.row[0],
          c.row[1],
          c.row[2],
          c.row[3],
          c.row[4],
          c.row[5],
          "",
          c.orderId,
          c.creativeId,
        ])
        .filter(
          (r): r is string[] =>
            Array.isArray(r) && r.every((cell) => typeof cell === "string")
        );

      if (!newRows.length) {
        logger.warn("[GoogleSheets] Nenhuma linha válida para inserir");
        return;
      }

      logger.info("[GoogleSheets] Inserindo dados", {
        totalLinhas: newRows.length,
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET_NAME}!A2`,
        valueInputOption: "RAW",
        requestBody: { values: newRows },
      });

      logger.info("[GoogleSheets] Dados inseridos com sucesso", {
        totalLinhas: newRows.length,
      });

      return;
    }

    const data = rows.slice(1);
    const existingKeys = new Set(
      data.map((row) => `${row[7]}|${row[8]}`)
    );

    logger.debug("[GoogleSheets] Chaves existentes", {
      quantidade: existingKeys.size,
    });

    const newRows = normalized
      .filter((c) => {
        const key = `${c.orderId}|${c.creativeId}`;
        const isDuplicate = existingKeys.has(key);

        if (isDuplicate) {
          logger.debug("[GoogleSheets] Campanha duplicada", {
            orderId: c.orderId,
            creativeId: c.creativeId,
          });
        }

        return !isDuplicate;
      })
      .map((c) => [
        c.row[0],
        c.row[1],
        c.row[2],
        c.row[3],
        c.row[4],
        c.row[5],
        "",
        c.orderId,
        c.creativeId,
      ])
      .filter(
        (r): r is string[] =>
          Array.isArray(r) && r.every((cell) => typeof cell === "string")
      );

    if (!newRows.length) {
      logger.info("[GoogleSheets] Nenhuma nova campanha para inserir", {
        normalizadas: normalized.length,
        existentes: data.length,
      });
      return;
    }

    const appendStartRow = data.length + 2;

    logger.info("[GoogleSheets] Inserindo novas linhas", {
      quantidade: newRows.length,
      startRow: appendStartRow,
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${SHEET_NAME}!A${appendStartRow}`,
      valueInputOption: "RAW",
      requestBody: { values: newRows },
    });

    logger.info("[GoogleSheets] Novas campanhas adicionadas com sucesso", {
      totalNovas: newRows.length,
      linhasAtuais: data.length + newRows.length,
    });
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack || "";
    const errorResponse = error?.response
      ? JSON.stringify(error.response.data || error.response, null, 2)
      : undefined;

    logger.error("[GoogleSheets] Erro ao escrever campanhas", {
      message: errorMessage,
      stack: errorStack,
      response: errorResponse,
    });

    throw error;
  }
};

export default writeCampaignsService;