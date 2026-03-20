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
};
