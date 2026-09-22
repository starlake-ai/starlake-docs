---
id: iceberg
title: External Iceberg catalogs
---

An external Iceberg REST catalog attaches to a database as a **typed** federated source: you
declare the endpoint, the warehouse and the auth mode as fields, and QoD renders the `ATTACH`
itself. Its tables are then queryable in the same session, and under the same
[access control](rbac-model.md), as native DuckLake tables. The catalog and the bucket stay where
they are: no copy, no conversion.

This is the typed alternative to writing the `ATTACH` by hand as a `sql` source. See
[Federation](federation.md) for the free-form path, the secret model and the lifecycle rules that
apply to both.

## What QoD does, and what DuckDB does

Most of the work belongs to the DuckDB `iceberg` extension, and knowing the split explains several
behaviours below.

DuckDB performs the OAuth2 client-credentials exchange and refreshes the token itself, and it
requests per-table vended credentials from the catalog as part of loading a table. **QoD does not
proxy either.** It holds no access tokens and, for a catalog that vends credentials, no storage
keys.

What QoD adds is a validated declaration of the catalog, resolution of its secrets at node spawn,
a per-catalog write kill switch, and reporting when an attach fails.

One consequence runs through the rest of this page: **all four auth modes authenticate once, at
`ATTACH`, during node spawn**, not per query. There is no per-statement authentication cost, and
equally no per-statement chance to recover.

## Declaring a catalog

```bash
qod federation create acme acme_lake --alias sales_lake \
  --type iceberg-rest \
  --uri https://catalog.example.com/api/catalog \
  --warehouse sales \
  --auth oauth2 \
  --client-id qod_reader \
  --client-secret '{{secret.SALES_CLIENT_SECRET}}' \
  --oauth2-scope 'PRINCIPAL_ROLE:qod_reader'

qod federation secret set acme acme_lake sales_lake \
  --name SALES_CLIENT_SECRET --value "$SALES_CLIENT_SECRET"
```

`qod federation create` upserts: re-running it against the same alias edits the source in place.
Over REST it is the same `POST .../federated-sources` as a `sql` source, with
`"sourceType": "iceberg_rest"` and the fields carried in a `config` object. The MCP tool
`upsert_federated_source` takes the same fields (`source_type`, `config`, `read_only`), and the
admin UI's federation section offers "Iceberg (REST catalog)" as a source type with a typed form.

In the admin UI and over REST the whole config can also be supplied as one JSON object; the CLI
takes `--config '<json>'`, which wins over the individual flags.

### Fields

| Field | CLI flag | Applies to | Note |
|---|---|---|---|
| `warehouse` | `--warehouse` | all | Required. Becomes the `ATTACH` target. |
| `uri` | `--uri` | all | The REST endpoint. Required whenever `authType` is set. |
| `authType` | `--auth` | `none`, `oauth2`, `token`, `sigv4` | Exactly one of `authType` / `endpointType`. |
| `endpointType` | `--endpoint-type` | `glue`, `s3_tables` | Exactly one of `authType` / `endpointType`. |
| `clientId` | `--client-id` | `oauth2` | Required. May be a literal. |
| `clientSecret` | `--client-secret` | `oauth2` | Required. Must be a `{{secret.NAME}}` placeholder. |
| `oauth2ServerUri` | `--oauth2-server-uri` | `oauth2` | Optional. |
| `oauth2Scope` | `--oauth2-scope` | `oauth2` | Optional. |
| `oauth2GrantType` | `--oauth2-grant-type` | `oauth2` | Optional. |
| `token` | `--token` | `token` | Required. Must be a `{{secret.NAME}}` placeholder. |

**`authType` and `endpointType` are mutually exclusive, and one of them is required.** DuckDB
refuses `AUTHORIZATION_TYPE` combined with `ENDPOINT_TYPE`, so setting both, or neither, is a
`400 invalid_federated_source` naming the rule:

```
set exactly one of authType / endpointType (DuckDB refuses AUTHORIZATION_TYPE combined with ENDPOINT_TYPE)
```

Each auth mode rejects the fields that do not belong to it rather than ignoring them. `token` is
refused under `authType oauth2`, `clientId` / `clientSecret` are refused under `authType token`,
and `none`, `sigv4`, `glue` and `s3_tables` take no credential fields at all.

`sigv4` is for a REST catalog that signs with AWS credentials directly, and needs an S3 secret
carrying a region to be resolvable on the node. Glue and S3 Tables select their own signing and are
reached through `endpointType` instead.

### Alias rules

The alias is normalized at write time: lowercased, 1 to 63 characters, an identifier pattern
(letters, digits, underscore, not starting with a digit). This applies to every federated source,
`sql` ones included.

An alias is rejected as reserved when it collides with a DuckDB built-in (`memory`, `system`,
`temp`), with the database's own catalog alias, or with another federated source on the same
database. The reason is worth knowing, because the failure it prevents is silent: a duplicate
`ATTACH` fails on the node, the node comes up anyway, and the catalog is simply absent.

An alias already in use by a source of the **other** type is refused rather than converted:

```
alias 'sales_lake' already exists as a 'sql' source; delete it before creating a 'iceberg_rest' source with the same alias (reserved)
```

## Credentials

`clientSecret` and `token` **must** be written as `{{secret.NAME}}` placeholders. A literal value is
refused with a `400` **when the source is saved**, not later at node spawn:

```
clientSecret must be a secret placeholder of the form {{secret.NAME}}, not a literal value
```

The placeholder resolves against the source's own secrets, set with `qod federation secret set`,
exactly as a `{{secret.NAME}}` in hand-written `setupSql` does. That is what makes the stored
config safe to return over the REST API unredacted, and it keeps the real value out of shell
history and CI logs.

`clientId` is deliberately not constrained: a client id is routinely not sensitive, and operators
set it inline. `uri`, `warehouse`, `clientId` and the three `oauth2*` fields may each carry a
well-formed placeholder embedded anywhere in a larger value, but a stray or malformed `{{` in any
of them is rejected, because it would survive into the rendered SQL and fail the database's whole
federation block.

See [Federation](federation.md#secrets) for the secret backends and for why authoring an
`externalRef` secret requires a superuser session.

## What gets rendered

QoD renders one block per source at node spawn, with the secret values substituted in. For the
example above:

```sql
INSTALL iceberg; LOAD iceberg;
CREATE OR REPLACE SECRET "qod_ice_sales_lake" (
  TYPE ICEBERG,
  CLIENT_ID 'qod_reader',
  CLIENT_SECRET '...',
  OAUTH2_SCOPE 'PRINCIPAL_ROLE:qod_reader',
  ENDPOINT 'https://catalog.example.com/api/catalog'
);
ATTACH 'sales' AS "sales_lake" (
  TYPE ICEBERG,
  SECRET "qod_ice_sales_lake",
  ENDPOINT 'https://catalog.example.com/api/catalog',
  READ_ONLY
);
```

Two details are easy to get wrong when writing the equivalent by hand:

- **For `oauth2`, `ENDPOINT` must also sit inside the secret.** DuckDB derives the OAuth2 token
  endpoint (`<endpoint>/v1/oauth/tokens`) from the **secret's** `ENDPOINT`, not from the `ATTACH`'s.
  With no explicit `oauth2ServerUri` and no `ENDPOINT` on the secret, the `ATTACH` fails before any
  network call, with `no 'oauth2_server_uri' was provided, and no 'endpoint' was provided to fall
  back on`. The `ATTACH` carries its own `ENDPOINT` as well, for catalog operations; the two are
  textually identical and semantically distinct.
- **`none` and `sigv4`, and both endpoint types, mint no secret at all.** Only `oauth2` and `token`
  carry a credential, and both carry it on the `ICEBERG` secret with no `AUTHORIZATION_TYPE`
  option, since DuckDB defaults that option to `oauth2` and a token-bearing secret satisfies it
  without performing an exchange.

The secret is named `qod_ice_<alias>` inside the node's DuckDB session.

## Read-only

A new `iceberg_rest` source is **read-only by default**: an external catalog is one QoD does not
own. Pass `--no-read-only` (REST `"readOnly": false`) to make it writable. A `sql` source keeps its
previous behaviour and defaults to writable, and every source that existed before this feature
stays writable.

Read-only is enforced in two layers.

1. **In the engine.** `READ_ONLY` goes onto the `ATTACH` QoD renders, so DuckDB itself refuses the
   write, above the extension and below SQL parsing:

   ```
   Cannot execute statement of type "INSERT" on database "sales_lake" which is attached in read-only mode!
   ```

2. **At the edge.** `CatalogWriteScreen` runs in the statement pipeline, right after the ACL gate,
   on the FlightSQL edge and the native Quack front door alike. It parses each statement and denies
   any write or DDL it resolves against a read-only alias.

The second layer is defence in depth, not the primary gate. The primary gate is still the RBAC
graph: a principal with no `RW` or `DDL` grant on `sales_lake.*.*` cannot write there whatever this
flag says. The edge screen is also the **only** enforcement available for `sql` sources, whose
`ATTACH` text QoD does not author.

A denied write names the catalog:

```
catalog 'sales_lake' is read-only on this deployment (write target: sales_lake.main.orders)
```

:::caution The edge screen fails closed pool-wide
While **any** source on a database is read-only, every write on that pool must be fully parseable
and fully qualified, or it is refused. This includes writes against other, writable, attached
catalogs: `INSERT INTO other_db.orders VALUES (1)` is refused as unresolvable, because the parser
cannot tell a catalog head from a schema head in a two-part name. Statements the parser has no arm
for at all (`ATTACH`, `DETACH`, `CREATE SECRET`, `COPY`, `GRANT`) are refused pool-wide for the
same reason, as are `PREPARE` and `EXECUTE`. This is intended fail-closed behaviour, but expect it
pool-wide before flipping the flag on one source.
:::

**Flipping the flag does not change running nodes.** The engine-level layer binds at `ATTACH`, so
it takes effect for nodes spawned after the change. The edge screen picks the new value up within
about 60 seconds. So `false` to `true` briefly leaves only the edge screen standing, and `true` to
`false` leaves the catalog engine-read-only, with raw DuckDB read-only-mode errors rather than the
screen's message, until the pool recycles. Recycle the pool to make either direction whole.

## Attach failures, and how they surface

A failed `ATTACH` **does not stop a node booting**. The node's init SQL is piped into DuckDB
without bail, so the error goes to the node's stderr and startup continues to `quack_serve`. The
node then passes its health probe and is routed to like any other, with the catalog simply absent.
The only symptom a user sees is `Catalog 'sales_lake' does not exist`, which reads as a typo rather
than as a rotated secret or an unreachable catalog.

That is why attach status is reported. On each health tick, until every declared alias is present,
the manager lists the node's attached catalogs, diffs them against the enabled `iceberg_rest`
aliases declared for the pool, and re-issues **that one source's** block for each missing alias.
This heals and diagnoses at once: a catalog that has come back attaches with no node restart, and
one that has not yields the real DuckDB error.

Where to look:

- `qod federation list` / `get` report `attachStatus` per source: `attached`, `unknown`, or
  `failed on 2 of 3 nodes`. It is filled in for enabled `iceberg_rest` sources only.
- The admin UI's federation section shows that status on the source, as a badge whenever it is
  anything other than `attached`.
- Each node entry of the pool response (`qod pool list`) carries `catalogAttachFailures`, each
  failure naming the alias, the DuckDB error, a timestamp and an attempt count.
- A WARN in the manager log names tenant, database, pool, node, alias and the error.

The retry backs off per node and alias, starting at the health-tick interval and doubling to a
five-minute ceiling, and the WARN is emitted when a failure is new or its text changes, not on
every tick. So a permanently broken catalog costs one log line, not one per tick. The trade-off:
a source added to a pool while it is in backoff is picked up when the current window ends, never
later than five minutes.

Attach state is in-memory and per manager replica. It is not persisted, since it describes live
process state, and a manager restart re-probes every node anyway.

**A source that fails to attach is reported, never auto-disabled.** Disabling is an operator
decision, and a transient catalog outage must not mutate control-plane state.

One failure can never heal on its own and says so:

```
alias 'x' collides with the tenant-db's own catalog alias: the tenant-db is already attached under that name, so this source can never attach -- rename the source's alias
```

That shape is reachable through manifest import, which writes source rows directly and so does not
get the collision check the REST path applies.

## Access control

Iceberg tables go through the same pipeline as DuckLake tables and need no special grants. A role
permission on `sales_lake.main.orders`, or on `sales_lake.*.*`, authorizes exactly as it would for
a native table, with the same `RO` / `RW` / `DDL` verbs. See
[Granting access to federated tables](federation.md#granting-access-to-federated-tables).

Three-part references (`alias.schema.table`) resolve because the alias is in the parser's
attached-catalog set. A two-part reference whose first part is an attached catalog is denied as
ambiguous; see
[Table name resolution](/qod/administration/access-control#table-name-resolution).

## Manifest

`sourceType`, `config` and `readOnly` round-trip through
[manifest export and import](manifest.md), so an exported catalog re-imports attachable and with
its read-only setting intact. Note that `config` is exported **verbatim**, and read
[Sensitivity of an export](manifest.md#sensitivity-of-an-export) before sharing a manifest that
carries one. A stale manifest can also downgrade a typed source back to a writable `sql` one; that
is covered in the same page under
[Replaying an old manifest over an Iceberg source](manifest.md#replaying-an-old-manifest-over-an-iceberg-source).

## Known limitations

- **Nested namespaces do not map.** Iceberg allows multi-level namespaces; DuckDB has exactly one
  schema level under a catalog. A table in namespace `a.b` is not addressable as
  `alias.a.b.table`, and no flattening is attempted.
- **Iceberg commits carry no QoD author.** DuckLake writes are stamped with
  `tenant:x/user:y` in the catalog itself; the Iceberg extension exposes no commit-message
  equivalent, so a commit made through QoD carries no QoD attribution inside the catalog. QoD-side
  attribution is unaffected: the statement history and the audit journal record principal, pool,
  node, statement and classification for every statement whatever catalog it touched.
- **No branching on Iceberg.** [Branching](branching.md) is DuckLake-only. Branch, propose and
  merge are written against DuckLake catalog tables and have no Iceberg-native implementation.
- **A catalog is required to write.** Only attached REST catalogs are writable; scanning raw
  storage cannot commit new table metadata.
- **Running or hosting a catalog is out of scope**, as are non-REST catalogs (Hive, Hadoop, JDBC),
  table maintenance (compaction, snapshot expiry, orphan cleanup), converting tables between
  DuckLake and Iceberg, and transactions spanning several catalogs.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `400 invalid_federated_source` on create, naming a placeholder | `clientSecret` or `token` was given a literal value | Store it as a secret and pass `{{secret.NAME}}` |
| `400` naming `authType / endpointType` | Both were set, or neither | Set exactly one |
| `400 alias '...' is reserved` | The alias collides with the database's own catalog, a sibling source, or `memory` / `system` / `temp` | Rename the source's alias |
| Client sees `Catalog 'x' does not exist`, pool looks healthy | The `ATTACH` failed at node spawn | Read `attachStatus` on the source and `catalogAttachFailures` on the node for the real DuckDB error |
| `attachStatus` stuck on a collision message | The alias equals the database's own catalog alias, written through a manifest import | Rename the source's alias; it can never attach |
| `Could not get token from ...` | OAuth2 credentials rotated or revoked, or the token endpoint is unreachable | Update the secret, then wait for the next probe to re-attach, or recycle the pool |
| A write against a writable catalog is refused as unresolvable | Another source on the same database is read-only, so the edge screen fails closed pool-wide | Fully qualify the write as `catalog.schema.table`, or clear the read-only flag and recycle |
| Writes still refused after clearing the read-only flag | `READ_ONLY` is on the running nodes' `ATTACH` | Recycle the pool |
