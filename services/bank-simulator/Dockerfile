# syntax=docker/dockerfile:1
# PLACEHOLDER image added by M0 for the local stack. Owned by M16, which keeps or replaces it.

FROM golang:1.27.3-bookworm AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off GOTOOLCHAIN=local
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/bank-simulator ./cmd/bank-simulator

# Distroless: no shell, no package manager, runs as a non-root user.
FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
COPY --from=build /out/bank-simulator /
USER nonroot:nonroot
EXPOSE 8443 9443
HEALTHCHECK --interval=10s --timeout=4s --start-period=5s --retries=6 CMD ["/bank-simulator", "healthcheck"]
ENTRYPOINT ["/bank-simulator"]
