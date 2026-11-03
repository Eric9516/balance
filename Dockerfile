# La app en una caja (imagen de Docker) para el servidor propio (servidor/LEEME.md).
# Dos partes:
#   - armado: instala todo, genera Prisma y arma Next. Sirve también de "herramientas" (migraciones y
#     scripts de usuarios), con docker build --target armado.
#   - la final: solo lo que corre (el servidor standalone de Next), sin código fuente ni herramientas.
# Node fijado por su huella (sha256): si alguien cambiara la imagen publicada con ese nombre, el armado
# falla en vez de usarla.
FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS armado
WORKDIR /repo
# HUSKY=0: sin ganchos de git adentro de la caja. La base de datos no se usa al armar, pero env.ts
# exige una dirección con forma válida al cargar los módulos.
ENV HUSKY=0 CI=1 NEXT_TELEMETRY_DISABLED=1 \
    DATABASE_URL=postgresql://armado:armado@127.0.0.1:5432/armado
RUN npm install -g pnpm@12.10.1 --ignore-scripts
# Primero solo lo que decide los paquetes: si no cambia, Docker reusa lo instalado.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml prisma.config.ts ./
COPY vendor vendor
COPY prisma prisma
RUN pnpm install --frozen-lockfile
COPY . .
ARG VERSION=
ENV NEXT_DEPLOYMENT_ID=$VERSION NEXT_SALIDA_STANDALONE=1
RUN pnpm run build
# Lo que corre: el servidor standalone más los archivos estáticos, que Next no copia solo. -L copia el
# contenido de los accesos directos de pnpm en vez del acceso.
RUN cp -rL .next/standalone /app \
 && cp -r .next/static /app/.next/static \
 && cp -r public /app/public \
 && rm -f /app/.env*

FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
# Los archivos de la app son de root y no se pueden cambiar: la app corre con el usuario "balancert"
# del servidor (servidor/app.sh).
COPY --from=armado /app ./
CMD ["node", "server.js"]
