import { google } from "googleapis";
import logger from "../../config/logger.config.js";

import dotenv from 'dotenv';
dotenv.config();

export const getGoogleAuth = () => {
  try {
    
    logger.info("[INFO - GoogleDrive] Iniciando autenticação...");

    const credentials = JSON.parse(
      Buffer.from(process.env.GOOGLE_CREDENTIALS_B64, 'base64').toString('utf-8')
    );

    const auth = new google.auth.GoogleAuth({
      credentials,
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
