---
slug: starlake-iceberg
title: Starlake Iceberg integration
authors:
    - hayssams
tags:
    - iceberg
    - starlake
    - duckdb
    - spark
---

## Introduction

This is a quick explanation on how to use Starlake to load data into Iceberg and how to use Iceberg tables to run transformations with Starlake.
To make sure it works, we will query those tables with duckdb.

## Project setup

We will use the `starlake bootstrap` command to create a new project.

```bash
$ mkdir starlake-iceberg
$ cd starlake-iceberg
$ starlake bootstrap
```

This will create a new project with a default configuration.

Let's update the application.sl.yml file to use iceberg. We do not need to include any library since iceberg jars are distributed with Starlake.

```yaml
application:
  defaultWriteFormat: iceberg
  spark:
    sql.extensions: "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions"
    sql.catalog.spark_catalog: org.apache.iceberg.spark.SparkSessionCatalog
    sql.catalog.spark_catalog.type: hadoop
    sql.catalog.local: org.apache.iceberg.spark.SparkCatalog
    sql.catalog.local.type: hadoop
    sql.catalog.spark_catalog.warehouse: "{{SL_ROOT}}/warehouse"
    sql.catalog.local.warehouse: "{{SL_ROOT}}/warehouse"
    sql.defaultCatalog:  local
```

iceberg metadata is stored in the `warehouse` folder.

By default, Starlake will use the duckdb connection. Let's define a new connection for iceberg. Create the file env.ICEBERG.sl.yml in the metadata directory, with the following content:

```yaml
version: 1
env:
  activeConnection: spark_local
```

## Loading data into Iceberg

The bootstrap comes with sample files. We just need to run the following command to load the data into iceberg.

```bash
$ export SL_ENV=ICEBERG # to use definitions in the env.ICEBERG.sl.yml file
$ starlake autoload
```

That's it! We have loaded the data into iceberg.

## Run transformations with Starlake on Iceberg tables

Let's create a new transformation.

```bash
$ mkdir metadata/transform/kpi
$ touch metadata/transform/kpi/revenue_summary.sql
```

Edit the file metadata/transform/kpi/revenue_summary.sql with the following content:

```sql
SELECT
    o.order_id,
    o.timestamp AS order_date,
    SUM(ol.quantity * ol.sale_price) AS total_revenue
FROM
    starbake.orders o
    JOIN starbake.order_lines ol ON o.order_id = ol.order_id
GROUP BY
    o.order_id, o.timestamp 
```

Let's first preview the results of the transformation.

```bash
$ starlake transform  --name kpi.revenue_summary --interactive table
```

```
+--------+-----------------------+------------------+
|order_id|             order_date|     total_revenue|
+--------+-----------------------+------------------+
|      40|2024-02-11 06:49:28.665|             68.24|
|       8|2024-01-23 20:47:53.667|              8.68|
|      27|2024-02-26 01:12:45.282|              30.0|
|      46|2024-02-10 18:27:05.732|              45.0|
|      56|2024-01-30 07:33:08.621|              75.0|
|      35|2024-01-17 00:30:21.277|             18.18|
|       3|2024-02-10 23:10:30.685|             16.84|
|      54|2024-02-05 08:03:21.197|            115.64|
|      48|2024-02-17 10:05:36.367|             17.06|
|      45|2024-01-16 04:21:01.494|             45.44|
|      98| 2024-01-16 10:47:28.92|             72.72|
|      78| 2024-01-07 07:48:02.53|              45.0|
|  ...
+--------+-----------------------+------------------+
```

Now, let's run the transformation.

```bash
$ starlake transform  --name kpi.revenue_summary
```

You should see the loaded data in the iceberg tables and the transformation results in the `kpi.revenue_summary` iceberg table. The structure is the following:

```
warehouse/
├── audit
│   ├── audit
│   └── rejected
├── kpi
│   └── revenue_summary
└── starbake
    ├── order_lines
    ├── orders
    └── products
```

## Querying data
To query the data, we can use duckdb.

```bash
$ duckdb
v1.1.1 af39bd0dcf
Enter ".help" for usage hints.
Connected to a transient in-memory database.
Use ".open FILENAME" to reopen on a persistent database.

> INSTALL iceberg
> LOAD iceberg
```

```SQL
> WITH o as (
    SELECT * FROM iceberg_scan('warehouse/starbake/orders')
),
ol as (
    SELECT * FROM iceberg_scan('warehouse/starbake/order_lines')
)
SELECT
    o.order_id,
    o.timestamp AS order_date,
    SUM(ol.quantity * ol.sale_price) AS total_revenue
FROM
    o
    JOIN ol ON o.order_id = ol.order_id
GROUP BY
    o.order_id, o.timestamp;
```


That's it! We have queried the data from iceberg using duckdb.

Full code is available [here](https://github.com/starlake-io/starlake/tree/main/examples/iceberg).















