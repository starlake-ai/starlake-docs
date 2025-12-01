---
title: "Load XML Files into your Database"
id: "starlake-load-xml-files"
level: 'Beginner'
icon: 'starlake'
tags: ['Starlake', 'Load']
hide_table_of_contents: true
description: "Learn how to load XML files into your database with Starlake."
---


## Create a domain (Optional)

A domain is a logical grouping of your data assets in Starlake. It maps to a schema in your database, also known as a dataset in BigQuery.  
If you don't have a domain yet, you can create one or use an existing one if you already created it in Starlake.

This schema will be created automatically when executing your load if it does not already exist.

1. In your Starlake project, navigate to the **"Load"** section.  
2. Click on **"Add Domain"** and enter a domain name. If this domain already exists in the database, it will be mapped to the existing schema. We'll name our domain **"starshop"**.  
3. Optionally, add a description for your domain — this helps documentation and improves A.I.-assisted suggestions later.  
4. Click **"Create"** to finalize the domain creation.

![](/img/guides/load-xml-files/step1.png)

We are now ready to load our XML files into the schema **"starshop"** of our database.


## Infer your table name from the XML file

Prepare an XML file with a few records representing the data you want to import.  
Each record should correspond to one entity — for example, a `<name>`, `<comment>`, or `<regionkey>` element.

1. Click on **"Load"** and select **"CSV / JSON / XML"**.  
2. Choose the XML file you want to load.  

![](/img/guides/load-xml-files/step2.png)

Starlake will display a preview of the XML structure.  
It will automatically **infer the table name** from the file name (for example, `regions.xml` → table `regions`).  
You can edit this name if needed.

If A.I. assistance is enabled, you can request it to suggest a **table description** by clicking the **"A.I."** button inside the description field.

When the XML contains nested structures or repeated tags, Starlake will automatically flatten them into separate columns whenever possible.  
This flattening behavior depends on your destination database:

- On **BigQuery** and **Databricks**, nested elements are fully flattened into relational columns.  
- On **Snowflake**, only first-level elements are flattened.  
  If you prefer to keep the entire XML document as a single column, you can enable the **"Load as Single Column"** option.

If you only want to create the schema without importing data, you can disable the **"Load Data"** option.

Click **"Next"** to continue.


## Infer table schema from the XML file

Starlake will automatically infer the **table schema** from the structure of your XML file.  
Each element and attribute becomes a column in your table.

![](/img/guides/load-xml-files/step3.png)

You can review and modify the inferred schema if necessary:
- Edit data types (e.g., `STRING`, `INTEGER`, `TIMESTAMP`)
- Add or remove fields
- Invoke the A.I. assistant to generate **column descriptions** automatically.

You can also define a **primary key** by selecting one or more columns under the “Primary Key” section.  
This improves indexing, performance, and A.I. suggestions when building transformations.

Once the schema looks good, click **"Finish"**.

If you kept **"Load Data"** enabled, Starlake will start importing the XML data into your table and display the load summary.


## Going Further

Once your XML file is loaded and the schema is inferred, you can start creating transformations directly on top of it.  
Starlake provides both a **SQL editor** and a **visual transformation builder** to help you model and clean your data easily.

You can also:

- Define **write strategies** such as `append`, `overwrite`, or `merge` to control how new data integrates into existing tables.  
- Schedule **automatic XML loads** and define freshness criteria to ensure your data stays current.  
- Add **data quality rules** to automatically detect missing or invalid values.  
- Apply **data encryption** for sensitive fields before loading.  
- Add **access control policies** to secure specific tables or columns.  
- Combine multiple XML and CSV sources into a single pipeline using Starlake’s orchestration tools.  

![](/img/guides/load-xml-files/step4.png)

With Starlake, importing structured or semi-structured XML data becomes a fully declarative process — **no code, no manual parsing, no external ETL required.**