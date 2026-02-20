---
title: "Load JSON Files into your Database"
id: "starlake-load-json-files"
level: 'Beginner'
icon: 'starlake'
tags: ['Starlake', "Load"]
hide_table_of_contents: true
description: "Learn how to load JSON files into your database."
---



## Create a domain (Optional)


A domain is a logical grouping of your data assets in Starlake. It maps to a schema in your database also known as a dataset in BigQuery. If you don't have a domain yet, you can create one or use an existing one if you already created it in Starlake.

This schema will be created when executing your load if it does not already exist.

1. In your Starlake project, navigate to the "Load" section.
2. Click on "Add Domain" and enter a domain name. If this domain already exists in the database, it will be mapped to the existing schema. We'll name our domain, "starbake". 
3. You may optionally add a description your domain. This is useful for documentation purposes and for AI assistance. This description will be saved in the database as a comment.
4. Click "Create" to finalize the domain creation.

![Starlake UI creating a new domain for JSON data loading](/img/guides/load-json-files/step1.png)

We are now ready to load our JSON files into the schema "starbake" of our database.


## Infer your table name from the JSON file

Prepare a sample JSON file with a few rows of data that represent the structure you want to import. This may be an array of objects or newline-delimited JSON file (JSONL format).

1. Click on "Load" and select "CSV / JSON / XML".
2. Choose the JSON file you want to load.
![Starlake JSON file preview with inferred table name and nested structure handling](/img/guides/load-json-files/step2.png)
A preview of the file will be displayed.
Starlake will also infer the table name from the filename. Update the table name if necessary.
If A.I. is enabled, you may request it to suggest a description for the table by clicking on the "A.I." button inside the "Description" field.

When the JSON file contains nested and/or repeated structures, Starlake will automatically flatten them into separate columns. You can review and modify the inferred schema if necessary.
This is however only supported on BigQuery and Databricks.

On Snowflake, only single level JSON files are flattened to multiple columns. If you do not want to flatten the JSON file, you can choose to load it as a single column by enabling the "Load as Single Column" option.

1. If you do not want to load the preview data, you can disable the "Load Data" option.
2. Hit the "Next" button.

## Infer table schema from the JSON file

Starlake will automatically infer the table schema from the JSON file. You can review and modify the inferred schema if necessary.

![Starlake inferred table schema from JSON with editable data types and primary key](/img/guides/load-json-files/step3.1.png)

To customize the inferred schema, you can edit the data types, and invoke the A.I. assistant to suggest descriptions as needed. This allows you to ensure that the schema matches your requirements before loading the data.

You can also define the primary key for the table by selecting one or more columns in the "Primary Key" section. This is important for optimizing query performance and improving A.I. suggestions when building transformations.

Hit the "Finish" button to complete the process.

If you kept the "Load Data" option enabled, Starlake will start loading the data from the JSON file into the specified table and display the results.

![Starlake JSON load results showing data successfully loaded into the database](/img/guides/load-json-files/step3.2.png)


## Going Further

Once you inferred the table schema and loaded the data, you can start building transformations on top of it. Starlake provides a powerful SQL editor and a visual transformation builder to help you create complex data pipelines with ease.

You can also:

- define write strategies for your data loads, such as "append" or "overwrite", "slow changing dimensions" ..., to control how new data is integrated into your tables.
- schedule regular data loads and define freshness criteria for your data to ensure it is up-to-date and relevant.
- create expectations for your data to ensure quality and consistency.
- Add new fields through SQL transformations during the load process.
- Encrypt sensitive data to protect it at rest during the load process.
- Add access controls to your data to ensure only authorized users can view or modify it.

