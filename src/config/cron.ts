import cron from "node-cron";
import logger from "./logger.config.js";
import takeScreenshotsService from "../services/screenshots/take-screenshots.service.js";

const setupCronPrints = () => {
  cron.schedule("0 */1 * * * *", async () => {
    try {
      logger.info(
        "Serviço do cron que vai tirar prints do Poder360 no futuro iniciado e rodando! :D"
      );
      takeScreenshotsService();
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
