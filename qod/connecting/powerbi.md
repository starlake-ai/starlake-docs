---
id: powerbi
title: Power BI
---

Power BI / Microsoft Fabric connects to Quack on Demand through the **QoD custom connector** (v2.0.0+), built on `Adbc.Connection` and the **FlightSQL ADBC driver that ships in-box with Power BI Desktop** - no driver installation on the client. The connector supports **Import and DirectQuery**, with query folding: filters, projections, joins, aggregations, and top-N push down as SQL to the Quack edge.

```
Power BI ──M──▶ QoD.mez ──Adbc.Connection──▶ FlightSQL ADBC driver (in-box) ──Flight SQL──▶ Quack edge (:31338, TLS)
```

The navigator and every query inherit Quack's server-side enforcement: the table list is RBAC-filtered per principal, and column masking and row policies apply inside the folded SQL. The connector holds no privileged access.

This page covers installing the connector and connecting. For the server-side `tenant` / `pool` and auth contracts that the connector rides on, see [Connecting clients](/qod/connecting/clients) and [Authenticating](/qod/connecting/authenticating).

:::info Coming from the v1 (ODBC) connector?
v1 wrapped the Arrow Flight SQL ODBC driver and was blocked on that driver's maturity. v2 replaces the transport entirely; the parameters, data source kind, and credential kinds are unchanged, and the ODBC driver is no longer needed anywhere. Uninstalling it is safe.
:::

## Prerequisites

- **Power BI Desktop 2.145.1105.0 (July 2025) or later.** The FlightSQL ADBC driver ships in-box (`bin\ADBC Drivers\FlightSQL\libadbc_driver_flightsql.dll`); there is nothing to install or register. On an older Desktop the connector loads but fails with `The Adbc.Connection function is not available in this environment`.
- For refresh in the **Power BI Service**: an **on-premises data gateway** hosting the connector - see [Power BI Service and the gateway](#power-bi-service-and-the-gateway).
- Quack credentials in one of the three supported kinds:
  - Username + password (validated against the Quack Postgres / BCrypt backend)
  - Static JWT (validated against the external JWT backend; QoD PATs are REST-only and are **not** accepted on the FlightSQL edge)
  - OAuth 2.0 / OIDC token (Keycloak / Entra ID / Google / Cognito)

## Install the connector

The connector ships as two artifacts:

- **`QoD.mez`** - the connector packaged **unsigned**; loads only with the data-extensions security setting **lowered** (Option 1).
- **`QoD.pqx`** - a packed, **signed** connector; loads under the **Recommended** security setting once you trust its signing certificate's thumbprint (Option 3). This is how you allow **only** the QoD connector while still blocking other uncertified extensions.

:::caution Using OAuth 2.0 / OIDC?
The OAuth endpoints and client ID are **compiled into the `.mez`** (`OAuthConfig` in `QoD.pq`), so the generic released build cannot carry your identity provider. To use OAuth you must **build the connector from source** with `OAuthConfig` pointed at your IdP - see [Option 2 - Only if you need OAuth](#option-2---only-if-you-need-oauth). The **Username / Password** and **Key (static JWT)** credential kinds work with the pre-built release in Option 1.
:::

### Option 1 - Unsigned `.mez` from GitHub Releases (Dev only)

1. Download `QoD-<version>.mez` (v2.0.0 or later) from the [release page](https://github.com/starlake-ai/qod-powerbi-connector/releases).
2. Copy it into `%UserProfile%\Documents\Power BI Desktop\Custom Connectors\` (create the folder if missing).
3. In Power BI Desktop, open **File -> Options and settings -> Options -> Security -> Data Extensions** and select **`(Not Recommended) Allow any extension to load without validation or warning.`** *(In a French UI: **Fichier -> Options et paramètres -> Options -> Sécurité -> Extensions du connecteur de données**, then the `(Non recommandé) Autoriser le chargement de toutes les extensions sans validation et avertissement` option.)*
4. **Restart Power BI Desktop fully** - close every running `PBIDesktop.exe`. Connectors load at startup; the security change does not apply to an already-running session.
5. **Get Data -> search "Quack" -> Quack on Demand**. *(French UI: **Obtenir les données -> Plus...** then search.)*

### Option 2 - Only if you need OAuth

Build from source when you need **OAuth**, or want to change any compiled-in connector setting. A `.mez` is **just a flat zip** of the connector source plus icons - **no Power Query SDK or compiler is required**; any zip tool produces a valid connector.

**1. Get the source:**

```sh
git clone https://github.com/starlake-ai/qod-powerbi-connector.git
cd qod-powerbi-connector
```

**2. For OAuth, edit `OAuthConfig` in `src/QoD.pq`** to point at your identity provider. Example for a Keycloak realm `qod`:

```m
OAuthConfig = [
    AuthorizeUrl = "https://<keycloak-host>/realms/qod/protocol/openid-connect/auth",
    TokenUrl     = "https://<keycloak-host>/realms/qod/protocol/openid-connect/token",
    LogoutUrl    = "https://<keycloak-host>/realms/qod/protocol/openid-connect/logout",
    ClientId     = "quack-powerbi",
    Scope        = "openid profile email offline_access",
    RedirectUri  = "https://oauth.powerbi.com/views/oauthredirect.html"
];
```

The IdP must have a **public client** (no secret) with **PKCE = S256** and the redirect URI `https://oauth.powerbi.com/views/oauthredirect.html` registered. Legacy Keycloak prefixes every path with `/auth` (e.g. `https://<host>/auth/realms/qod/...`). See [Authenticating](/qod/connecting/authenticating) and [OAuth server setup](/qod/operating/oauth-server-setup) for the provider-side setup and the Quack-side token-trust configuration. Ready-to-paste examples for Entra ID, Cognito, and Google are in the `src/QoD.pq` header comments.

**3. Package the `.mez`** - zip `QoD.pq`, the four `.pqm` modules, `resources.resx` and the icon PNGs at the **root** of the archive (not inside a subfolder).

Windows (PowerShell):

```powershell
$stage = Join-Path $env:TEMP qodmez
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null
Copy-Item src\QoD.pq, src\*.pqm, src\resources.resx $stage
Copy-Item src\icons\QoD*.png $stage
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, "$PWD\QoD.mez")
```

macOS / Linux:

```sh
mkdir -p stage
cp src/QoD.pq src/*.pqm src/resources.resx stage/
cp src/icons/QoD*.png stage/
( cd stage && zip -X ../QoD.mez QoD.pq *.pqm resources.resx QoD*.png )
```

This produces `QoD.mez`. Deploy it as in Option 1.

> Optionally validate the M syntax with the Power Query SDK's `MakePQX compile` before packaging - but it is not required to produce a working `.mez`.

### Option 3 - Signed `.pqx` (production, keep the Recommended security setting)

Signing is unchanged from v1: pack the `.mez` into a signed `.pqx` with `MakePQX pack --certificate`, keep the **Recommended** data-extensions setting, and allowlist the certificate thumbprint (Group Policy *Trusted Certificate Thumbprints*, or the `TrustedCertificateThumbprints` registry value under `HKLM:\SOFTWARE\Policies\Microsoft\Power BI Desktop`). Self-signed certificates additionally need their public cert in Trusted Root. The full publisher/admin walkthrough, including creating a self-signed code-signing certificate, is in the connector's [INSTALL.md](https://github.com/starlake-ai/qod-powerbi-connector/blob/main/INSTALL.md).

## Connect

Open **Get Data -> Quack on Demand** and provide:

| Field | Example | Notes |
|-------|---------|-------|
| Server | `quack.example.com:31338` | `host:port`; defaults to port `31338` if omitted |
| Tenant | `acme` | Sent as a gRPC call header on every RPC; matches a Quack tenant |
| Pool | `bi` | Sent as a gRPC call header on every RPC; matches a Quack pool within the tenant |
| Trust server certificate | `true` / `false` | Required. `true` only for a self-signed dev endpoint (e.g. `qod demo`); `false` against a CA-signed cert |
| Superuser | `true` / `false` | Required. Requests system-user mode; the server authorizes it against the authenticated principal. Normal value `false` |
| Data Connectivity mode | Import / DirectQuery | The storage-mode choice appears on this dialog - see [DirectQuery vs Import](#directquery-vs-import) |

Pick a credential kind in the next dialog:

| Power BI credential | Authenticates against | Wire format |
|---|---|---|
| Username / Password | Quack `qodstate_user` (BCrypt) | Flight Basic handshake (driver `username` / `password`) |
| Key (static JWT) | External JWT backend (HS256 / RS256) | `Authorization: Bearer <jwt>` |
| OAuth 2.0 | OIDC backend (Keycloak / Entra ID / Google / Cognito) | `Authorization: Bearer <access_token>` |

The server validates the credential and the `tenant` / `pool` headers on every RPC; there is no separate handshake step for the connector to drive. QoD personal access tokens (`qod_pat_...`) are REST-plane credentials and are **not** accepted by the FlightSQL edge.

The equivalent M call:

```m
QoD.Database("quack.example.com:31338", "acme", "bi", true, false)
```

`trustServerCertificate` (4th) and `superuser` (5th) are required logicals; an optional 6th `options` record accepts `UseEncryption = false` for an edge running plain gRPC without TLS. The Navigator then shows the session's catalog with its schemas, and a table list **filtered to what the signed-in principal is granted** - two users of the same tenant can see different table lists by design.

## DirectQuery vs Import

The connector advertises `SupportsDirectQuery = true`; the choice is the **Data Connectivity mode** radio group on the connection dialog (not a later prompt).

| Mode | When to use | Notes |
|---|---|---|
| **Import** | Datasets that fit in memory; reports that need full Power BI modeling and DAX | Copies the dataset to the client on refresh - by design, so data residency arguments favor DirectQuery |
| **DirectQuery** | Large datasets that must stay in Quack | Each visual interaction issues folded SQL (projection, filters, joins, GROUP BY, ORDER BY, LIMIT); only result rows cross to the client, with masking and row policies already applied server-side |

Folded SQL inlines literal values rather than `?` parameter binds, matching the Quack edge (which has no parameter binding).

## Power BI Service and the gateway

Custom connectors never execute in the Power BI Service itself: scheduled refresh or DirectQuery from the Service routes through an **on-premises data gateway** that has the `.mez`/`.pqx` in its custom-connectors folder and the cluster's "allow custom connectors" option enabled. The in-box ADBC driver removes the driver install, **not** the gateway requirement.

Whether a given gateway build can run the ADBC connector depends on its bundled mashup engine exposing `Adbc.Connection` and carrying the FlightSQL driver - Microsoft is still rolling ADBC out to the gateway. Verify on your gateway machine: recent gateway release, an `ADBC Drivers\FlightSQL` folder under its installation directory, and a successful test refresh. On an engine without ADBC the connector fails cleanly with `The Adbc.Connection function is not available in this environment`. Details: the connector's [service-and-gateway doc](https://github.com/starlake-ai/qod-powerbi-connector/blob/main/docs/service-and-gateway.md).

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Connector missing from **Get Data** | `.mez` is not in `Documents\Power BI Desktop\Custom Connectors\` or PBI was not restarted after lowering the security setting. |
| `... couldn't load ... not trusted` | The `.mez` was loaded without the data-extension security downgrade. Enable *Allow any extension...* and restart Power BI Desktop (Option 1), or deploy the signed `.pqx` (Option 3). |
| `The Adbc.Connection function is not available in this environment` | The host's engine predates ADBC support: Power BI Desktop older than 2.145.1105.0 (July 2025), or a gateway build without ADBC. Upgrade the host. |
| `We couldn't convert a value of type Record to type Logical` | `trustServerCertificate` (4th) and `superuser` (5th) are logicals; the `options` record is the 6th argument. |
| `The credentials provided for the QoD source are invalid` on a query that used to work | Besides an actual bad credential, this is also how a **denied statement** surfaces: an RBAC denial mid-evaluation (e.g. a native query on an ungranted table) is reported as a credential error by the mashup engine. Check the grants for the table(s) the query touches. |
| Key credential rejected with `No bearer auth providers configured` | The edge has no JWT/OIDC bearer backend configured. Set `JWT_SECRET_KEY` / `JWT_PUBLIC_KEY_PATH` or an OIDC provider server-side; note QoD PATs are not accepted on the FlightSQL edge. |
| Slow refresh on Basic auth | Quack BCrypt-verifies on every RPC. For high-volume refresh prefer a JWT (Key) credential or OAuth - both are validated more cheaply (signature only, no hashing). |

To confirm the ADBC path or capture the folded SQL, use **Query Diagnostics** (Power Query Editor -> Tools -> Start Diagnostics): QoD events appear on the `Adbc` channel with the generated SQL as the command.

See also: the connector project's [INSTALL.md](https://github.com/starlake-ai/qod-powerbi-connector/blob/main/INSTALL.md) for build and gateway-deployment details.
