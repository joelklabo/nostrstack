FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN pnpm install --frozen-lockfile
ARG VITE_API_BASE_URL
ARG VITE_NETWORK=mainnet
ARG VITE_NOSTRSTACK_TIP_LNADDR
ARG VITE_NOSTRSTACK_TIP_PUBKEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_NETWORK=$VITE_NETWORK
ENV VITE_NOSTRSTACK_TIP_LNADDR=$VITE_NOSTRSTACK_TIP_LNADDR
ENV VITE_NOSTRSTACK_TIP_PUBKEY=$VITE_NOSTRSTACK_TIP_PUBKEY
RUN pnpm --filter web build

FROM nginx:alpine
COPY --from=build /usr/src/app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
