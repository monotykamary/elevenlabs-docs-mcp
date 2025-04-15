FROM node:23-alpine AS builder

# Install git for submodules and curl for installing DuckDB
RUN apk add --no-cache git curl

# Install DuckDB CLI (latest) using official install script
RUN curl https://install.duckdb.org | sh

WORKDIR /app

# Copy package files first
COPY package.json package-lock.json* ./

# Disable prepare script during npm ci to prevent premature build
# This installs all dependencies, including dev and ETL deps
RUN npm ci --ignore-scripts

# Copy the rest of the project files (including submodule definition)
COPY . .

# Initialize and update the documentation submodule
RUN git submodule update --init --recursive

# Copy ETL scripts
COPY etl ./etl

# Define output directory for Parquet files
ENV PARQUET_OUTPUT_DIR=/app/data

# Run the ETL process to generate Parquet files
# Ensure output directory exists before running
RUN mkdir -p $PARQUET_OUTPUT_DIR && node etl/run-etl.mjs

# Now explicitly run the application build
RUN npm run build


# --- Release Stage ---
FROM node:23-alpine AS release

# Install curl and DuckDB CLI (latest) in release image
RUN apk add --no-cache curl \
    && curl https://install.duckdb.org | sh

WORKDIR /app

# Copy only necessary artifacts from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json* ./package-lock.json # Handle potential lock file variations
COPY --from=builder /app/data ./data # Copy the generated Parquet files
COPY --from=builder /app/elevenlabs-docs ./elevenlabs-docs # Copy the raw docs submodule for getDocTool

ENV NODE_ENV=production
ENV DATA_DIR=/app/data # Set data directory path for the running container

# Install only production dependencies
RUN npm ci --omit=dev --ignore-scripts

ENTRYPOINT ["node", "dist/src/index.js"]
