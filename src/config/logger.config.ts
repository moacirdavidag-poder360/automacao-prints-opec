import winston from "winston";
import path from "node:path";
import fs from "node:fs";

const logDir = path.resolve(process.cwd(), "logs");

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

console.log('Teste')

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    http: 2,
    info: 3,
    debug: 4,
  },
};

const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level}]: ${message}`;
  })
);

const logger = winston.createLogger({
  levels: customLevels.levels,

  level: "debug",

  format,

  transports: [
    new winston.transports.Console(),

    new winston.transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
    }),

    new winston.transports.File({
      filename: path.join(logDir, "warn.log"),
      level: "warn",
    }),

    new winston.transports.File({
      filename: path.join(logDir, "http.log"),
      level: "http",
    }),

    new winston.transports.File({
      filename: path.join(logDir, "info.log"),
      level: "info",
    }),
  ],
});

export default logger;
