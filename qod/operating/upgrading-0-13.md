---
id: upgrading-0-13
title: Upgrading to 0.13
description: "The checklist for upgrading a Quack on Demand manager from 0.12.x to 0.13.0: Java 25, read-only tokens that are read-only everywhere, and stricter database defaults."
keywords: ["upgrade", "release notes", "0.13.0", "0.12.2", "java 25", "migration", "breaking changes"]
---

Coming from 0.12.0 or earlier, first apply [Upgrading to 0.12](./upgrading-0-12.md).

0.12.2 needs no step of its own. It lets the manager boot on Linux distributions with a glibc older than 2.34 (Ubuntu 20.04, Debian 11, RHEL 8 and its rebuilds), which refused it with ``version `GLIBC_2.34' not found``. The bundled `qod-node` and `libquackwire` now need at most glibc 2.28.

## From 0.12.x to 0.13.0

### Checklist

**Before upgrading**

1. **Provide Java 25.** The manager needs Java 25 or later, where it needed 21. See [Java 25](#java-25).
2. **Replace read-only tokens that administer QoD.** A personal access token minted with `verbCeiling: RO` is now read-only on admin REST and MCP too. See [Read-only tokens](#read-only-tokens).
3. **Check database defaults.** A database's `defaultSchema` and `defaultDatabase` must be plain identifiers, like `schemaName`. See [Database defaults](#database-defaults).

**While upgrading**

4. Upgrade the node image and the fleet servers with the manager, and restart every node.

**After upgrading**

5. On a tenant whose Iceberg sources use `credential_chain`, expect a tenant admin's change to one to need a superuser. See [What a tenant admin can no longer do](#what-a-tenant-admin-can-no-longer-do).

### Java 25

The Docker image runs on Temurin 25. When no Java 25 is found, `qod start` and `qod serve` download a Temurin 25 JRE into a cache folder of its own (`<user cache>/qod/jre-25`). On Windows on ARM, which Temurin 25 does not cover, they download the Microsoft Build of OpenJDK 25.

`scripts/run-jar.sh` and `run-jar.ps1` need `JAVA_HOME` or the `java` on `PATH` to be 25 or later.

A manager launched with `-cp` instead of `java -jar` must pass `--enable-native-access=ALL-UNNAMED` and `--sun-misc-unsafe-memory-access=allow` itself, next to the two `--add-opens`, or JDK 25 prints warnings at every boot. With `java -jar`, the jar's manifest and the launchers cover it.

[Starflow](./starflow.md) follows: `qod start --with-starflow` runs it on the manager's Java, and the Compose `starflow` image is on Temurin 25.

### Read-only tokens

`verbCeiling: RO` now means read-only everywhere. Such a token gets every `GET` and four reads sent as `POST` (`/api/auth/pat/list`, `/api/profile/s3/list`, `/api/tenant/location/list` and `/api/user/s3/list`). Anything else answers `403 token_read_only` and writes an `auth.token.read_only` audit row. It can no longer import a manifest or mint a child token.

Over MCP it gets only the read-only tools, `run_sql` included, which the ceiling already bounds. Another tool reads as unknown.

Replace a token that administers QoD under `RO` with one without that ceiling. See [MCP server](../connecting/mcp.md) for the token's other axes.

### Database defaults

A create, update, manifest import or branch registration with a `defaultSchema` or `defaultDatabase` that is not a plain identifier answers `400`. A row stored earlier with one keeps serving, but any update to it, or a manifest import of it, must correct the value first.

### What a tenant admin can no longer do

Only a superuser sets or changes an Iceberg source's `credential_chain`: a tenant admin gets `403 superuser_required`. A stored source sent back unchanged is still accepted. See [Iceberg](./iceberg.md).

### Other security changes

- A management session presented on the data plane as a bearer, when `JWT_SECRET_KEY` equals the session secret, follows the session store: its own tenant or one it administers, and a superuser row only for a superuser's session.
- Kubernetes node pods no longer mount the service account's API token, and a pod template cannot turn it back on. Tokens projected for IRSA or workload identity are separate mounts and stay.

### What is new

- **Browser sign-in for JDBC tools.** The [QoD JDBC driver](../connecting/jdbc-driver.md) signs DBeaver and other Java tools in at the tenant's identity provider with `authenticator=externalbrowser`.
- **Why a node is unhealthy.** The console and `qod pool list` give the reason, the manager's explanation and how long. See [Why a node is unhealthy](./observability.md#why-a-node-is-unhealthy).
- **One tenant's RBAC by manifest.** Export and import take `--mode rbac --tenant <id>`. See [One tenant's roles and groups](./manifest.md#one-tenants-roles-and-groups).
- **Refused handshakes in the audit log.** `QOD_AUDIT_HANDSHAKE_FAILURES=true` records them. See [Refused handshakes](../administration/audit-log.md#refused-handshakes). The audit history also takes an ascending `after` cursor, and its rows carry the token id.
- **CLI update notice.** The `qod` CLI tells you when PyPI has a newer release. `QOD_NO_UPDATE_CHECK=1` turns it off.

### Fixed

- A FlightSQL client that sends its identity provider's token on every call, as the Arrow Flight SQL JDBC driver does with `token=`, keeps one session. Its first statement used to fail with "prepared statement handle does not belong to this session", a token pasted from the SQL-token page included.
- Column masks and row filters apply to federated tables, to the tables of a `duckdb-file` or `memory` database, and to a DuckLake table read from another schema. A column-policy holder is still refused one statement reading two tables of the same name from different catalogs or schemas.
- A DuckLake database attached under a custom `catalogAlias` gets its column list again, so column policies on it no longer refuse `SELECT *`.
- `qod serve` and `qod start` provision `libduckdb` for the JVM's architecture, not Python's, so an x64 JVM on Windows on ARM loads `quackwire.dll`.
