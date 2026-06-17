FROM oven/bun:slim AS base
WORKDIR /usr/src/app

FROM base AS install
RUN mkdir -p /temp/dev/standalone
COPY standalone/package.json standalone/bun.lock /temp/dev/standalone/
RUN cd /temp/dev/standalone && bun install

FROM base AS prod
RUN mkdir -p /temp/prod/standalone
COPY standalone/package.json standalone/bun.lock /temp/prod/standalone/
RUN cd /temp/prod/standalone && bun install --production

FROM base AS prerelease
COPY --from=install /temp/dev/standalone/node_modules node_modules
COPY standalone/. .

# Bake the widget + wasm assets into the image at build time so the server can
# serve them with NO runtime egress (air-gapped deployments). Versions are
# overridable build args; the seed script reads versions.json.
FROM alpine:3.20 AS assets
ARG WIDGET_VERSION=0.1.56
ARG WASM_VERSION=0.0.7
ARG CACHE_HOST=https://cdn.jsdelivr.net
RUN apk add --no-cache curl && mkdir -p /bundle \
 && curl -fSL "$CACHE_HOST/npm/@cap.js/widget@$WIDGET_VERSION" -o /bundle/widget.js \
 && curl -fSL "$CACHE_HOST/npm/@cap.js/widget@$WIDGET_VERSION/cap-floating.min.js" -o /bundle/floating.js \
 && curl -fSL "$CACHE_HOST/npm/@cap.js/wasm@$WASM_VERSION/browser/cap_wasm_bg.wasm" -o /bundle/cap_wasm_bg.wasm \
 && curl -fSL "$CACHE_HOST/npm/@cap.js/wasm@$WASM_VERSION/browser/cap_wasm.min.js" -o /bundle/cap_wasm.js \
 && printf '{"widget":"%s","wasm":"%s"}\n' "$WIDGET_VERSION" "$WASM_VERSION" > /bundle/versions.json

FROM base AS release
COPY --from=prod /temp/prod/standalone/node_modules node_modules
COPY --from=prerelease /usr/src/app .
COPY --from=assets /bundle ./asset-bundle
WORKDIR /usr/src/app
RUN mkdir -p data && chown bun:bun data

EXPOSE 3000/tcp

USER bun

ENTRYPOINT [ "bun", "run", "./src/index.js" ]
