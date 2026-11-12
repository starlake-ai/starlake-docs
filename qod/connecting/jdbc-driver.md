---
id: jdbc-driver
title: "The QoD JDBC driver: browser sign-in for DBeaver and Java tools"
sidebar_label: "QoD JDBC driver"
description: "Connect DBeaver and other JDBC tools to DuckDB through Quack on Demand with a browser sign-in at your identity provider: authenticator=externalbrowser, as with Snowflake."
keywords: ["duckdb jdbc sso", "jdbc externalbrowser", "dbeaver sso duckdb", "flight sql jdbc oauth", "qod-jdbc"]
---

The QoD JDBC driver, [qod-jdbc](https://github.com/starlake-ai/qod-jdbc), is the Apache Arrow Flight SQL JDBC driver with one addition: `authenticator=externalbrowser`. Opening a connection opens your browser at your identity provider; once you are signed in, the connection opens. Nobody copies or pastes a token, as with Snowflake's driver of the same name.

```
jdbc:qod://qod.example.com:31338?tenant=acme&pool=bi&authenticator=externalbrowser
```

Without `authenticator`, the driver behaves exactly like the Arrow driver: `user` / `password` or `token`, as described in [Connecting clients](/qod/connecting/clients#dbeaver-and-jdbc).

## Get the driver

The driver is one self-contained jar: it bundles the Arrow Flight SQL JDBC driver, unchanged, and carries its version (qod-jdbc 19.0.0 embeds Arrow's 19.0.0). Build it from source with Maven and Java 11 or later:

```bash
git clone https://github.com/starlake-ai/qod-jdbc
cd qod-jdbc
mvn verify
# target/qod-jdbc-19.0.0.jar
```

Use it **in place of** the Arrow driver jar, not beside it: the jar already holds the Arrow driver's classes, and two copies of them on one classpath conflict. The same jar still accepts `jdbc:arrow-flight-sql://` URLs.

| Setting | Value |
|---|---|
| Driver class | `ai.starlake.qod.jdbc.QodDriver` |
| URL | `jdbc:qod://<host>[:<port>]?<property>=<value>&...` |
| Default port | `31338`, the FlightSQL edge |
| Java | 11 or later, no JVM flag needed (on Java 25 too) |

## Properties

| Property | Default | Meaning |
|---|---|---|
| `authenticator` | `default` | `default`: `user` / `password` or `token`, handed to the Arrow driver as they are. `externalbrowser`: a browser sign-in, below. Case does not matter. |
| `managerUrl` | `http://<host>:20900` | The QoD manager as your browser reaches it. Behind an ingress or a TLS proxy, set its public URL. Only the browser calls it, never the driver. |
| `browserTimeoutSec` | `120` | How long the driver waits for you to finish signing in. |
| `tenant`, `pool` | | Required, as for every client: the edge routes on them. With `externalbrowser`, `tenant` also picks the identity provider. |

Every other property (`useEncryption`, `disableCertificateVerification`, `superuser`, `branch`, ...) goes to the Arrow driver and the edge unchanged; see [Connecting clients](/qod/connecting/clients#dbeaver-and-jdbc) for what the edge reads. A property given to the driver's connection properties wins over the same key in the URL. With `externalbrowser`, any `user` and `password` are dropped: the token is the credential.

## Browser sign-in

With `authenticator=externalbrowser`, each new connection:

1. listens on `127.0.0.1`, on a free port, with a key pair made for this sign-in only;
2. opens your default browser at `<managerUrl>/api/auth/driver/start` (the URL is also printed on the standard error, for a machine where no browser opens);
3. the manager sends the browser to the tenant's identity provider, where you sign in as you do for the console (SSO, MFA);
4. the browser comes back to the driver's listener, which shows "You are signed in to QoD. You can close this window", with your ID token encrypted so that only this driver can read it;
5. the driver connects with that token, as the Arrow driver's `token`.

The token stays in the application's memory until 30 seconds before it expires, for that manager and tenant: the further connections a tool like DBeaver opens reuse it, and a burst of them opens a single browser tab. Nothing is written to disk, so restarting the application signs you in again. A token that has expired opens the browser on the next connection; if your identity provider still has a session in that browser, it comes back without asking.

Which identity provider, decided by the manager:

- the **tenant's own**, when the tenant signs in to the console through one (its Auth Provider settings, see [Per-tenant OIDC](/qod/operating/auth-providers#per-tenant-oidc)): its users sign in to the driver as they do to the console;
- otherwise the manager's **data-plane provider**, the one behind the [browser token page](/qod/operating/auth-providers#browser-token-page-authorization-code-flow);
- with neither, the sign-in fails at once with `oidc_not_configured`: use `user` / `password`.

Signing in gives no access by itself. The edge then checks the token and the user as for any connection: the identity provider's user name must be a QoD user of the tenant, and that user's pool and table grants apply.

`externalbrowser` is for desktop tools, where someone is at the screen. A Spark job, a scheduler or a server opens connections in processes where nobody signs in: give those `user` / `password` or a `token`.

## What the manager needs

Nothing new on the identity provider: the driver reuses the clients and redirect URIs the console and the token page already use.

- QoD 0.13.0 or later.
- `QOD_MGMT_PUBLIC_BASE_URL` set to the manager's browser-facing URL, as for single sign-on. The identity provider sends the browser back there.
- `managerUrl` naming that same origin. The manager remembers the sign-in in a cookie of the origin the browser started on, and finds it again only if the identity provider sends the browser back to that origin; `http://localhost:20900` and `http://127.0.0.1:20900` are two origins.
- For the tenant's own provider: its client allows `<QOD_MGMT_PUBLIC_BASE_URL>/api/auth/oidc/callback`, which console SSO already requires.
- For the data-plane provider: its client allows `<QOD_MGMT_PUBLIC_BASE_URL>/api/auth/sql-token/callback`, which the token page already requires.

The manager keeps nothing between the start of a sign-in and its end, so with several manager replicas the two can reach different ones. A sign-in started for the driver opens no console session in the browser and leaves an existing one as it is.

## DBeaver

1. **Database -> Driver Manager -> New**:
   - Driver Name: `Quack on Demand (SSO)`.
   - Class Name: `ai.starlake.qod.jdbc.QodDriver`.
   - URL Template: `jdbc:qod://{host}:{port}`.
   - Default Port: `31338`.
   - **Libraries -> Add File**: `qod-jdbc-19.0.0.jar`. Remove any Arrow Flight SQL driver jar from this driver's libraries.
2. **Database -> New Database Connection**, pick it, and set the URL:

   ```
   jdbc:qod://qod.example.com:31338?useEncryption=true&tenant=acme&pool=bi&authenticator=externalbrowser&managerUrl=https://qod.example.com
   ```

   Leave the user name and password empty. Add `disableCertificateVerification=true` while the edge runs on its self-signed certificate.
3. **Test Connection**: your browser opens; sign in, close the tab, and DBeaver connects.

The [DBeaver](/qod/connecting/dbeaver) page covers the Arrow driver's own paths.

## Troubleshooting

A failed sign-in reads `QoD browser login failed: <code>` in the tool, with SQLState `28000`.

| What you see | Cause and fix |
|---|---|
| `oidc_not_configured` | Neither the tenant nor the manager has an identity provider to sign in with, or the tenant switched to password sign-in during the sign-in. Use `user` / `password`, or ask an admin to set up the tenant's sign-in. |
| `invalid_state` | The sign-in took longer than 10 minutes, or the browser came back to another origin than it started on: make `managerUrl` the same origin as `QOD_MGMT_PUBLIC_BASE_URL`. Then retry. |
| `discovery_failed` | The manager could not read the identity provider's discovery document. An operator checks the provider's issuer URL and that the manager reaches it. |
| `idp_error`, `access_denied`, ... | The identity provider refused the sign-in, or the manager's exchange of the code failed. A code the provider sent, such as `access_denied`, is passed on as it is. |
| `QoD browser login timed out after 120 s` | Nobody finished signing in. Raise `browserTimeoutSec`, or open the URL printed on the standard error when no browser opened. |
| The browser shows `invalid_driver_request` | The driver sent the manager something it refuses (a port, key or state it cannot read): use a driver release that matches the manager. |
| `UNAUTHORIZED: permission denied: user '<name>' is not registered in tenant '<tenant>'` | The identity provider signed you in, but QoD has no user of that name in the tenant. An admin creates it, with the user name the provider gives (its `preferred_username`). |
| `UNAUTHENTICATED: 'tenant' header required` | Add `tenant=...` and `pool=...` to the URL. |
