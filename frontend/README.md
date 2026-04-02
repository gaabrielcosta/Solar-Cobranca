# Solar Cobrança — ACELIVRE Energia Solar

Sistema de gestão de cobrança para energia solar compartilhada, desenvolvido para resolver um problema real de uma empresa do Mato Grosso do Sul.

A ACELIVRE distribui energia solar gerada em usinas próprias para clientes beneficiários (UCs). Este sistema automatiza todo o ciclo: leitura das faturas da Energisa MS, cálculo do rateio de kWh, geração de cobranças, extração de PIX dos boletos e envio de notificações via WhatsApp.

---

## Screenshots

### Login

![Login](docs/screenshots/00.png)

### Dashboard

![Dashboard — modo escuro](docs/screenshots/01_dark.png)
![Dashboard — modo claro](docs/screenshots/01_claro.png)

### Faturas

![Faturas — modo escuro](docs/screenshots/02_dark.png)
![Faturas — modo claro](docs/screenshots/02_claro.png)

### Clientes

![Clientes — modo escuro](docs/screenshots/03_dark.png)
![Clientes — modo claro](docs/screenshots/03_claro.png)

### Analytics

![Analytics — modo escuro](docs/screenshots/04_dark.png)
![Analytics — modo claro](docs/screenshots/04_claro.png)

---

## O problema que resolve

Empresas de energia solar compartilhada recebem mensalmente uma fatura da distribuidora (Energisa MS) por UC beneficiária. Processar essas faturas manualmente — extrair os kWh compensados, calcular o valor de cada cliente, gerar a cobrança e notificar — é um trabalho repetitivo e suscetível a erros.

O Solar Cobrança automatiza esse fluxo completo.

---

## Funcionalidades

- **Leitura automática de PDF** — extrai dados da fatura Energisa MS (UC, kWh compensados, tarifa, vencimento, CIP) usando `unpdf`
- **Extração de PIX copia e cola** — decodifica o QR Code do boleto Energisa usando `pdfjs-dist` + `canvas` + `jsQR`, sem depender de Ghostscript ou ImageMagick
- **Cálculo de rateio** — distribui os kWh gerados entre os beneficiários conforme percentual cadastrado
- **Geração de faturas** — cria cobranças individuais por UC com desconto configurável
- **Relatórios mensais em PDF** — gerados via Puppeteer com dados consolidados por usina
- **Bot WhatsApp** — régua de cobrança automática com avisos D-5, D0, D+1, D+3, D+7 e D+15 via Evolution API
- **Resposta automática** — cliente responde "PAGUEI" e o sistema registra o pagamento
- **Dashboard React** — interface moderna com tema claro/escuro, busca global, notificações em tempo real e analytics
- **Autenticação JWT** — implementada sem bibliotecas externas, usando `crypto` nativo do Node.js

---

## Stack

### Backend

| Camada            | Tecnologia                  |
| ----------------- | --------------------------- |
| Runtime           | Node.js 18+                 |
| Linguagem         | TypeScript                  |
| Framework         | Express                     |
| ORM               | TypeORM                     |
| Banco de dados    | PostgreSQL 14+              |
| PDF (leitura)     | unpdf                       |
| PDF (geração)     | Puppeteer                   |
| PIX (extração QR) | pdfjs-dist + canvas + jsQR  |
| WhatsApp          | Evolution API               |
| Testes            | Jest + ts-jest              |
| Documentação      | Swagger UI (OpenAPI 3.0)    |
| Deploy            | Oracle Cloud (VM ARM) + PM2 |

### Frontend

| Camada      | Tecnologia           |
| ----------- | -------------------- |
| Framework   | React 19 + Vite      |
| Linguagem   | TypeScript           |
| Estilização | Tailwind CSS v4      |
| Componentes | Shadcn/ui + Radix UI |
| Gráficos    | Recharts             |
| Roteamento  | React Router v7      |
| Tema        | Modo claro/escuro    |

---

## Arquitetura

```
├── src/                         # Backend (Node.js + TypeScript)
│   ├── main.ts                  # Entry point, Express, JWT, rotas
│   ├── swagger.ts               # Configuração OpenAPI
│   ├── database/
│   │   └── data-source.ts       # Conexão TypeORM + PostgreSQL
│   └── modules/
│       ├── faturas/             # Leitura de PDF, extração PIX, geração de faturas
│       ├── usinas/              # Usinas, beneficiários, rateio, créditos kWh
│       ├── clientes/            # Cadastro e importação de clientes
│       ├── bot/                 # Régua de cobrança, bot WhatsApp, webhooks
│       ├── logs/                # Auditoria de ações
│       └── pagamentos/          # Registro de pagamentos
│
└── frontend/                    # Frontend (React + Vite)
    └── src/
        ├── components/
        │   └── layout/          # DashboardLayout, Sidebar, ThemeProvider
        ├── pages/               # Dashboard, Faturas, Clientes, Usinas,
        │                        # Analytics, CreditosKwh, Logs, Bot, Upload
        └── hooks/               # useApi
```

---

## Como rodar localmente

### Pré-requisitos

- Node.js 18+
- PostgreSQL 14+

### Instalação

```bash
git clone https://github.com/gaabrielcosta/Solar-Cobranca.git
cd Solar-Cobranca
npm install
```

### Configuração

Cria um arquivo `.env` na raiz com:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/solar_cobranca
JWT_SECRET=sua_chave_secreta
JWT_EXPIRES_IN=8h
ADMIN_PASSWORD=sua_senha_admin
PORT=3000

# WhatsApp (opcional)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=
EVOLUTION_INSTANCE=

# PIX (opcional)
PIX_CHAVE=
```

### Banco de dados

```bash
npm run typeorm migration:run
```

### Desenvolvimento

Terminal 1 — backend:

```bash
npm run dev
```

Terminal 2 — frontend (com hot reload):

```bash
cd frontend
npm run dev
```

Acesse `http://localhost:5173`

### Build de produção

```bash
npm run build:full
```

O frontend é compilado e servido pelo Express em `http://localhost:3000`.

### Documentação da API

```
http://localhost:3000/api/docs
```

---

## Testes

```bash
npm test
```

38 testes passando. Cobertura: leitura de fatura Energisa MS, extração de PIX, parsing de demonstrativo de compensação, cálculo de créditos kWh e rateio entre beneficiários.

---

## Detalhe técnico — extração de PIX

A Energisa MS não disponibiliza o código PIX em texto no PDF — ele está embutido como QR Code na imagem do boleto. A extração funciona assim:

1. `pdfjs-dist` carrega o PDF e renderiza cada página em um canvas
2. `canvas` fornece os dados de pixel da imagem renderizada
3. `jsQR` decodifica o QR Code a partir dos pixels
4. O sistema valida se o resultado é um código EMV PIX (começa com `000201`)

Isso elimina a necessidade de Ghostscript, ImageMagick ou qualquer dependência externa de sistema operacional.

---

## Status

Sistema em produção com clientes reais — Mato Grosso do Sul, Brasil.
