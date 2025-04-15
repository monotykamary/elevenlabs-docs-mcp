FROM node:23-slim AS builder

RUN apt-get update && apt-get install -y git wget unzip && rm -rf /var/lib/apt/lists/*

RUN wget -O duckdb_cli.zip "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip" \
    && unzip duckdb_cli.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/duckdb \
    && rm duckdb_cli.zip

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci --ignore-scripts

COPY . .

RUN git submodule update --init --recursive

COPY etl ./etl

ENV PARQUET_OUTPUT_DIR=/app/data

RUN mkdir -p $PARQUET_OUTPUT_DIR && node etl/run-etl.mjs

RUN npm run build

FROM node:23-slim AS release

RUN apt-get update && apt-get install -y wget unzip && rm -rf /var/lib/apt/lists/* \
    && wget -O duckdb_cli.zip "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-linux-amd64.zip" \
    && unzip duckdb_cli.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/duckdb \
    && rm duckdb_cli.zip

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/data ./data

ENV NODE_ENV=production
ENV DATA_DIR=/app/data

RUN npm ci --omit=dev --ignore-scripts

ENTRYPOINT ["node", "dist/src/index.js"]
