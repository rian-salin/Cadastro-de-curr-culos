FROM node:24-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Estágio só para rodar os testes em container (docker-compose.test.yml), para
# não exigir Node.js instalado na máquina.
FROM build AS test
CMD ["npm", "test"]

FROM nginx:alpine AS final
COPY --from=build /src/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
