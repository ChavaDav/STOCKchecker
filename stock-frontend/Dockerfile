# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias
COPY package*.json ./
RUN npm ci

# Copiar el código fuente y compilar
COPY . .
# Utilizar una variable de entorno en tiempo de build para inyectar la URL de la API
ENV VITE_API_URL=http://localhost:3001/api
RUN npm run build

# Etapa 2: Servidor Web (Nginx)
FROM nginx:alpine

# Copiar la build generada a nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Sobrescribir la configuración por defecto de Nginx para soportar el router de React (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
