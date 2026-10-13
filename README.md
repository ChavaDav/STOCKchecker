# 📈 STOCKchecker

A web application to look up and follow stocks and ETFs, featuring ticker autocomplete, a custom API with JWT authentication, and simple deployment through Docker Compose.

## ✨ Features

- Stock and ETF search with local suggestions (up to 8 results per query).
- Ticker dictionary covering **NASDAQ** and **NYSE**, plus popular ETFs and European-listed funds (VUSA, VWCE, IWDA, SPY, QQQ, VOO, VTI, ARKK…).
- Standalone REST API with **JWT** authentication (access and refresh tokens).
- Persistent database stored in a Docker volume.
- Healthchecks on both containers.
- Full stack startup with a single command.

## 🧱 Project Structure

```
STOCKchecker/
├── stock-api/          # Backend (REST API)
├── stock-frontend/     # Frontend (web UI)
├── docker-compose.yml  # Service orchestration
└── fetch_tickers.py    # Script that generates the ticker dictionary for the frontend
```

## 🛠️ Tech Stack

- **Backend:** Node.js, file-based database (`stock-api.db`), JWT authentication
- **Frontend:** web app served from a container (internal port 80)
- **Infrastructure:** Docker and Docker Compose
- **Tooling:** Python 3 (standard library only) to generate the ticker list

## 🚀 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- (Optional) Python 3 to regenerate the ticker dictionary

### Installation

```bash
git clone https://github.com/ChavaDav/STOCKchecker.git
cd STOCKchecker
docker compose up --build -d
```

### Endpoints

| Service    | URL                              |
|------------|----------------------------------|
| Frontend   | http://localhost:5173            |
| API        | http://localhost:3001            |
| API health | http://localhost:3001/api/health |

## ⚙️ Configuration

The API is configured through environment variables defined in `docker-compose.yml`:

| Variable             | Description                        | Default                     |
|----------------------|------------------------------------|-----------------------------|
| `NODE_ENV`           | Runtime environment                | `production`                |
| `PORT`               | Internal API port                  | `3000`                      |
| `DB_PATH`            | Database file path                 | `/app/data/stock-api.db`    |
| `CORS_ORIGIN`        | Origin allowed by CORS             | `http://localhost:5173`     |
| `JWT_ACCESS_SECRET`  | Secret used to sign access tokens  | *(demo value)*              |
| `JWT_REFRESH_SECRET` | Secret used to sign refresh tokens | *(demo value)*              |

> ⚠️ **Security:** the JWT secrets in `docker-compose.yml` are demo values. **Do not use them in production.** Move them to a `.env` file (excluded from version control) or a secrets manager, and generate new random values, for example with `openssl rand -hex 32`.

## 🔄 Updating the Ticker Dictionary

`fetch_tickers.py` downloads the NASDAQ and NYSE listings, adds a selection of ETFs and European-listed funds, removes duplicates, and generates the `stockDictionary.js` file used by the frontend for autocomplete.

```bash
python fetch_tickers.py
```
## 🩺 Healthchecks

- **API:** `GET /api/health`, checked every 30 s with `curl`.
- **Frontend:** HTTP request to port 80 inside the container, checked every 30 s with `wget`.
- The frontend only starts once the API reports a *healthy* status.
