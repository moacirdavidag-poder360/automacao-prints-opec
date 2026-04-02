import mongoose from "mongoose";
import logger from "../config/logger.config.js";

const MONGO_URI =
  process.env.MONGO_URI;

export const connectDatabase = async () => {
  try {
    logger.info("[MongoDB] Iniciando conexão");

    await mongoose.connect(MONGO_URI);

    logger.info("[MongoDB] Conectado com sucesso");
  } catch (error) {
    logger.error("[MongoDB] Erro ao conectar", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    process.exit(1);
  }
};

export default mongoose;
