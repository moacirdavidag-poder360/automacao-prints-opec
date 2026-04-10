declare namespace NodeJS {
  interface ProcessEnv {
    GOOGLE_CREDENTIALS_B64: string;
    ID_PASTA_GOOGLE_DRIVE: string;
    DELAY_PRINT_MS: string | number;
    GOOGLE_CHROME_PATH: string;
    GOOGLE_CHROME_PROFILE_PATH: string;
    GOOGLE_CHROME_PROFILE_PATH_MOBILE: string;
    GOOGLE_CHROME_EXTENSION_PATH: string;
    EXTENSION_TOGGLE_SHORTCUT: string;
    PLANILHA_CAMPANHAS_ID: string;
    MONGO_URI: string;
    MONGO_DB_NAME: string;
    NOME_ABA_PLANILHA: string;
    DOWNLOAD_PATH_DIR: string;
    BOT_CRON: string;
  }
}
