# syntax=docker/dockerfile:1
# Fynk API image (M0). Built by docker compose for local dev and by the deploy workflow (M14).
# The generated handlers (internal/*/http/api.gen.go) are not committed: run `make generate-go`
# before building. make dev does it for you.

FROM golang:1.27.3-bookworm AS build
WORKDIR /src
ENV CGO_ENABLED=0 GOWORK=off GOTOOLCHAIN=local
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN if [ -z "$(find internal -name api.gen.go -print -quit)" ]; then \
      echo "The generated handlers are missing: run make generate-go first." >&2; exit 1; \
    fi
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api && \
    go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

# Distroless: no shell, no package manager, runs as a non-root user.
FROM gcr.io/distroless/static-debian12:nonroot@sha256:afa5c872c891853ca7fcf1f12c3edb23f7eeef36189728842dd51042ff57f7ab
COPY --from=build /out/api /out/migrate /
USER nonroot:nonroot
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=4s --start-period=5s --retries=6 CMD ["/api", "healthcheck"]
ENTRYPOINT ["/api"]
