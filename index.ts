import logger from "./src/config/logger.config.js";
import setupCronPrints from './src/config/cron.js';

logger.info('Aplicação rodando! :D')
console.log('Teste')

setupCronPrints();