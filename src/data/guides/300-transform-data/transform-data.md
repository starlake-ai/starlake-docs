---
title: "Transform data to insights"
id: "starlake-transform-data"
level: 'Beginner'
icon: 'starlake'
tags: ['Starlake', "Transform"]
hide_table_of_contents: true
description: "Learn how to transform data into insights."
---



## Create a domain (Optional)


A domain is a logical grouping of your data assets in Starlake. It maps to a schema in your database also known as a dataset in BigQuery. If you don't have a domain yet, you can create one or use an existing one if you already created it in Starlake.

This schema will be created when executing your transform if it does not already exist.

1. In your Starlake project, navigate to the "Transform" section.
2. Click on "Add Domain" and enter a domain name. If this domain already exists in the database, it will be mapped to the existing schema. We'll name our domain, "starbake_analytics". 
3. You may optionally add a description your domain. This is useful for documentation purposes and for AI assistance. This description will be saved in the database as a comment.
4. Click "Create" to finalize the domain creation.

![](/img/guides/transform-data/step1.png)

We are now ready to write our first insight in the schema "starbake_analytics" of our database.

## Create your first insight

1. Select the domain "starbake_analytics".
2. Click the "Add Insight" button.
3. Enter a name for your insight.
4. Click "Create" to finalize the insight creation.
5. In the "Code editor", write your SQL query to transform the data and generate insights.
6. Click "Run" to execute your query and view the results.
7. Review the results and make any necessary adjustments to your query.

![](/img/guides/transform-data/step2.png)


## Materialize your insights

Once you are satisfied with your SQL query and the results it produces, you can materialize your insights by creating a new table in your database.

In the "Write Strategy" section, select one of the following options:
- APPEND: Data will be appended to the target table
- OVERWRITE: Data will replace the existing data in the target table if it exists
- SCD2 (Slow Changing Dimension) : Data will be merged into the target table based on a key column and timestamps columns to keep historical data
- ...

![](/img/guides/transform-data/step3.1.png)

1. In the "Code Editor", click the "Run" drop-down and "Materialize" option.
2. Starlake will execute your query and store the results in the table named after your transform.

## View your query lineage

The bottom panel will also show you the query lineage as it will be handled by the orchestrator

![](/img/guides/transform-data/step3.2.png)



