---
id: extending
title: Extending the manager
description: "Extend QoD with a new runtime backend or a new authentication provider through the two seams designed for it."
keywords: ["extending", "runtime backend", "authentication provider", "plugin", "manager module", "platform permissions", "console pages"]
---

Two seams are designed to be extended: the runtime backend (where Quack nodes run) and the authentication providers (how clients prove who they are). Both follow the same shape, a small interface with one implementation per strategy, selected from configuration at boot (`Main.scala` and `boot/`). See the [Architecture map](/qod/contributing/architecture-map) for where these sit. A third seam, the manager module, adds routes, permissions and console pages from a jar on the classpath; see [Manager modules](#manager-modules-platform-permissions-and-console-pages).

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

## Tests

The routing core and classifier have focused specs (`RouterSpec`, `StatementClassifierSpec`, `FlightSqlRouterSpec`) that run without a live Flight connection, so a new backend or provider can be unit-tested against the same seams. Run the suite with `sbt test`; see the [Development loop](/qod/contributing/dev-loop).
