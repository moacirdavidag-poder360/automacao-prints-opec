import { google } from "googleapis";
import fs from "fs";
import path from "path";
import dayjs from "dayjs";
import logger from "../../config/logger.config.js";
import { getGoogleAuth } from "./google-drive-auth.service.js";

import type {
  IFindOrCreateFolderParams,
  IUploadFileToDriveParams,
} from "../../types/google-drive.type.js";

import dotenv from "dotenv";
dotenv.config();

const findOrCreateFolder = async ({
  drive,
  name,
  parentId,
}: IFindOrCreateFolderParams): Promise<string> => {
  try {
    logger.info(`[GoogleDrive] Buscando pasta: ${name}`, {
      parentId,
    });

    const query = [
      `name='${name}'`,
      `mimeType='application/vnd.google-apps.folder'`,
      `trashed=false`,
      parentId ? `'${parentId}' in parents` : null,
    ]
      .filter(Boolean)
      .join(" and ");

    logger.debug(`[GoogleDrive] Query montada`, { query });

    const res = await drive.files.list({
      q: query,
      fields: "files(id, name)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    const files = res.data.files ?? [];

    logger.debug(`[GoogleDrive] Resultado da busca`, {
      total: files.length,
      files,
    });

    const folder = files[0];

    if (folder && folder.id) {
      logger.info(`[GoogleDrive] Pasta encontrada: ${name}`, {
        folderId: folder.id,
      });

      return folder.id;
    }

    logger.info(`[GoogleDrive] Criando pasta: ${name}`, {
      parentId,
    });

    const folderCreated = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: parentId ? [parentId] : null,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    if (!folderCreated.data.id) {
      throw new Error(`Erro ao criar pasta ${name}: ID não retornado`);
    }

    logger.info(`[GoogleDrive] Pasta criada: ${name}`, {
      folderId: folderCreated.data.id,
    });

    return folderCreated.data.id;
  } catch (error) {
    logger.error("[GoogleDrive] Erro ao buscar/criar pasta", {
      name,
      parentId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

export const uploadFileToDrive = async ({
  filePath,
  campaingName,
}: IUploadFileToDriveParams) => {
  try {
    logger.info(`[GoogleDrive] Iniciando upload`, {
      filePath,
      campaingName,
    });

    if (!fs.existsSync(filePath)) {
      throw new Error("Arquivo não encontrado para upload");
    }

    const stats = fs.statSync(filePath);

    logger.debug(`[GoogleDrive] Arquivo validado`, {
      size: stats.size,
      filePath,
    });

    const auth = getGoogleAuth();

    logger.debug(`[GoogleDrive] Auth obtido`);

    const drive = google.drive({ version: "v3", auth });

    logger.debug(`[GoogleDrive] Client Drive criado`);

    const today = dayjs().format("DD-MM-YYYY");

    const rootFolderId = process.env.ID_PASTA_GOOGLE_DRIVE as string;

    if (!rootFolderId) {
      throw new Error("ID_PASTA_GOOGLE_DRIVE não definido");
    }

    logger.debug(`[GoogleDrive] Variáveis`, {
      rootFolderId,
      today,
    });

    const poFolderId = await findOrCreateFolder({
      drive,
      name: campaingName,
      parentId: rootFolderId,
    });

    logger.debug(`[GoogleDrive] Pasta PO resolvida`, {
      poFolderId,
    });

    const dateFolderId = await findOrCreateFolder({
      drive,
      name: today,
      parentId: poFolderId,
    });

    if (!dateFolderId) {
      throw new Error("dateFolderId inválido");
    }

    logger.debug(`[GoogleDrive] Pasta data resolvida`, {
      dateFolderId,
    });

    const fileName = path.basename(filePath);

    logger.info(`[GoogleDrive] Enviando arquivo`, {
      fileName,
      destination: `${campaingName}/${today}`,
      folderId: dateFolderId,
    });

    const stream = fs.createReadStream(filePath);

    stream.on("error", (err) => {
      logger.error("[GoogleDrive] Erro no stream do arquivo", {
        error: err.message,
      });
    });

    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [dateFolderId],
      },
      media: {
        mimeType: "image/png",
        body: stream,
      },
      fields: "id",
      supportsAllDrives: true,
    });

    logger.debug(`[GoogleDrive] Resposta upload`, {
      data: response.data,
    });

    logger.info(`[GoogleDrive] Upload concluído`, {
      fileName,
      fileId: response.data.id,
    });

    return response.data;
  } catch (error) {
    console.error("ERRO BRUTO GOOGLE DRIVE:", JSON.stringify(error, null, 2));
    logger.error("[GoogleDrive] Erro no upload", {
      filePath,
      campaingName,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    throw error;
  }
};
