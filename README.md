# 🤖 PoderAds Bot

## 📌 Sobre o projeto

O **PoderAds Bot** é uma automação responsável por:

-   Ler campanhas de uma planilha do Google Sheets
-   Validar período de veiculação
-   Acessar previews de anúncios
-   Tirar screenshots (desktop e mobile)
-   Subir automaticamente para o Google Drive

------------------------------------------------------------------------

## ⚙️ Instalação

### 1. Clone o projeto

``` bash
git clone <repo>
cd <repo>
```

### 2. Instale as dependências

``` bash
npm install
```

------------------------------------------------------------------------

## 🔐 Variáveis de ambiente

Crie um `.env` baseado no `.env.example`

### 🧠 Ambiente

    NODE_ENV=development

------------------------------------------------------------------------

### ☁️ Google Drive

    ID_PASTA_GOOGLE_DRIVE=
    GOOGLE_CREDENTIALS_B64=

------------------------------------------------------------------------

### ⏱ Delay

    DELAY_PRINT_MS=1000

------------------------------------------------------------------------

### 🌐 Chrome / Selenium / Mobile

    GOOGLE_CHROME_PATH=
    GOOGLE_CHROME_PROFILE_PATH=
    GOOGLE_CHROME_PROFILE_PATH_MOBILE=
    GOOGLE_CHROME_EXTENSION_PATH=
    EXTENSION_TOGGLE_SHORTCUT=

#### 🔹 IMPORTANTE

-   `GOOGLE_CHROME_PROFILE_PATH`: perfil limpo (desktop)
-   `GOOGLE_CHROME_PROFILE_PATH_MOBILE`: perfil EXCLUSIVO para mobile
-   `GOOGLE_CHROME_EXTENSION_PATH`: extensão de simulação mobile

------------------------------------------------------------------------

### 📊 Planilha

    PLANILHA_CAMPANHAS_ID=
    NOME_ABA_PLANILHA=

------------------------------------------------------------------------

### 🗄 Banco

    MONGO_URI=

------------------------------------------------------------------------

### 📁 Downloads

    DOWNLOAD_PATH_DIR=

------------------------------------------------------------------------

### ⏲ Cron

    BOT_CRON=

Exemplo:

    0 */1 * * * *

------------------------------------------------------------------------

## 🧪 Scripts

``` json
"scripts": {
  "build": "tsc",
  "start": "node dist/index.js",
  "dev": "tsx watch index.ts",

  "pm2:start": "pm2 start ecosystem.config.cjs",
  "pm2:stop": "pm2 stop poderads-bot",
  "pm2:restart": "pm2 restart poderads-bot",
  "pm2:logs": "pm2 logs poderads-bot",
  "pm2:monit": "pm2 monit",
  "pm2:list": "pm2 list"
}
```

------------------------------------------------------------------------

## ▶️ Rodando o projeto

### Desenvolvimento

``` bash
npm run dev
```

### Produção

``` bash
npm run build
npm start
```

------------------------------------------------------------------------

## 🚀 PM2

### Start

``` bash
npm run pm2:start
```

### Logs

``` bash
npm run pm2:logs
```

------------------------------------------------------------------------

## 📱 Mobile

-   Usa Selenium + Chrome real
-   Ativa modo responsivo via atalho
-   Usa extensão instalada no perfil mobile

------------------------------------------------------------------------

## 💻 Desktop

-   Usa Playwright
-   Scroll inteligente
-   Oculta anúncios não alvo

------------------------------------------------------------------------

## 📁 Estrutura

    /services
    /screenshots
    /config
    /utils

------------------------------------------------------------------------

## 📌 Observações

-   Sempre atualizar planilha mensalmente
-   Garantir extensão instalada no perfil mobile
-   Garantir Chrome instalado corretamente

## Instalação da extensão do Mobile no perfil do Chrome mobile

- É necessário abrir pelo terminal / PowerShell o perfil do Chrome utilizado para prints mobile:

```PowerShell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="caminho que está instalado o perfil do Chrome mobile"
```
- Em seguida, é preciso instalar a extensão **Simulador de Dispositivo Móvel**:
``` 
google.com/search?q=simulador+de+dispositivo+movel&rlz=1C1VDKB_enBR1145BR1145&oq=simulador+de+dispo&gs_lcrp=EgZjaHJvbWUqBwgAEAAYgAQyBwgAEAAYgAQyBggBEEUYOTIICAIQABgWGB4yCAgDEAAYFhgeMggIBBAAGBYYHjIICAUQABgWGB4yCAgGEAAYFhgeMggIBxAAGBYYHjIICAgQABgWGB4yCAgJEAAYFhge0gEIMjkzOWowajeoAgCwAgA&sourceid=chrome&ie=UTF-8
```
- Após a instalação, ative a extensão nesse perfil do Chrome (normalmente, como é ativada no Chrome);
- Posteriormente, vá até *chrome://extensions* -> Atalhos do teclado -> encontre a extensão **Simulador de Dispositivo Móvel** e, na opção, "Ativar a Extensão", adicione um atalho do teclado - por exemplo, *Ctrl + Shift + M* - o importante é que esse atalho deve estar no .env:

```
EXTENSION_TOGGLE_SHORTCUT=ctrl+shift+m 
```
