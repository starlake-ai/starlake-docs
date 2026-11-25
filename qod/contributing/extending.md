---
id: extending
title: Extending the manager
description: "Extend QoD with a new runtime backend, a new authentication provider, a manager module, or a data connector linked into qod-node."
keywords: ["extending", "runtime backend", "authentication provider", "plugin", "manager module", "platform permissions", "console pages", "connector", "federated source type", "ProtectedScan"]
---

Two seams are designed to be extended: the runtime backend (where Quack nodes run) and the authentication providers (how clients prove who they are). Both follow the same shape, a small interface with one implementation per strategy, selected from configuration at boot (`Main.scala` and `boot/`). See the [Architecture map](./architecture-map.md) for where these sit. A third seam, the manager module, adds routes, permissions and console pages from a jar on the classpath; see [Manager modules](#manager-modules-platform-permissions-and-console-pages). A data connector built outside QoD pairs a module with an extension linked into qod-node, and honors row and column policies through the seams of [Connector extension points](#connector-extension-points).

## Adding a runtime backend

A backend is anything that can start, stop, and track Quack nodes. The interface is `QuackBackend` in `ai.starlake.quack.ondemand.runtime`:

```scala
trait QuackBackend:
  def start(spec: NodeSpec): IO[RunningNode]
  def stop(key: PoolKey, nodeId: String): IO[Unit]
  def isAlive(nodeId: String): Boolean
  def discoverExisting(): IO[List[RunningNode]]
  def cleanup(): IO[Unit]
  def supportsPlacement: Boolean = false      // override to honor NodeSpec.placement
  def adopt(node: RunningNode): IO[Unit] = IO.unit  // re-register a node the backend didn't start
  // plus defaulted hooks for reconcile: isFleet, stopStray, reservePorts, located, liveNodeIds
```

The three shipped implementations are `LocalQuackBackend` (forks child processes via `scripts/spawn-quack-node.sh`, allocating ports from a `PortAllocator`), `KubernetesQuackBackend` (creates pods and honors placement) and `FleetQuackBackend` (assigns nodes to servers that joined with `qod fleet join`). Every one runs `qod-node`, not the DuckDB CLI, and delivers each node's secrets as files, never in argv or env: among them the node token and the node's authorization key (`QOD_NODE_AUTHZ_KEY`, with its id as `QOD_NODE_ID`), derived per node by `NodeKeys`, without which the node refuses every session handle. To add another:

1. Implement `QuackBackend`. Return a `RunningNode` from `start` with the node's id, host, port, and role. Override `supportsPlacement` to `true` only if you can honor `NodeSpec.placement` (the `nodeSelector` / tolerations); otherwise the supervisor drops cohort data on create so the persisted pool matches what was actually scheduled.
2. Implement `discoverExisting` so a manager restart re-adopts nodes that outlived it, and `cleanup` for shutdown.
3. Add a case to the backend selector, `BootFactories.quackBackend` (in `boot/`), which matches on `mgrCfg.runtimeType` (`local`, `kubernetes`/`k8s`, `fleet`) and hands each backend the `NodeKeys` and the node limits it forwards (`nodeExtensions`, `nodeAuthzLimits`).
4. Make sure the nodes can reach the manager replica that minted their session handles: each node calls `QOD_INTERNAL_URL` for every verdict.

Add the matching `QOD_RUNTIME_TYPE` value and any backend-specific config keys to `application.conf` (each as a `QOD_*`-overridable scalar).

## Adding an authentication provider

Authentication is split by credential shape into two interfaces in `ai.starlake.quack.edge.auth`:

```scala
sealed trait AuthScope
object AuthScope:
  case object System extends AuthScope          // empty tenant / ?superuser=true
  final case class Tenant(id: String) extends AuthScope

trait BasicAuthProvider extends AutoCloseable:
  def name: String
  def authenticate(scope: AuthScope, username: String, password: String)
      : Either[String, AuthenticatedProfile]

trait BearerAuthProvider extends AutoCloseable:
  def name: String
  def authenticate(token: String): Either[String, AuthenticatedProfile]
```

Pick `BasicAuthProvider` for a username/password backend (the database authenticator and OIDC resource-owner-password flow implement this) or `BearerAuthProvider` for a token backend (JWT and OIDC bearer implement this). `authenticate` returns an `AuthenticatedProfile` on success or a `Left` reason on rejection.

The `AuthScope` argument is the caller-declared realm. It's `System` for management-plane logins with no tenant and FlightSQL handshakes carrying `?superuser=true`; it's `Tenant(id)` for everything else. A database-style provider uses the scope to pick which `qodstate_user` row to read; OIDC ROPC providers ignore the scope because the OIDC server is authoritative.

`AuthenticationService` builds an ordered chain of each kind from config (`buildBasicChain` / `buildBearerChain`) and tries them in order until one accepts. For Bearer, `bearerChainFor(scope)` consults the optional `TenantOidcRegistry` and may substitute a per-tenant authenticator into the chain (Google today; the pattern extends to Keycloak / Azure / AWS). To add a provider:

1. Implement the appropriate trait.
2. If your provider extracts roles or groups from a token, route them through `RoleExtractor` so they map into the RBAC graph the same way the built-in providers do.
3. Add the provider to the relevant chain builder in `AuthenticationService`, gated by a config flag, and add that flag plus its settings to `application.conf` under `quack-flightsql.auth` (with `QOD_*` overrides).
4. For per-tenant overrides (a tenant has its own client credentials), extend `TenantOidcRegistry` with a typed lookup that reads from `qodstate_tenant.authConfig` and call `bearerChainFor` to splice it in. A client secret is either the tenant's write-only stored `clientSecret` (column `qodstate_tenant.auth_client_secret`, never returned) or a `clientSecretRef` resolved via `SecretRefResolver` (e.g. `env:NAME`, which only a superuser may set); never a literal inside `authConfig`.

Because providers are tried in order and the first acceptance wins, ordering in the chain builder is the precedence. A provider that throws should instead return a `Left` so the chain can fall through to the next one.

## Manager modules: platform permissions and console pages

A manager module is a jar on the manager's classpath declaring `META-INF/services/ai.starlake.quack.spi.ManagerModule`. The manager loads it at boot, applies its Liquibase changelog, calls `start(ctx)`, and then reads its surfaces: `endpoints`, `publicPathPrefixes`, `staticMounts`, `mutationGates` and the three members below. A module that declares none of the three boots as before.

```scala
final case class PlatformPermission(name: String, description: String)
final case class ConsolePage(id: String, label: String, permission: String, bundle: String)

trait ManagerModule:
  // ...
  def permissions: List[PlatformPermission] = Nil   // what its routes check
  def staffPathPrefixes: Set[String] = Set.empty     // REST prefixes staff may reach
  def consolePages: List[ConsolePage] = Nil          // pages in the console's Platform section
```

Permissions are what [platform staff](../operating/platform-staff.md) roles bundle. A superuser holds every permission; a staff user holds the permissions of their platform roles; nobody else holds any.

### Boot validation

`ModuleSurfaces.validate` runs once every module has started and before the REST server is built. A refusal aborts the boot, naming the module and the item. The rules:

- A module that declares any permission, staff prefix or page needs a name over `[a-z0-9-]+`, unique among such modules, that is not the first segment of a core `/api/<segment>` route (`platform` and `console` are reserved too).
- A permission is `<module name>.<rest>`, `<rest>` being segments of `a-z`, `0-9` and `_` joined by dots. It may not start with `platform.` (reserved for core) and is declared once across every module.
- A staff path prefix lies under `/api/<module name>/` (not at it), made of segments over `[A-Za-z0-9._-]`, none empty, `.` or `..`.
- A page `id` is `[a-z0-9-]+`, once per module; its `permission` is one the module declares; its `bundle` is an origin-relative path of such segments, strictly under one of the module's own `staticMounts` (a root mount, `/`, covers no bundle).
- Every module's `publicPathPrefixes`, with or without a platform surface, are absolute paths of such segments, and either `/api/<first>/<more>`, where `<first>` is neither a core segment nor another loaded module's name, or a path at or under one of the module's own non-root static mounts.

Paths are compared on whole segments, as the REST guard reads them.

### Checking a caller

`ManagerContext.platformCallerOf` is part of the stable SPI. It takes the same credential as `scopeOf` (the `X-API-Key` header or the `qod_session` cookie value, `None` when the request carried neither) and answers the caller as a `PlatformCaller`:

```scala
final case class PlatformCaller(
    userId: Option[String],   // None for a superuser
    username: String,
    superuser: Boolean,
    permissions: Set[String]
):
  def has(permission: String): Boolean = superuser || permissions.contains(permission)
  def auditDetail(permission: String): Map[String, String]
```

It answers `None` for a tenant admin or user, a superuser's `--drop-admin` token, no credential or one that does not resolve. A staff user's permissions are read live from their row (a `dropAdmin` staff token holds none), so a revoke applies on the next request. `Some` with no permissions is a normal answer, a staff user whose roles grant nothing: **check `has`, never `isDefined`**. It can read the control-plane database (a token's verification, a cold staff cache), so call it inside `IO.blocking`.

`PermissionCheck.require(caller, permission)` answers `None` when the caller holds the permission, else `Some(403 -> ErrorResponse("permission_required", ...))` naming it. Record the permission an action ran under by merging `caller.auditDetail(permission)` (`permission` and `actorKind`, `superuser` or `staff`) into the `detail` of the module's `ctx.audit` row.

```scala
final class BillingModule extends ManagerModule:
  def name = "billing"
  override def permissions =
    List(PlatformPermission("billing.invoices.read", "Read every tenant's invoices"))
  override def staffPathPrefixes = Set("/api/billing/invoices")
  override def staticMounts = List(StaticMount("/billing-ui", "/billing-ui"))
  override def consolePages =
    List(ConsolePage("invoices", "Invoices", "billing.invoices.read", "/billing-ui/invoices.js"))
  // ...

  // In a route under /api/billing/invoices:
  def listInvoices(credential: Option[String]) =
    IO.blocking(ctx.platformCallerOf(credential)).flatMap { caller =>
      PermissionCheck.require(caller, "billing.invoices.read") match
        case Some(refusal) => IO.pure(Left(refusal))
        case None          => readInvoices().map(Right(_)) // audit with caller.get.auditDetail(...)
    }
```

The REST guard admits a staff session or token only to its own allowlist and to the declared staff prefixes, so a module route written for superusers (`SuperuserCheck`) stays closed to staff unless its path is opted in. On a staff prefix the guard also leaves the URL tenant check to the module, since a platform permission crosses tenants: the route decides which tenant a `?tenant=` may name.

:::warning A staff-prefix route must check its permission
The guard admits staff to every path under a declared staff prefix whatever their permissions, and admits tenant admins to every `/api` route. A route under a staff prefix that forgets its `PermissionCheck.require` is therefore open to staff holding no permission and to every tenant admin.
:::

### Console page contract 1

A page's `bundle` is an ES module the console imports (`import(bundle)`) when the viewer opens `/ui/x/<module>/<id>`. It is served by the module's static mount, which the REST guard does not gate, so it must hold no secret. It runs same-origin with the viewer's session, the trust the module's jar already has on the server. It exports:

```js
export const qodConsoleContract = 1;

export function mount(el, ctx) {
  // render into el
  return () => { /* unmount: remove what the page added */ };   // or a Promise of it
}
```

The console calls the unmount function when the route leaves the page or moves to another page; an unmount that throws is logged to the browser console. Each mount renders into an element of its own, so a slow mount the viewer already left cannot overwrite the next page.

| `ctx` member | Meaning |
|---|---|
| `contract` | `1` |
| `apiBase` | `"/api"` |
| `basePath` | `/ui/x/<module>/<id>` |
| `user` | `{username, superuser, permissions}` |
| `subpath` | The path below `basePath`: `""` at the page root, else starting with `/`. |
| `onLocationChange(cb)` | Calls `cb(subpath)` when the subpath changes; returns an unsubscribe function. |
| `navigate(path)` | A path relative to `basePath` (empty, `.` and `..` segments dropped, so it never leaves the page), or an absolute `/ui/...` console path. |
| `theme` | Always `"dark"`: the console has no light theme. |
| `onUnauthorized()` | Ends the session the way the console's **Sign out** does (under OIDC, a full IdP logout). |

The console's router owns browser history: a page handles deep links through `subpath`, `onLocationChange` and `navigate`, and runs no router of its own. API calls are plain same-origin `fetch` calls with `credentials: "same-origin"`, to which the browser attaches the `qod_session` cookie as it does for the console.

Styling: the CSS custom properties of the console's `ui/src/styles.css` are the contract and stay stable within a contract version: `--bg`, `--bg-elev`, `--bg-card`, `--border`, `--text`, `--text-mute`, `--text-soft`, `--accent`, `--accent-fg`, `--good`, `--warn`, `--bad`, `--link`, `--shadow`, `--radius`, `--mono`, `--sans`. A page injects its own CSS scoped under its root element and removes it on unmount.

A bundle that fails to import, exports no `qodConsoleContract` or another value ("this page needs console contract N"), exports no `mount` function, throws in `mount` or resolves to something other than an unmount function is shown as an error panel naming the module, inside the console's layout; the rest of the console keeps working.

## Connector extension points

A data connector built outside this repository has two halves: a DuckDB extension linked into `qod-node`, which speaks the connector's remote protocol, and a manager module, which declares the federated source type tenants create and how its `ATTACH` is rendered. Core keeps row and column policy enforcement and knows nothing of the connector; the seams below let the connector honor the same policies.

### Linking an extension into qod-node

Link extra static extensions when building qod-node, with the CMake cache variable `QOD_EXTRA_EXTENSIONS`:

```bash
cmake -S native/qod-node -B build/qod-node \
  -DQOD_EXTRA_EXTENSIONS="name=/path/libname.a;other=/path/libother.a" ...
```

Each entry is `name=path`, `name` over `[a-z0-9_]+`. The archive must export `int32_t duckdb_extension_<name>_describe(duckdb_extension_descriptor *)`. qod-node loads every linked extension after each database open, before any SQL runs.

A linked build's `--build-info` line ends with `;extra=<names>`; a build with no extras prints the usual marker. The suffix is appended at run time, so the marker literal inside the binary is the same in both builds and `scripts/release/qod-node-build-info.sh`, which reads the binary's bytes, never sees it. A parser of the `--build-info` output anchored at the end of the line rejects the suffix, so tooling that runs a linked binary must accept it.

### Classifying the linked functions

Nodes refuse an unclassified function to non-superusers ("function `<name>` is not classified"), and a linked extension's functions start unclassified. Classify each one on both sides:

- **On the node**, from code compiled into qod-node: `RegisterLinkedFunctionClass(lower_name, type, class)` (`linked_function_classes.hpp`), where `type` is `scalar`, `aggregate` or `table`. Registration works only before `FreezeLinkedFunctionClasses()`, which `Serve` calls before it installs authorization. After the freeze, for a name the compiled table already classifies, for any other type, or for a superuser or file class, it throws `std::logic_error`.
- **In the manager**: `ManagerModule.functionClasses` returns `(name, type, class)` rows, `type` being `scalar`, `aggregate` or `table` and `class` being `allowed` or `listing`. The manager reads them right after constructing the module, before `start()`, and refuses to boot (`module function classes refused: ...`) on an unknown class, another type, a `superuser` or `file` class, or a name QoD already classifies.

A function classed `allowed` this way is usable in row policy predicates, like a built-in allowed function.

### The policy obligation: `ProtectedScan`

A connector table function whose `get_table_entry` returns a registered table implements `qod::ProtectedScan` (`protected_scan.hpp`) on its bind data (`FunctionData`). At `post_bind`, after column and row policies are applied, core runs the obligation for every scan, privileged principals included:

1. It refuses the statement when a field the scan uses in its remote request (`FieldUses()`, kinds `Filter` and `VectorLineage`) has a column policy. `Projection` uses are ordinary projected columns, covered by the usual column policies. Field uses are also reported to the plan describer as column reads, so `FieldUse.column` must spell the column as the table entry does: policies and reads are matched on that name.
2. It calls `AcceptRowPolicies` with the scan's bound row policies and their predicates.
3. It refuses a bounded scan whose `LoweringResult.exact` is false.
4. It seals the scan with a digest of the policies (`PolicyDigest`: SHA-256 over the policy ids and SQL, in order).

`VerifyProtectedScans` runs again before optimization and checks every seal against the policies of the boundary above the scan.

Bind runs before core hands the scan its policies, so the table function's bind must perform no remote I/O. Core runs the obligation only for quack sessions: a connector scan on an internal connection is never sealed, and so always refuses.

**Predicates.** `predicates` are the expressions of the row policy boundary filter, to be ANDed. Each one is the OR of the matched policies, each policy wrapped as `TRY(CAST(<policy> AS BOOLEAN))`. Column references bind to `get.table_index`, and their `column_index` indexes `get.GetColumnIds()`. The list is empty when no policy applies, privileged principals included; the scan is still sealed, with an empty policy list, and the connector still enforces its own mandatory scope.

**Exactness.** `exact = true` means the connector returns exactly the rows for which the predicates are TRUE, decided before any candidate limit it applies. A row where a policy is NULL or fails to evaluate must not be returned, and virtual columns such as scores or ranks must not depend on rows the policy excludes: a rank computed over the whole remote set reveals that hidden rows exist. When the connector cannot guarantee that, it returns `exact = false` with a `refusal_code` over `[a-z_]+`, such as `policy_unsupported` (anything else is reported as that one code).

**Bounded scans.** `IsBounded()` is true when the connector applies a candidate limit (top-k) remotely. A local filter above such a scan would change the answer, so exact lowering is mandatory and an inexact result is refused. An unbounded scan may answer `exact = false`: core keeps its own row filter above the scan. Register every table function that applies a remote candidate limit with `RegisterBoundedFunction(name)` before the database serves statements, whether or not its bind data is a `ProtectedScan`: a plan of a registered bounded function without a `ProtectedScan` is refused, which is what stops a later `post_bind` from swapping in other bind data. Core also registers the function of every bounded `ProtectedScan` it handles, but a function first planned through swapped bind data is covered only by your registration.

**Sealing.** Call `RequireSealed()` before any remote I/O; it throws a permission error when core never sealed the scan. In `FunctionData::Copy`, call `CopySealFrom(other)`, so a copy of a sealed scan stays sealed under the same digest.

The obligation's refusals start with `QoD: ` and carry no policy SQL, literal, identity value or backend text:

- `QoD: <refusal_code>: a row policy cannot be enforced before the connector's candidate limit`
- `QoD: a bounded connector scan without a policy obligation is not supported`
- `QoD: a connector scan without a table entry is not supported`
- `QoD: connector scan ran without a sealed policy obligation`
- `QoD: connector scan policy obligation could not be verified`
- `QoD: field_denied: a connector scan uses a column that has a column policy`

### Federated source types

A module contributes a source type by returning an `ai.starlake.quack.spi.FederatedSourceProvider` from `ManagerModule.federatedSourceProviders`. The manager reads the providers right after constructing the module, before `start()`, because restoring the pools renders sources before modules start.

```scala
trait FederatedSourceProvider:
  def wire: String                          // the sourceType value
  def extensionName: String                 // the DuckDB extension the node must have linked
  def reservedSecretPrefixes: List[String]  // secret names its SQL creates; sql sources may not use them
  def errors(source: FederatedSource, reserved: Set[String]): List[String]  // empty: may be stored
  def normalizedConfig(raw: String): Either[String, String]  // for equality, key order and spacing ignored
  def renderTemplate(source: FederatedSource, reserved: Set[String]): Either[List[String], String]
```

`wire` is lowercase `[a-z0-9_]+`, at most 32 characters, distinct from the built-in types (`sql`, `iceberg_rest`, `postgres`, `mysql`) and from every other provider's; otherwise the boot is refused (`module source types refused: ...`). `extensionName` is informational: core neither loads nor checks it. `reserved` holds the aliases the source may not take (the database's own catalog alias and its other sources'). Every method is pure and total.

A source of a plugin type stores the provider's config as raw JSON, sent in the `pluginConfig` field of the REST create (`config` stays for `iceberg_rest`, `connection` for `postgres` and `mysql`, and `setupSql` is refused), and created from the CLI with `qod federation create <tenant> <db> --alias <alias> --type <wire> --plugin-config '<json object>'`. A new plugin source is read-only unless the request says otherwise, like the other typed sources. Operators see the same sources as any other; see [Source types from manager modules](../operating/federation.md#source-types-from-manager-modules).

What the provider must do, since core cannot do it for it:

- **Hold no secret in the config.** The REST API echoes `pluginConfig` as stored, so credentials go in `{{secret.NAME}}` placeholders, and `errors()` should refuse a literal credential.
- **Refuse ambient credentials.** There is no superuser-only hook for plugin types: any tenant admin who may write sources can create one. `errors()` must refuse any config whose `ATTACH` would use the node's own credentials (environment, instance role, credential chain, local files) instead of the source's own secrets.
- **Quote what it renders.** The rendered SQL may contain `{{alias}}` and `{{secret.NAME}}`; core substitutes both, the provider never does. Core quotes only the secret values it substitutes, so the provider quotes and escapes (doubling every `'`) every `pluginConfig` value it renders: tenant admins control that config, and the node's init SQL runs with full privileges. A rendered `{{secret.NAME}}` outside a single-quoted literal leaves the source out of the node's setup (`PluginSecretUnquoted`, logged as a WARN), with no plain-token fallback as for `sql` sources; the database's other sources still attach.

A stored plugin source whose provider is not loaded (the module is absent at boot) is left out of the node's setup with a `SourceProviderMissing` WARN; its siblings are unaffected.

## Tests

The routing core and classifier have focused specs (`RouterSpec`, `StatementClassifierSpec`, `FlightSqlRouterSpec`) that run without a live Flight connection, so a new backend or provider can be unit-tested against the same seams. Run the suite with `sbt test`; see the [Development loop](./dev-loop.md).
