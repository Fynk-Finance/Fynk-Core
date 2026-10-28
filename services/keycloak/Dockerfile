# Keycloak for Fynk (M1), pinned to the version used by docker-compose.yml.
# The realm files in realms/ are copied in and imported on the first start. Their secrets come
# from environment variables (README.md). Staging (M14) runs the default command; docker
# compose runs `start-dev --import-realm` locally.
# The email code extension (extensions/email-code) is built here with its unit tests and put in
# providers/ before `kc.sh build`. The jar does not depend on the CPU, so the Maven stage runs on
# the build machine even when the final image is built for another architecture. BuildKit sets
# BUILDPLATFORM; the classic builder (testcontainers may use it) leaves it empty, so it falls back.
ARG BUILDPLATFORM
FROM --platform=${BUILDPLATFORM:-linux/amd64} maven:3.9.11-eclipse-temurin-21 AS extension
WORKDIR /build
COPY extensions/email-code/pom.xml .
RUN mvn -B -q dependency:go-offline
COPY extensions/email-code/src ./src
RUN mvn -B -q verify

FROM quay.io/keycloak/keycloak:26.8.1 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true
COPY --from=extension /build/target/fynk-email-code.jar /opt/keycloak/providers/
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realms/*-realm.json /opt/keycloak/data/import/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
