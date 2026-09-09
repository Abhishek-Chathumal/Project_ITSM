# ADR-0009: Debian base image for the API container (Prisma engine compatibility)

**Status:** Accepted
**Relates to:** Constitution Part VI (Architecture), Part X (Technology Stack), Article VIII

## Context

The API container originally built on `node:20-alpine`, chosen for image size. It
crash-looped on first real run with:

```
prisma:warn Prisma failed to detect the libssl/openssl version to use ... Defaulting to "openssl-1.1.x"
Error: Could not parse schema engine response: SyntaxError: Unexpected token 'E', "Error load"...
```

Prisma ships prebuilt engine binaries per platform. On Alpine (musl), it must resolve a
`linux-musl-openssl-*` engine; its OpenSSL auto-detection failed, it fell back to an
`openssl-1.1.x` engine, and that binary links against a `libssl` modern Alpine does not
ship. The engine printed a shared-library load error — not JSON — which Prisma then
failed to parse. The "unexpected token" message is a symptom two layers removed from the
cause.

Note this passed `docker build` cleanly. Only _running_ the container surfaced it.

## Decision

- `infra/docker/api.Dockerfile` builds on **`node:24-bookworm-slim`** (glibc, OpenSSL 3.x),
  matching Prisma's well-supported `debian-openssl-3.0.x` target. `openssl` and
  `ca-certificates` are installed explicitly because the `-slim` images omit them.
- `schema.prisma` pins `binaryTargets = ["native", "debian-openssl-3.0.x"]` so the correct
  engine is always generated rather than depending on runtime detection. `native` covers
  developer machines (Windows/macOS/Linux) and CI runners.

Alpine + `apk add openssl` + a musl binary target was considered. It often works, but
musl/Prisma has a long tail of edge cases, and Debian is what Prisma's own guidance and
most production Node images use. The ~80 MB size difference is irrelevant for a
small-organization internal tool; reliability is not.

## Consequences

- Switching the base image invalidates any pre-existing `api_node_modules` Docker volume,
  which holds native modules (argon2, Prisma engines) built for the old libc. Rebuilding
  after such a change requires `docker compose ... down -v`, not a plain `down`.
- The web image and its nginx runtime remain Alpine; neither runs Prisma.
- A CI `smoke` job was added alongside this change, because the existing `build` job could
  never have caught a runtime-only failure. See ADR-0010.
