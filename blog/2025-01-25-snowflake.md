---
slug: snowflake-data-loading
title: Snowflake Data Loading
author: Hayssam Saleh
author_title: Starlake Core Team Member
author_url: https://www.linkedin.com/in/hayssams/
author_image_url: https://s.gravatar.com/avatar/04aa2a859a66b52787bcba8c36beba8c.png
tags: [Snowflake, ETL, Starlake]
---

## Summary

Snowflake offers powerful tools for data loading and transformation, so why consider Starlake?
What distinguishes Starlake, and why is it important?
This article delves into these questions, exploring how Starlake complements and enhances your Snowflake experience.
Specifically, this article tackles the challenges of loading files into Snowflake

Although Starlake supports transformation activities, the scope of this article is limited to data loading.

{/* truncate */}

## Data Loading Challenges

Data loading might seem straightforward, but in reality, it comes with numerous challenges. Over the course of my data loading activities, I’ve encountered several obstacles, including:

- __File Format Diversity__: Working with traditional formats like CSV, JSON, and XML, as well as handling mainframe-generated files with fixed-width records and no attribute delimiters—a common scenario in the banking industry.

- __Inconsistent Date and Time Formats__: Dealing with varying formats, which are rarely in the standard U.S. format and often differ between files or even within the same file.

- __Compliance Requirements__: Addressing legal and regulatory requirements by encrypting sensitive attributes or discarding certain data elements before loading. In my case, I had to hash credit card numbers to avoid having them accessible inside the data warehouse.

- __Data Warehouse Constraints__: Adapting input data to fit the limitations of data warehouses. For instance, Snowflake does not support nested and repeated fields, which are frequently present in Apache Parquet files, requiring pre-transformation of the data.

- __Semantic typing__:
How can you ensure the content of a file is semantically correct? For instance, validating that the email field contains a valid email address or that the credit card number is a numeric value with 15 to 19 digits?

- __Custom Materialization Strategy__: 
When loading data, selecting the right materialization strategy is crucial. Common strategies like APPEND and OVERWRITE are straightforward, but what if your use case requires handling incoming data using a Slowly Changing Dimension Type 2 (SCD Type 2) approach ?

Additionally, it’s critical to validate incoming data to ensure its quality and integrity before loading it into a data warehouse—never trust the source blindly. Robust validation processes are key to maintaining high-quality data pipelines.

Finally, once the data is loaded, the next step is to ensure the security of the newly created tables. This involves implementing proper access controls to protect sensitive data.

### Loading Data with Snowflake tools

Loading files into Snowflake involves several steps, depending on the file types, formats, and the tools you use. Below is a detailed guide to loading files into Snowflake efficiently:

1. Create the target SCHEMA

```sql
CREATE SCHEMA hr;
```

2. Create the Target Table in Snowflake

Define the table that will receive the data. For example:

```sql
CREATE TABLE credit_card_user (
    email STRING,
    credit_card_number STRING,
    delivered_on DATE
);
```

3. Stage the Files
Use Snowflake’s internal or external stage for file uploads. To leverage external cloud storage like Amazon S3, Google Cloud Storage, or Azure Blob Storage.
Set up an external stage linked to your storage and use __COPY INTO__ command to load the data from the stage into your Snowflake table.

```sql
CREATE OR REPLACE STAGE external_stage
URL = 's3://my-bucket/path/'
STORAGE_INTEGRATION = my_integration;
```

Check for errors using Snowflake’s error-handling features:

4. Automate the Load Process

Snowpipe: Automate continuous data loading for files added to a stage.

```sql
CREATE PIPE my_pipe
AS
COPY INTO credit_card_user
FROM @my_stage
PATTERN='credit_card_user-.*.csv',
ON_ERROR = 'CONTINUE',
FILE_FORMAT = (TYPE = 'CSV');
```

5. Configure notifications to trigger Snowpipe when new files arrive in the stage:

```sql
CREATE OR REPLACE NOTIFICATION INTEGRATION my_notification_integration
TYPE = QUEUE
ENABLED = TRUE
NOTIFICATION_PROVIDER = 'cloud_provider'
QUEUE_NAME = 'queue_name'
COMMENT = 'Integration for Snowpipe notifications';
```

Grant permissions to Snowflake’s service account on the queue and replace __cloud_provider__ with AWS, GCP, or AZURE, and __queue_name__ with your cloud provider’s queue name

6. Update your Snowpipe to use the notification integration.

```sql
ALTER PIPE my_pipe
SET NOTIFICATION_INTEGRATION = my_notification_integration;
```

That’s it! We are ready, and any file that matches the specified pattern will be loaded into the table.
However, we are still far from fully addressing the [challenges outlined above](#data-loading-challenges).

### Achieving the same results with Starlake

We need to first bootstrap a new project 

```shell
$ mkdir star1 && cd star1
$ starlake bootstrap
```

Update the default connection in the metadata/application.sl.yml file

```yaml title=""
version: 1
application:
  connectionRef: snowflake
  connections:
    snowflake:
      type: jdbc
      options:
        url: "jdbc:snowflake://{{SNOWFLAKE_ACCOUNT}}.snowflakecomputing.com/"
        driver: "net.snowflake.client.jdbc.SnowflakeDriver"
        user: "{{SNOWFLAKE_USER}}"
        password: "{{SNOWFLAKE_PASSWORD}}"
        warehouse: "{{SNOWFLAKE_WAREHOUSE}}"
        db: "{{SNOWFLAKE_DB}}"
```

Copy the credit_card_user-20250101.csv file to the incoming/hr folder, then simply run the command below:

```shell
starlake autload
```

That's it!

Starlake generated the schema description file below for your target table and even loaded the data into our datawarehouse.

```yaml title='metadata/load/hr/credit_card_user.sl.yml gnerated file'

version: 1
table:
  name: "credit_card_user"
  pattern: "credit_card_user.*.csv"
  attributes:
    - name: email
      type: string
    - name: credit_card_number
      type: string
    - name: delivered_on
      type: date
  metadata:
    format: DSV

``` 

Let’s now address the challenges we need to tackle.

### Tackling the data loading challenges

1. Semantic input validation

We need to ensure that:

- All attributes are present and non-empty.
- Email addresses are valid.
- Credit card numbers consist of 15 to 19 digits.

To achieve this, we add the following validation rules to the metadata/types/custom.sl.yml file:

```yaml title='matadata/types/custom.sl.yml'
types:
  - name: "email_type"
    pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,6}"
    primitiveType: "string"
  - name: "credit_card_number_type"
    pattern: "[0-9]{15,19}"
    primitiveType: "string"
```

And update the yaml schema description file accordingly:

```yaml {7,10}
version: 1
table:
  name: "credit_card_user"
  pattern: "credit_card_user.*.csv"
  attributes:
    - name: email
      type: email_type
      required: true
    - name: credit_card_number
      type: credit_card_type
      required: true
    - name: delivered_on
      type: date
      required: true
  metadata:
    format: DSV
```

2. Hash the credit card number and remove the orginal value


```yaml {12,17-19}
version: 1
table:
  name: "credit_card_user"
  pattern: "credit_card_user.*.csv"
  attributes:
    - name: email
      type: email_type
      required: true
      accessPolicy: PII # Column level security
    - name: credit_card_number
      type: credit_card_type
      ignore: true
      required: true
    - name: delivered_on
      type: date
      required: true
    - name: encrypted_card_number
      type: string
      script: sha2(credit_card_number)
  metadata:
    format: DSV
```

3. Apply the SCD2 materialization strategy on load
To understand what SCD Type 2 is and why it is commonly used, refer to [this article](https://medium.com/@SaiKarthikaPuttha/understanding-slowly-changing-dimension-scd-type-2-ea1563714bd7)


```yaml {22-25}
version: 1
table:
  name: "credit_card_user"
  pattern: "credit_card_user.*.csv"
  attributes:
    - name: email
      type: email_type
      required: true
      accessPolicy: PII # Column level security
    - name: credit_card_number
      type: credit_card_type
      ignore: true
      required: true
    - name: delivered_on
      type: date
      required: true
    - name: encrypted_card_number
      type: string
      script: sha2(credit_card_number)
  metadata:
    format: DSV
    writeStrategy:
        type: SCD2
        key: email
        timestamp: delivered_on
```

That’s it! Starlake will take care of updating the table schema and metadata whenever our changes require it.

To load the files interactively, place your files in the incoming/hr folder again and simply run the following command:

```shell
starlake load
```

To load the files with your preferred orchestrator, run the following command:

```shell
starlake dag-generate
```

This command requires a configuration file, which differs based on the orchestrator you’re using, such as Airflow or Dagster.

```yaml title = 'if you are using the Airflow orchestrator'
version: 1
dag:
    comment: "default Airflow DAG configuration for load"
    template: "load/airflow_scheduled_table_bash.py.j2"
    filename: "airflow_all_tables.py"
    options:
        load_dependencies: "true"
```

```yaml  title = 'if you are using the Dagster orchestrator'
version: 1
dag:
    comment: "default Dagster pipeline configuration for load"
    template: "load/dagster_scheduled_table_shell.py.j2"
    filename: "dagster_all_load.py"
    options:
        load_dependencies: "true"
```

Your DAG files have been successfully generated and are ready to be deployed to your preferred orchestrator.

The sample below illustrates how your DAGs look like on Airflow:

![Airflow Load](/img/blog/snowflake/orchestration.jpg "Airflow Load")



