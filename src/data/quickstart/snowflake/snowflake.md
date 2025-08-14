---
title: "Quickstart for Starlake and Snowflake"
id: "snowflake"
level: 'Beginner'
icon: 'snowflake'
tags: ['Snowflake']
hide_table_of_contents: true
description: "Get started with Starlake and Snowflake in minutes"
---

<div style={{maxWidth: '900px'}}>

## Introduction

In this quickstart guide, you'll learn how to use Starlake with Snowflake. It will show you how to: 

- Set up Snowflake credentials and permissions
- Configure Starlake for Snowflake
- Create your first data pipeline
- Deploy and monitor your pipelines
- Set up scheduling and orchestration

### Prerequisites

- A Snowflake account (trial or paid)
- Basic knowledge of SQL and data warehousing
- Starlake CLI installed
- Access to create databases and schemas

### Why Snowflake + Starlake?

- **Scalability**: Snowflake's elastic compute and storage
- **Performance**: Optimized for large-scale data processing
- **Security**: Built-in security features and compliance
- **Cost-effective**: Pay-per-use pricing model

Let's get started!

## Set up Snowflake credentials

Before you can use Starlake with Snowflake, you need to configure your Snowflake credentials and permissions.

### Step 1: Create a Snowflake User

1. Log in to your Snowflake account
2. Navigate to **Admin** > **Users**
3. Click **"Create User"**
4. Enter username (e.g., `starlake_user`)
5. Set a secure password
6. Assign appropriate roles (e.g., `ACCOUNTADMIN` for setup)

### Step 2: Create Database and Schema

Execute these SQL commands in your Snowflake worksheet:

```sql
-- Create database for Starlake
CREATE DATABASE starlake_db;

-- Create schema for your data
CREATE SCHEMA starlake_db.starlake_schema;

-- Create warehouse for compute resources
CREATE WAREHOUSE starlake_wh
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE;
```

### Step 3: Grant Permissions

```sql
-- Grant usage on database
GRANT USAGE ON DATABASE starlake_db TO ROLE your_role;

-- Grant usage on schema
GRANT USAGE ON SCHEMA starlake_db.starlake_schema TO ROLE your_role;

-- Grant table creation permissions
GRANT CREATE TABLE ON SCHEMA starlake_db.starlake_schema TO ROLE your_role;

-- Grant warehouse usage
GRANT USAGE ON WAREHOUSE starlake_wh TO ROLE your_role;

-- Grant data loading permissions
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA starlake_db.starlake_schema TO ROLE your_role;
```

## Configure Starlake

Now let's configure Starlake to work with your Snowflake environment.

### Environment Variables

Set the following environment variables in your shell:

```bash
export SNOWFLAKE_ACCOUNT=your_account_identifier
export SNOWFLAKE_USER=starlake_user
export SNOWFLAKE_PASSWORD=your_secure_password
export SNOWFLAKE_DATABASE=starlake_db
export SNOWFLAKE_SCHEMA=starlake_schema
export SNOWFLAKE_WAREHOUSE=starlake_wh
export SNOWFLAKE_ROLE=your_role
```

**Note**: Replace `your_account_identifier` with your Snowflake account identifier (e.g., `xy12345.us-east-1`).

### Starlake Configuration

Create a `starlake.conf` file in your project root:

```yaml
connections:
  snowflake:
    type: "snowflake"
    account: "${SNOWFLAKE_ACCOUNT}"
    user: "${SNOWFLAKE_USER}"
    password: "${SNOWFLAKE_PASSWORD}"
    database: "${SNOWFLAKE_DATABASE}"
    schema: "${SNOWFLAKE_SCHEMA}"
    warehouse: "${SNOWFLAKE_WAREHOUSE}"
    role: "${SNOWFLAKE_ROLE}"
    options:
      client_session_keep_alive: true
      timezone: "UTC"

# Global settings
settings:
  default-connection: "snowflake"
  default-format: "PARQUET"
  default-mode: "FILE"
```

### Test Connection

Test your connection with:

```bash
starlake test-connection --connection snowflake
```

## Create your first pipeline

Let's create a simple data pipeline using Starlake and Snowflake.

### Step 1: Define the Extract

Create `extract/snowflake-sales.yml`:

```yaml
extract:
  connectionRef: "snowflake"
  tables:
    - name: "sales_data"
      schema: "public"
      incremental: true
      timestamp: "created_at"
      partitionColumn: "sale_date"
      fetchSize: 1000
      where: "sale_date >= '2024-01-01'"

# Optional: Add transformations during extract
transform:
  - name: "clean_sales_data"
    sql: |
      SELECT 
        order_id,
        customer_id,
        product_id,
        amount,
        sale_date,
        created_at
      FROM sales_data
      WHERE amount > 0
```

### Step 2: Define the Load

Create `load/sales.yml`:

```yaml
table:
  pattern: "sales_data.*.parquet"
  metadata:
    mode: "FILE"
    format: "PARQUET"
    encoding: "UTF-8"
    withHeader: true
  writeStrategy:
    type: "UPSERT_BY_KEY_AND_TIMESTAMP"
    timestamp: "created_at"
    key: ["order_id"]
  attributes:
    - name: "order_id"
      type: "string"
      required: true
      privacy: "NONE"
    - name: "customer_id"
      type: "string"
      required: true
      privacy: "HIDE"
    - name: "product_id"
      type: "string"
      required: true
    - name: "amount"
      type: "float"
      required: true
    - name: "sale_date"
      type: "timestamp"
      required: true
    - name: "created_at"
      type: "timestamp"
      required: true
```

### Step 3: Create Sample Data

Create a sample CSV file `data/sales_sample.csv`:

```csv
order_id,customer_id,product_id,amount,sale_date,created_at
ORD001,CUST001,PROD001,150.50,2024-01-15,2024-01-15 10:30:00
ORD002,CUST002,PROD002,299.99,2024-01-16,2024-01-16 14:20:00
ORD003,CUST001,PROD003,75.25,2024-01-17,2024-01-17 09:15:00
```

## Deploy and monitor

Now let's deploy your pipeline and monitor its execution.

![Load Process](/img/quickstart/load.png)

### Deploy the Pipeline

Run the following commands to execute your pipeline:

```bash
# Extract data from source
starlake extract --config extract/snowflake-sales.yml

# Load data into Snowflake
starlake load --config load/sales.yml

# Or run both in sequence
starlake run --extract-config extract/snowflake-sales.yml --load-config load/sales.yml
```

### Monitor Execution

#### 1. Check Starlake Logs

```bash
# View recent logs
tail -f logs/starlake.log

# Check execution status
starlake status --job-id <job_id>
```

#### 2. Monitor Snowflake Query History

In Snowflake worksheet:

```sql
-- View recent queries
SELECT 
  query_id,
  query_text,
  start_time,
  end_time,
  total_elapsed_time,
  status
FROM table(information_schema.query_history())
WHERE start_time >= dateadd(hour, -1, current_timestamp())
ORDER BY start_time DESC;

-- Check warehouse usage
SELECT 
  warehouse_name,
  credits_used,
  bytes_scanned,
  percentage_scanned_from_cache
FROM table(information_schema.warehouse_metering_history(
  date_range_start=>dateadd(hour, -1, current_timestamp()),
  date_range_end=>current_timestamp()
));
```

#### 3. Verify Data in Snowflake

```sql
-- Check loaded data
SELECT COUNT(*) as total_rows FROM starlake_db.starlake_schema.sales_data;

-- Sample data
SELECT * FROM starlake_db.starlake_schema.sales_data LIMIT 10;

-- Data quality check
SELECT 
  COUNT(*) as total_orders,
  SUM(amount) as total_amount,
  MIN(sale_date) as earliest_sale,
  MAX(sale_date) as latest_sale
FROM starlake_db.starlake_schema.sales_data;
```

### Next Steps

- Set up scheduling with cron or Airflow
- Configure alerts and notifications
- Scale your pipelines as needed
- Implement data quality checks

## Next steps

Congratulations! You've successfully set up Starlake with Snowflake.

### What's Next?

#### Advanced Configuration

- **Data Quality**: Implement data validation rules
- **Incremental Loading**: Set up efficient incremental updates
- **Partitioning**: Optimize performance with table partitioning
- **Clustering**: Improve query performance with clustering keys

#### Scheduling and Orchestration

```bash
# Set up cron job for daily execution
crontab -e

# Add this line for daily execution at 2 AM
0 2 * * * /path/to/starlake run --extract-config extract/snowflake-sales.yml --load-config load/sales.yml
```

#### Monitoring and Alerting

- Set up Snowflake alerts for warehouse usage
- Configure Starlake notifications
- Monitor data quality metrics
- Track pipeline performance

#### Security Enhancements

- Implement row-level security (RLS)
- Set up column-level security
- Use Snowflake's data masking features
- Configure network policies

### Resources

- [Starlake Documentation](https://docs.starlake.ai)
- [Snowflake Documentation](https://docs.snowflake.com)
- [Snowflake Best Practices](https://docs.snowflake.com/en/user-guide/best-practices-overview)
- [Community Support](https://github.com/starlake-ai/starlake)

### Need Help?

If you encounter any issues:
1. Check the troubleshooting guide
2. Review the logs for error messages
3. Verify Snowflake permissions
4. Reach out to the community

### Example Advanced Configuration

```yaml
# Advanced Snowflake configuration
connections:
  snowflake:
    type: "snowflake"
    account: "${SNOWFLAKE_ACCOUNT}"
    user: "${SNOWFLAKE_USER}"
    password: "${SNOWFLAKE_PASSWORD}"
    database: "${SNOWFLAKE_DATABASE}"
    schema: "${SNOWFLAKE_SCHEMA}"
    warehouse: "${SNOWFLAKE_WAREHOUSE}"
    role: "${SNOWFLAKE_ROLE}"
    options:
      client_session_keep_alive: true
      timezone: "UTC"
      session_parameters:
        USE_CACHED_RESULT: true
        STATEMENT_TIMEOUT_IN_SECONDS: 3600
```

</div>
