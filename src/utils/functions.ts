import logger from "../config/logger.config.js";

export const sanitize = (value: string) => value.replace(/[<>:"/\\|?*]+/g, "").trim();

export const delay = (ms: number) => new Promise(() => setTimeout(() => {
    logger.info(`[INFO] Esperando delay de ${ms} ms terminar...`)
}, ms));

