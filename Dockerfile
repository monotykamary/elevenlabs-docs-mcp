FROM node:23-alpine AS builder

WORKDIR /app

# Copy package files first
COPY package.json package-lock.json* ./

# Disable prepare script during npm ci to prevent premature build
RUN npm ci --ignore-scripts

# Copy the rest of the project files
COPY . .

# Now explicitly run the build
RUN npm run build

FROM node:23-alpine AS release

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

ENV NODE_ENV=production

RUN npm ci --omit=dev --ignore-scripts

ENTRYPOINT ["node", "dist/src/index.js"]
