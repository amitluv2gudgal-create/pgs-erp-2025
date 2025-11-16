# --- build stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# install build dependencies
COPY package*.json ./
RUN npm ci --silent

# copy source and build
COPY . .
# if you have a build script, run it; otherwise this step is harmless
RUN npm run build --if-present

# --- runtime stage ---
FROM node:20-alpine AS runner
WORKDIR /app

# create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# copy only necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

# expose port; Render will set $PORT at runtime
ARG PORT=3000
EXPOSE ${PORT}

# run as non-root
USER appuser

# default command: start your server (adjust if your start script differs)
CMD ["node", "server.js"]
