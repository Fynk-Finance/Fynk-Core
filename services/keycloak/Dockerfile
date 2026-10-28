# Keycloak for Fynk (M1), pinned to the version used by docker-compose.yml.
# The realm files in realms/ are copied in and imported on the first start. Their secrets come
# from environment variables (README.md). Staging (M14) runs the default command; docker
# compose runs `start-dev --import-realm` locally.
FROM quay.io/keycloak/keycloak:26.8.1 AS builder
ENV KC_DB=postgres \
    KC_HEALTH_ENABLED=true
RUN /opt/keycloak/bin/kc.sh build

FROM quay.io/keycloak/keycloak:26.8.1
COPY --from=builder /opt/keycloak/ /opt/keycloak/
COPY realms/*-realm.json /opt/keycloak/data/import/
ENTRYPOINT ["/opt/keycloak/bin/kc.sh"]
CMD ["start", "--optimized", "--import-realm"]
