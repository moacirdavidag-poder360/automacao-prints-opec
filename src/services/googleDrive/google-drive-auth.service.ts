import { google } from "googleapis";
import path from "path";
import logger from "../../config/logger.config.js";

import dotenv from 'dotenv';
dotenv.config();

export const getGoogleAuth = () => {
  try {
    
    logger.info("[INFO - GoogleDrive] Iniciando autenticação...");

    const keyFilePath = path.resolve(
      process.cwd(),
      process.env.PATH_ARQUIVO_AUTH_GOOGLE_CLOUD
    );
    
    const auth = new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes: ["https://www.googleapis.com/auth/drive"],
    });

    logger.info("[INFO - GoogleDrive] Autenticação configurada com sucesso");

    return auth;
  } catch (error) {
    logger.error("[INFO - GoogleDrive] Erro ao configurar autenticação", {
      error,
    });

    throw error;
  }
};
