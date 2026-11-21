# Keycloak for Fynk (M1), pinned to the version used by docker-compose.yml.
# The realm files in realms/ are copied in and imported on the first start. Their secrets come
# from environment variables (README.md). Staging (M14) runs the default command; docker
# compose runs `start-dev --import-realm` locally.
# The email code extension (extensions/email-code, with its unit tests) and the login theme
# (theme/) are built here and put in providers/ before `kc.sh build`. The jars do not depend on the
# CPU, so those stages run on the build machine even when the final image is built for another
# architecture. BuildKit sets BUILDPLATFORM; the classic builder (testcontainers may use it) leaves
# it empty, so it falls back.
ARG BUILDPLATFORM
FROM --platform=${BUILDPLATFORM:-linux/amd64} maven:3.9.11-eclipse-temurin-21 AS extension
WORKDIR /build
COPY extensions/email-code/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY extensions/email-code/src ./src
RUN mvn -B -q verify

# The login theme `fynk` (theme/, Keycloakify) is built into a jar here. Keycloakify runs Maven, so
# this stage is the Maven image with Node copied in from a pinned Node image (the theme needs Node
# 22.20 or newer; pnpm comes from the `packageManager` field through corepack). The jar does not
# depend on the CPU either, so this stage also runs on the build machine.
FROM --platform=${BUILDPLATFORM:-linux/amd64} node:22.21.1-bookworm-slim AS node
FROM --platform=${BUILDPLATFORM:-linux/amd64} maven:3.9.11-eclipse-temurin-21 AS theme
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack \
 && ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true
WORKDIR /build
COPY theme/package.json theme/pnpm-lock.yaml theme/.npmrc ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile --ignore-workspace
COPY theme/ ./
RUN pnpm build-keycloak-theme

FROM quay.io/keycloak/keycloak:26.8.1 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true
COPY --from=extension /build/target/fynk-email-code.jar /opt/keycloak/providers/
COPY --from=theme /build/dist_keycloak/fynk-keycloak-theme.jar /opt/keycloak/providers/
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realms/*-realm.json /opt/keycloak/data/import/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
