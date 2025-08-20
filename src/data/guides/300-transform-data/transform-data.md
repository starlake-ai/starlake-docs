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

1. In your Starlake project, navigate to the "Load" section.
2. Click on "Add Domain" and enter a domain name. If this domain already exists in the database, it will be mapped to the existing schema. We'll name our domain, "starbake". 
3. You may optionally add a description your domain. This is useful for documentation purposes and for AI assistance. This description will be saved in the database as a comment.
4. Click "Create" to finalize the domain creation.

![](/img/guides/load-csv-files/step1.png)

We are now ready to load our CSV files into the schema "starbake" of our database.

## Load files (Optional)

If you already have your tables loaded, simply go to the next step.

For new tables, you follow the Load guides to load the sample files below as a support for our transformation.

- Load the ![customers](/img/guides/files/customers.csv) file
- Load the ![orders](/img/guides/files/orders.json) file
- Load the ![products](/img/guides/files/products.json) file
