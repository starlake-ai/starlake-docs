---
title: "Quickstart for Starlake and Databricks"
id: "databricks"
level: 'Beginner'
icon: 'databricks'
tags: ['Databricks']
hide_table_of_contents: true
description: "Get started with Starlake and Databricks in minutes"
---

<div style={{maxWidth: '900px'}}>

## Introduction

In this quickstart guide, you'll learn how to use Starlake with Databricks. It will show you how to: 

- Set up Databricks workspace and permissions
- Configure Starlake for Databricks
- Create your first data pipeline
- Deploy and monitor your pipelines

### Prerequisites

- A Databricks account (trial or paid)
- Basic knowledge of Databricks and Apache Spark
- Starlake CLI installed
- Access to create clusters and jobs

Let's get started!

## Set up Databricks credentials

Before you can use Starlake with Databricks, you need to configure your Databricks credentials and permissions.

### Step 1: Create a Databricks Workspace

1. Go to [Databricks](https://databricks.com) and sign up for a trial or log in
2. Click **"Create Workspace"**
3. Choose your cloud provider (AWS, Azure, or GCP)
4. Follow the setup wizard to create your workspace

### Step 2: Create a Personal Access Token

1. In your Databricks workspace, click on your profile icon
2. Select **"User Settings"**
3. Go to **"Access Tokens"** tab
4. Click **"Generate New Token"**
5. Add a comment (e.g., "Starlake integration")
6. Click **"Generate"**
7. Copy and save the token securely

### Step 3: Create a Cluster

1. In your Databricks workspace, go to **"Compute"**
2. Click **"Create Cluster"**
3. Enter a cluster name (e.g., `starlake-cluster`)
4. Choose **"Single Node"** for development
5. Select **"Databricks Runtime 13.3 LTS"**
6. Click **"Create Cluster"**

### Step 4: Get Workspace Information

1. Note your **Workspace URL** (e.g., `https://adb-1234567890123456.7.azuredatabricks.net`)
2. Note your **Workspace ID** (from the URL)
3. Save your **Personal Access Token**

## Configure Starlake

Now let's configure Starlake to work with your Databricks environment.

### Environment Variables

Set the following environment variables in your shell:

```bash
export DATABRICKS_HOST=https://your-workspace-url
export DATABRICKS_TOKEN=your-personal-access-token
export DATABRICKS_CLUSTER_ID=your-cluster-id
export DATABRICKS_WORKSPACE_ID=your-workspace-id
```

### Starlake Configuration

Create a `starlake.conf` file in your project root:

```yaml
connections:
  databricks:
    type: "databricks"
    host: "${DATABRICKS_HOST}"
    token: "${DATABRICKS_TOKEN}"
    cluster_id: "${DATABRICKS_CLUSTER_ID}"
    workspace_id: "${DATABRICKS_WORKSPACE_ID}"
    options:
      spark.sql.adaptive.enabled: true
      spark.sql.adaptive.coalescePartitions.enabled: true

# Global settings
settings:
  default-connection: "databricks"
  default-format: "PARQUET"
  default-mode: "FILE"
```

### Test Connection

Test your connection with:

```bash
starlake test-connection --connection databricks
```

## Create your first pipeline

Let's create a simple data pipeline using Starlake and Databricks.

### Step 1: Define the Extract

Create `extract/databricks-sales.yml`:

```yaml
extract:
  connectionRef: "databricks"
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
starlake extract --config extract/databricks-sales.yml

# Load data into Databricks
starlake load --config load/sales.yml

# Or run both in sequence
starlake run --extract-config extract/databricks-sales.yml --load-config load/sales.yml
```

### Monitor Execution

#### 1. Check Starlake Logs

```bash
# View recent logs
tail -f logs/starlake.log

# Check execution status
starlake status --job-id <job_id>
```

#### 2. Monitor Databricks

- Check cluster status in Databricks UI
- Monitor job runs in **"Jobs"** section
- Review Spark UI for detailed execution metrics

#### 3. Verify Data in Databricks

In a Databricks notebook:

```sql
-- Check loaded data
SELECT COUNT(*) as total_rows FROM starlake_schema.sales_data;

-- Sample data
SELECT * FROM starlake_schema.sales_data LIMIT 10;

-- Data quality check
SELECT 
  COUNT(*) as total_orders,
  SUM(amount) as total_amount,
  MIN(sale_date) as earliest_sale,
  MAX(sale_date) as latest_sale
FROM starlake_schema.sales_data;
```

### Next Steps

- Set up scheduling with Databricks Jobs
- Configure alerts and notifications
- Scale your pipelines as needed
- Implement data quality checks

## Next steps

Congratulations! You've successfully set up Starlake with Databricks.

### What's Next?

#### Advanced Configuration

- **Data Quality**: Implement data validation rules
- **Incremental Loading**: Set up efficient incremental updates
- **Partitioning**: Optimize performance with table partitioning
- **Clustering**: Improve query performance with clustering keys

#### Scheduling and Orchestration

```bash
# Create Databricks job
databricks jobs create --json '{
  "name": "starlake-pipeline",
  "existing_cluster_id": "your-cluster-id",
  "notebook_task": {
    "notebook_path": "/Shared/starlake-pipeline"
  },
  "schedule": {
    "quartz_cron_expression": "0 0 2 * * ?",
    "timezone_id": "UTC"
  }
}'
```

#### Monitoring and Alerting

- Set up Databricks alerts
- Configure Starlake notifications
- Monitor data quality metrics
- Track pipeline performance

#### Security Enhancements

- Implement Unity Catalog
- Set up access control lists
- Use Databricks secrets
- Configure network security

### Resources

- [Starlake Documentation](https://docs.starlake.ai)
- [Databricks Documentation](https://docs.databricks.com)
- [Databricks Best Practices](https://docs.databricks.com/best-practices/index.html)
- [Community Support](https://github.com/starlake-ai/starlake)

### Need Help?

If you encounter any issues:
1. Check the troubleshooting guide
2. Review the logs for error messages
3. Verify Databricks permissions
4. Reach out to the community

### Example Advanced Configuration

```yaml
# Advanced Databricks configuration
connections:
  databricks:
    type: "databricks"
    host: "${DATABRICKS_HOST}"
    token: "${DATABRICKS_TOKEN}"
    cluster_id: "${DATABRICKS_CLUSTER_ID}"
    workspace_id: "${DATABRICKS_WORKSPACE_ID}"
    options:
      spark.sql.adaptive.enabled: true
      spark.sql.adaptive.coalescePartitions.enabled: true
      spark.sql.adaptive.skewJoin.enabled: true
      spark.sql.adaptive.localShuffleReader.enabled: true
```

</div>
