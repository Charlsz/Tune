# Build estático con Vite y servir con nginx (proxy /api -> eo-api).
FROM node:22-alpine AS build
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
# Mapbox y demás VITE_* se inyectan en build (Compose / CI).
ARG VITE_MAPBOX_TOKEN=
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /web/dist /usr/share/nginx/html
EXPOSE 80
