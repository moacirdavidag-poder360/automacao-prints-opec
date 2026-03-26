import fs from "fs";
import logger from "../config/logger.config.js";

export const sanitize = (value: string) =>
  value.replace(/[<>:"/\\|?*]+/g, "").trim();

export const delay = (ms: number) =>
  new Promise<void>((resolve) =>
    setTimeout(() => {
      logger.info(`[INFO] Esperando delay de ${ms} ms terminar...`);
      resolve();
    }, ms)
  );

export const getKvSuffix = (
  dir: string,
  width: string,
  height: string,
  typeSuffix: string
) => {
  if (!fs.existsSync(dir)) return "";

  const files = fs.readdirSync(dir);

  const base = `${width}x${height}`;

  const sameFiles = files.filter(
    (f) => f.startsWith(`${base}`) && f.includes(`_${typeSuffix}`)
  );

  if (sameFiles.length === 0) return "";

  return `_KV${sameFiles.length + 1}`;
};
