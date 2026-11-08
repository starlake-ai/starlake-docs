---
id: starflow
title: Run Starflow with QoD
sidebar_label: Starflow
description: "Run Starflow next to Quack on Demand on any deployment: a native install, a single Docker container, a fleet or Kubernetes. What the pairing needs, and the steps for each setup."
keywords: ["starflow", "starlake", "workbench", "sso", "qod start --with-starflow", "docker", "kubernetes", "fleet"]
---

[Starflow](/starflow/overview) (the Starlake API and UI) runs beside the QoD manager and is paired with it. The admin UI's [Workbench](./admin-ui.md#workbench) entry opens Starflow already signed in, and Starflow queries the gateway as the signed-in QoD user, with that user's own grants.

Starflow talks to the manager only, over its REST port and its FlightSQL edge. Where the nodes run makes no difference, so the pairing is the same on every setup. Only the way you start Starflow changes.

| Your QoD setup | How to run Starflow |
|---|---|
| Native install, local or single server | [`qod start --with-starflow`](#native-install) |
| Single Docker container | [The Compose `starflow` profile](#single-docker-container) |
| Fleet | [Beside the manager](#fleet) |
| Kubernetes | [Your own Deployment](#kubernetes) |
| Anything else | [Set the pairing by hand](#what-the-pairing-needs) |

## What the pairing needs

`qod start --with-starflow` and the Compose profile set all of this for you. Set it yourself on any other setup.

### One shared secret

The manager signs its sessions with one secret, and Starflow receives the same secret to mint the tokens it presents to the gateway. Generate it once and keep it stable, or SSO and Starflow's calls to the manager break at the next restart:

```bash
openssl rand -hex 48
```

Whoever holds this secret can sign a QoD session, so protect it like an administrator credential. No static API key is part of the pairing. Do not set `QOD_API_KEY` on Starflow: an older Starflow holding one sends it instead of the user's session.

### On the manager

| Variable | Value |
|---|---|
| `SL_ENABLED` | `true`. Turns on the Workbench entry and the SSO endpoints |
| `SL_URL` | Starflow's browser-facing URL. `SL_ENABLED` has no effect while this is empty |
| `QOD_SESSION_JWT_SECRET` | The shared secret |
| `JWT_SECRET_KEY` | The shared secret again. It turns on the edge's bearer provider, which verifies the session Starflow presents |

A user reaching the edge through Starflow gets the grants of their own user row, with no token role or group.

### On Starflow

| Variable | Value |
|---|---|
| `QOD_ENABLED` | `true` |
| `QOD_URL` | The manager's REST URL as Starflow reaches it, for example `http://manager-host:20900` |
| `QOD_FLIGHT_URL` | The FlightSQL edge as Starflow reaches it, for example `https://manager-host:31338`. Use `http://` when the edge's TLS is off |
| `QOD_TLS_INSECURE` | `true` for an edge with a self-signed certificate, which is what `--with-starflow` and the Compose profile set |
| `QOD_UI_URL` | The manager's browser-facing URL followed by `/ui` |
| `JWT_SECRET_KEY` | The shared secret |
| `SL_API_HTTP_PORT` | Starflow's HTTP port, `9900` by default |
| `SL_API_HTTP_FRONT_URL` | Starflow's browser-facing URL, the same as `SL_URL` |
| `SL_API_DOMAIN` | The host of that URL |
| `SL_API_ORCHESTRATOR_URL` | That URL followed by `/airflow/` |
| `SL_API_JDBC_URL`, `SL_API_JDBC_USER`, `SL_API_JDBC_PASSWORD`, `SL_API_JDBC_DRIVER` | Starflow's metadata database. The driver is `org.postgresql.Driver` |

### Network paths

| From | To | Purpose |
|---|---|---|
| Browser | `SL_URL` and `QOD_UI_URL` | The two UIs and the SSO handoff |
| Starflow | Manager REST, port `20900` | Lists the pools a user may reach, with that user's session |
| Starflow | FlightSQL edge, port `31338` | Runs queries |
| Manager | `SL_URL` | Tells Starflow a user logged out. This is best effort: a failure is only logged |

So `SL_URL` must work from the browser and from the manager.

### Storage

Starflow keeps its metadata in a Postgres database, named `starlake` on the setups below. QoD's own Postgres server can host it. On a setup you wire by hand, create that database first. Its projects and generated DAGs are files: keep `/app/starlake/projects` and `/app/starlake/dags` on persistent storage when you run the container.

## Native install

On a local machine or a single server, add one flag:

```bash
qod start --with-starflow
```

The first run installs Starflow, several hundred MB, and later runs reuse it. It uses a `starlake` database on the manager's Postgres server, and stores the shared secret in the `qod` configuration so that SSO survives a restart. Ctrl-C and `qod stop` stop Starflow with the manager.

The flag needs to launch the manager itself, so stop a running one first with `qod stop`. It is not supported on Windows. `qod start --demo` refuses it, and `qod serve --demo --with-starflow` keeps Starflow's state on H2 in a folder deleted on exit.

| Flag | Default | Purpose |
|---|---|---|
| `--starflow-home` | `STARLAKE_HOME`, then `~/starlake` when installed, then the `qod` cache | Install directory |
| `--starflow-version` | `STARFLOW_VERSION`, then the latest release | Release to install when none is found |
| `--starflow-port` | `SL_API_HTTP_PORT`, then `9900` | HTTP port |
| `--starflow-url` | `SL_URL`, then `http://localhost:<port>` | Browser-facing URL, for clients on other machines |
| `--starflow-env-file` | `STARFLOW_ENV_FILE` | `KEY=VALUE` file applied to Starflow only. The values that pair it with the manager override this file |

For clients on other machines, set `--starflow-url` and the manager's `QOD_PUBLIC_BASE_URL`. Under systemd, add the flag to the `ExecStart` line of the [`qod` unit](./deploy-single-server.md), with `--starflow-version` so that a fresh install stays on a known release.

## Single Docker container

Turn on the `starflow` Compose profile:

```bash
STARFLOW_ENABLED=true ./scripts/docker/run-docker-compose.sh
```

The wrapper generates the shared secret, builds the Starflow image and creates its database. [Docker Compose deployment](./deploy-docker.md#starflow) has the plain `docker compose` variant and every setting.

## Fleet

Fleet servers need nothing: they run nodes, and Starflow never connects to them. Run Starflow where the manager runs.

- **Manager installed natively:** start it with `qod start --with-starflow`, as in [Native install](#native-install).
- **Manager in a container:** add the profile to the [fleet Compose files](./deploy-docker.md#fleet-mode-manager-and-workers-as-containers), with `STARFLOW_ENABLED=true`, `COMPOSE_PROFILES=starflow` and `SESSION_JWT_SECRET` in `.env`:

  ```bash
  docker compose -f docker-compose.yml -f docker-compose.fleet.yml --profile seaweedfs --profile starflow up -d --build
  ```

With several managers, run one Starflow, give every manager the same four [manager variables](#on-the-manager), and point `QOD_URL` and `QOD_FLIGHT_URL` at the address that fronts them.

## Kubernetes

The Helm chart does not deploy Starflow. Run it as a Deployment of your own, in the release's namespace, and turn the pairing on through the chart's values. The examples use a release named `qod`, whose Services are `qod-quack-on-demand` (REST) and `qod-quack-on-demand-flightsql` (FlightSQL).

**1. Build the image and push it to your registry.** The published `starlakeai/starlake-*-api` images carry the API without the UI, so build `docker/starflow` from the [QoD repository](https://github.com/starlake-ai/quack-on-demand):

```bash
docker build --build-arg STARFLOW_VERSION=1.8.8 -t registry.example.com/qod-starflow:1.8.8 docker/starflow
docker push registry.example.com/qod-starflow:1.8.8
```

**2. Create the metadata database** on a Postgres server the cluster can reach:

```sql
CREATE DATABASE starlake;
```

**3. Create the Secret** that holds the shared secret and the Postgres password:

```bash
SECRET=$(openssl rand -hex 48)
kubectl create secret generic starflow-qod \
  --from-literal=sessionJwtSecret="$SECRET" \
  --from-literal=pgPassword='<postgres password>'
```

**4. Turn the pairing on in the manager.** Add this to your values file:

```yaml
existingSessionJwtSecret: starflow-qod
env:
  SL_ENABLED: "true"
  SL_URL: https://starflow.example.com
```

Then upgrade the release, passing the secret on the command line to keep it out of the values file:

```bash
helm upgrade qod oci://ghcr.io/starlake-ai/charts/quack-on-demand -f values.yaml \
  --set-string env.JWT_SECRET_KEY="$SECRET"
```

The chart reads `env` values as plain text, so `JWT_SECRET_KEY` is visible in the Deployment's spec. Limit who can read Deployments in this namespace.

**5. Deploy Starflow.** Adjust the image, the URLs and the Postgres coordinates, and expose the Service through your Ingress at `SL_URL`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: starflow
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 10Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: starflow
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: starflow
  template:
    metadata:
      labels:
        app: starflow
    spec:
      containers:
        - name: starflow
          image: registry.example.com/qod-starflow:1.8.8
          ports:
            - containerPort: 9900
          env:
            - { name: QOD_ENABLED, value: "true" }
            - { name: QOD_URL, value: "http://qod-quack-on-demand:20900" }
            - { name: QOD_FLIGHT_URL, value: "https://qod-quack-on-demand-flightsql:31338" }
            - { name: QOD_TLS_INSECURE, value: "true" }
            - { name: QOD_UI_URL, value: "https://qod.example.com/ui" }
            - name: JWT_SECRET_KEY
              valueFrom:
                secretKeyRef: { name: starflow-qod, key: sessionJwtSecret }
            - { name: SL_API_HTTP_PORT, value: "9900" }
            - { name: SL_API_HTTP_FRONT_URL, value: "https://starflow.example.com" }
            - { name: SL_API_DOMAIN, value: "starflow.example.com" }
            - { name: SL_API_ORCHESTRATOR_URL, value: "https://starflow.example.com/airflow/" }
            - { name: SL_API_JDBC_URL, value: "jdbc:postgresql://postgres.example.com:5432/starlake" }
            - { name: SL_API_JDBC_USER, value: "postgres" }
            - name: SL_API_JDBC_PASSWORD
              valueFrom:
                secretKeyRef: { name: starflow-qod, key: pgPassword }
            - { name: SL_API_JDBC_DRIVER, value: "org.postgresql.Driver" }
          readinessProbe:
            httpGet:
              path: /api/v1/health
              port: 9900
            initialDelaySeconds: 30
            periodSeconds: 10
          volumeMounts:
            - { name: data, mountPath: /app/starlake/projects, subPath: projects }
            - { name: data, mountPath: /app/starlake/dags, subPath: dags }
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: starflow
---
apiVersion: v1
kind: Service
metadata:
  name: starflow
spec:
  selector:
    app: starflow
  ports:
    - port: 9900
      targetPort: 9900
```

Set `QOD_FLIGHT_URL` to `http://` when `flightsql.tls.enabled` is `false`.

With `networkPolicy.enabled`, a non-empty `networkPolicy.ingressFrom` must also admit the Starflow pod, or it cannot reach the manager.

## Check the pairing

1. `curl <SL_URL>/api/v1/health` answers.
2. The admin UI shows a **Workbench** entry, and it opens Starflow signed in.
3. Create a project on a QoD connection, signed in as a tenant admin. A superuser cannot create a QoD project in Starflow.

| Symptom | Check |
|---|---|
| No Workbench entry | `SL_ENABLED` and `SL_URL` on the manager, then restart it |
| Sign-in or Starflow's calls to the manager fail | The manager's `QOD_SESSION_JWT_SECRET` and `JWT_SECRET_KEY` and Starflow's `JWT_SECRET_KEY` must be the same value |
| It worked until a restart | The shared secret was regenerated: pin it on both sides |
| Starflow cannot reach QoD | `QOD_URL` and `QOD_FLIGHT_URL` must work from where Starflow runs, with `https://` when the edge's TLS is on |
