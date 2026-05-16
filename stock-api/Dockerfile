FROM node:20-alpine

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci --only=production

# Copiar el resto de archivos
COPY . .

# Crear el directorio de datos para SQLite y logs
RUN mkdir -p /app/data /app/logs && chown -R node:node /app/data /app/logs

# Cambiar a usuario sin privilegios por seguridad
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
