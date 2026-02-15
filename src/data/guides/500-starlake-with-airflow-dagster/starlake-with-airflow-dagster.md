---
title: "Starlake with Airflow / Dagster"
id: "starlake-with-airflow-dagster"
level: "Beginner"
icon: "starlake"
tags: ["Starlake", "Setup"]
description: "Learn how to run the full Starlake platform locally using Docker and Docker Compose."
hide_table_of_contents: true
---

## Starlake on Docker
  
This setup runs Starlake using Docker Compose with all required services pre-configured.  
It is ideal for developers and data engineers who want a ready-to-use environment without manually installing databases or backend services.

The Starlake core project is open source and available at **starlake-ai/starlake**.

You may install Starlake on-premises or in the cloud.  
This guide explains how to run Starlake locally on your workstation using Docker Compose.

## Prerequisites

Before starting, ensure Docker is installed.

You can check using a :
```bash
docker --version
docker compose version
```
## Clone the Starlake Repository

Clone the Starlake repository and navigate to the Docker environment:
```bash
git clone https://github.com/starlake-ai/starlake.git
cd starlake/docker
```

## Start the Starlake Platform

To start the entire platform, run:
```bash
docker compose up -d
```

This will:

1. Pull required images
2. Build custom Starlake components
3. Initialize the internal metadata database
4. Start all services (UI, API, proxy, storage, orchestration)

You can check running services with:
```bash
docker ps
```

## Access the User Interface

Once containers are running, open the Starlake UI:
```bash
http://localhost:8080
```

## Summary

Starlake stores project data inside a Docker volume:

```bash
starlake_projects_data
```

This volume contains all project folders, for example:
```bash
/app/starlake/projects/
 ├── 100/
 ├── 101/
 ├── 102/
 ```

Each project directory contains:

```bash
datasets/
metadata/
output/
test-reports/
README.md
```

To inspect the volume:

```bash
docker volume inspect starlake_projects_data
```

To browse inside the container:

```bash
docker exec -it starlake-projects ls /app/starlake/projects
```

## Stop or Restart the Platform

To stop the running environment:
```bash
docker compose down
```

To stop and remove all volumes (including project data):
```bash
docker compose down -v
```

To rebuild the images:
```bash
docker compose build
```

## Cleaning Up Disk Space

Docker can accumulate large caches over time.
Here is how to clean unused items.

Remove unused images :
```bash
docker image prune -a
```

Remove stopped containers :
```bash
docker container prune
```

Remove unused volumes (careful: may delete Starlake projects) :
```bash
docker volume prune
```

Remove only Starlake project data :
```bash
docker volume rm starlake_projects_data
```

## Troubleshooting

Since UI does not give you access to "Backend" here is how to fix common issue

Check logs using :
```bash
docker logs starlake-proxy --tail=50
docker logs starlake-ui --tail=50
```

If Database marked as unhealthy run :
```bash
docker inspect --format='{{.State.Health.Status}}' starlake-db
```

If now healthy, restart :
```bash
docker compose down
docker compose up -d
```

If port 8080 already in use edit the docker-compose.yml :
```bash
ports:
  - "9090:8080"
```