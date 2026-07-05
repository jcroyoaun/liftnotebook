FROM node:22-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Bake the commit SHA into the bundle so any device can answer
# "which build am I running?" from the Settings/Sign-in footer.
ARG BUILD_ID=dev
ENV VITE_BUILD_ID=$BUILD_ID
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
