import cron from "node-cron";
import logger from "./logger.config.js";

const setupCronPrints = () => {
  cron.schedule("0 */5 * * * *", async () => {
    try {
      logger.info(
        "Serviço do cron que vai tirar prints do Poder360 no futuro iniciado e rodando! :D"
      );
    } catch (error) {
      if (error instanceof Error) {
        logger.error(`Erro ao iniciar o cron de tirar prints: ${error.message}`);
      } else {
        logger.error("Erro ao iniciar o cron de tirar prints:", error);
      }
    }
  });
};

export default setupCronPrints;
