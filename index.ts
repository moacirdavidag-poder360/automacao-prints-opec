import logger from "./src/config/logger.config.js";
import setupCronPrints from "./src/config/cron.js";
import { connectDatabase } from "./src/database/db.js";

logger.info("Aplicação rodando! :D");
console.log("Teste");
connectDatabase();

setupCronPrints();
