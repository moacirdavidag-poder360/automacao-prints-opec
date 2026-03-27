import dotenv from "dotenv";
import logger from "./logger.config.js";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];

  if (value === undefined || value === "") {
    logger.error(`❌ Variável de ambiente obrigatória faltando: ${name}`);
    process.exit(1);
  }

  return value;
}

export const ENV_VARS = {
  NODE_ENV: required("NODE_ENV"),
  PORT: required("PORT"),
  ID_PASTA_GOOGLE_DRIVE: require('ID_PASTA_GOOGLE_DRIVE'),
  PATH_ARQUIVO_AUTH_GOOGLE_CLOUD: require('PATH_ARQUIVO_AUTH_GOOGLE_CLOUD'),
  DELAY_PRINT_MS: require('DELAY_PRINT_MS'),
  GOOGLE_CHROME_PATH: require('GOOGLE_CHROME_PATH'),
  GOOGLE_CHROME_PROFILE_PATH: require('GOOGLE_CHROME_PROFILE_PATH'),
  GOOGLE_CHROME_PROFILE_PATH_MOBILE: require('GOOGLE_CHROME_PROFILE_PATH_MOBILE'),
  GOOGLE_CHROME_EXTENSION_PATH: require('GOOGLE_CHROME_EXTENSION_PATH'),
  EXTENSION_TOGGLE_SHORTCUT: require('EXTENSION_TOGGLE_SHORTCUT')
};
