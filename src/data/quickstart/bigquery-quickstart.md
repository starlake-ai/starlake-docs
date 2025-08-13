---
title: "Quickstart for Starlake and BigQuery"
id: "bigquery"
level: 'Beginner'
icon: 'bigquery'
tags: ['BigQuery']
hide_table_of_contents: true
description: "Get started with Starlake and BigQuery in minutes"
---

<div style={{maxWidth: '900px'}}>

## Introduction

In this quickstart guide, you'll learn how to use Starlake with Google BigQuery. It will show you how to: 

- Set up BigQuery credentials and permissions
- Configure Starlake for BigQuery
- Create your first data pipeline
- Deploy and monitor your pipelines

### Prerequisites

- A Google Cloud Platform account
- Basic knowledge of BigQuery and GCP
- Starlake CLI installed
- Access to create datasets and tables

Let's get started!

## Set up BigQuery credentials

Before you can use Starlake with BigQuery, you need to configure your BigQuery credentials and permissions.

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** or **"New Project"**
3. Enter a project name (e.g., `starlake-project`)
4. Click **"Create"**

### Step 2: Enable BigQuery API

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for **"BigQuery API"**
3. Click on it and click **"Enable"**

### Step 3: Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **"Create Service Account"**
3. Enter a name (e.g., `starlake-service-account`)
4. Add description: "Service account for Starlake BigQuery integration"
5. Click **"Create and Continue"**

### Step 4: Assign Permissions

1. Add the following roles:
   - **BigQuery Admin**
   - **Storage Admin**
   - **Service Account User**
2. Click **"Continue"**
3. Click **"Done"**

### Step 5: Create and Download Key

1. Click on your service account
2. Go to **Keys** tab
3. Click **"Add Key"** > **"Create new key"**
4. Select **JSON** format
5. Click **"Create"**
6. Save the JSON file securely

## Configure Starlake

Now let's configure Starlake to work with your BigQuery environment.

### Environment Variables

Set the following environment variables in your shell:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
export BIGQUERY_PROJECT_ID=your-project-id
export BIGQUERY_DATASET=starlake_dataset
export BIGQUERY_LOCATION=US
```

### Starlake Configuration

Create a `starlake.conf` file in your project root:

```yaml
connections:
  bigquery:
    type: "bigquery"
    project_id: "${BIGQUERY_PROJECT_ID}"
    dataset: "${BIGQUERY_DATASET}"
    location: "${BIGQUERY_LOCATION}"
    credentials_file: "${GOOGLE_APPLICATION_CREDENTIALS}"
    options:
      useLegacySql: false
      allowLargeResults: true

# Global settings
settings:
  default-connection: "bigquery"
  default-format: "PARQUET"
  default-mode: "FILE"
```

### Test Connection

Test your connection with:

```bash
starlake test-connection --connection bigquery
```

## Create your first pipeline

Let's create a simple data pipeline using Starlake and BigQuery.

### Step 1: Define the Extract

Create `extract/bigquery-sales.yml`:

```yaml
extract:
  connectionRef: "bigquery"
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

### Deploy the Pipeline

Run the following commands to execute your pipeline:

```bash
# Extract data from source
starlake extract --config extract/bigquery-sales.yml

# Load data into BigQuery
starlake load --config load/sales.yml

# Or run both in sequence
starlake run --extract-config extract/bigquery-sales.yml --load-config load/sales.yml
```

### Monitor Execution

#### 1. Check Starlake Logs

```bash
# View recent logs
tail -f logs/starlake.log

# Check execution status
starlake status --job-id <job_id>
```

#### 2. Monitor BigQuery

In BigQuery console or using bq command:

```sql
-- Check loaded data
SELECT COUNT(*) as total_rows 
FROM `your-project-id.starlake_dataset.sales_data`;

-- Sample data
SELECT * 
FROM `your-project-id.starlake_dataset.sales_data` 
LIMIT 10;

-- Data quality check
SELECT 
  COUNT(*) as total_orders,
  SUM(amount) as total_amount,
  MIN(sale_date) as earliest_sale,
  MAX(sale_date) as latest_sale
FROM `your-project-id.starlake_dataset.sales_data`;
```

#### 3. Monitor Job History

```bash
# List recent BigQuery jobs
bq ls --jobs --max_results=10

# Get job details
bq show --job=true your-project-id:US.job_id
```

### Next Steps

- Set up scheduling with Cloud Scheduler
- Configure alerts and notifications
- Scale your pipelines as needed
- Implement data quality checks

## Next steps

Congratulations! You've successfully set up Starlake with BigQuery.

### What's Next?

#### Advanced Configuration

- **Data Quality**: Implement data validation rules
- **Incremental Loading**: Set up efficient incremental updates
- **Partitioning**: Optimize performance with table partitioning
- **Clustering**: Improve query performance with clustering keys

#### Scheduling and Orchestration

```bash
# Set up Cloud Scheduler job
gcloud scheduler jobs create http starlake-pipeline \
  --schedule="0 2 * * *" \
  --uri="https://your-function-url.com/api/trigger" \
  --http-method=POST \
  --message-body='{"action": "run-pipeline"}'
```

#### Monitoring and Alerting

- Set up Cloud Monitoring alerts
- Configure Starlake notifications
- Monitor data quality metrics
- Track pipeline performance

#### Security Enhancements

- Implement IAM roles and policies
- Set up dataset-level permissions
- Use customer-managed encryption keys
- Configure VPC service controls

### Resources

- [Starlake Documentation](https://docs.starlake.ai)
- [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
- [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
- [Community Support](https://github.com/starlake-ai/starlake)

### Need Help?

If you encounter any issues:
1. Check the troubleshooting guide
2. Review the logs for error messages
3. Verify BigQuery permissions
4. Reach out to the community

### Example Advanced Configuration

```yaml
# Advanced BigQuery configuration
connections:
  bigquery:
    type: "bigquery"
    project_id: "${BIGQUERY_PROJECT_ID}"
    dataset: "${BIGQUERY_DATASET}"
    location: "${BIGQUERY_LOCATION}"
    credentials_file: "${GOOGLE_APPLICATION_CREDENTIALS}"
    options:
      useLegacySql: false
      allowLargeResults: true
      maximumBytesBilled: "1000000000"
      useQueryCache: true
```

</div>
