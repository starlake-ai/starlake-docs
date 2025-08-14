---
title: "Quickstart for Starlake and GCP"
id: "gcp"
level: 'Beginner'
icon: 'gcp'
tags: ['GCP']
hide_table_of_contents: true
description: "Get started with Starlake and Google Cloud Platform in minutes"
---

<div style={{maxWidth: '900px'}}>

## Introduction

In this quickstart guide, you'll learn how to use Starlake with Google Cloud Platform (GCP). It will show you how to: 

- Set up GCP credentials and permissions
- Configure Starlake for GCP services
- Create your first data pipeline
- Deploy and monitor your pipelines

### Prerequisites

- A Google Cloud Platform account
- Basic knowledge of GCP services
- Starlake CLI installed
- Access to create projects and resources

Let's get started!

## Set up GCP credentials

Before you can use Starlake with GCP, you need to configure your GCP credentials and permissions.

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** or **"New Project"**
3. Enter a project name (e.g., `starlake-project`)
4. Click **"Create"**

### Step 2: Enable Required APIs

1. In the Google Cloud Console, go to **APIs & Services** > **Library**
2. Search for and enable the following APIs:
   - **BigQuery API**
   - **Cloud Storage API**
   - **Cloud Dataproc API** (if using Dataproc)
   - **Cloud Functions API** (if using Cloud Functions)

### Step 3: Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **"Create Service Account"**
3. Enter a name (e.g., `starlake-service-account`)
4. Add description: "Service account for Starlake GCP integration"
5. Click **"Create and Continue"**

### Step 4: Assign Permissions

1. Add the following roles:
   - **BigQuery Admin**
   - **Storage Admin**
   - **Dataproc Admin** (if using Dataproc)
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

Now let's configure Starlake to work with your GCP environment.

### Environment Variables

Set the following environment variables in your shell:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/service-account-key.json
export GCP_PROJECT_ID=your-project-id
export GCP_REGION=us-central1
export GCP_BUCKET=your-data-bucket
```

### Starlake Configuration

Create a `starlake.conf` file in your project root:

```yaml
connections:
  gcp:
    type: "gcp"
    project_id: "${GCP_PROJECT_ID}"
    region: "${GCP_REGION}"
    bucket: "${GCP_BUCKET}"
    credentials_file: "${GOOGLE_APPLICATION_CREDENTIALS}"
    options:
      storage_class: "STANDARD"
      location: "US"

# Global settings
settings:
  default-connection: "gcp"
  default-format: "PARQUET"
  default-mode: "FILE"
```

### Test Connection

Test your connection with:

```bash
starlake test-connection --connection gcp
```

## Create your first pipeline

Let's create a simple data pipeline using Starlake and GCP.

### Step 1: Define the Extract

Create `extract/gcp-sales.yml`:

```yaml
extract:
  connectionRef: "gcp"
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
starlake extract --config extract/gcp-sales.yml

# Load data into GCP
starlake load --config load/sales.yml

# Or run both in sequence
starlake run --extract-config extract/gcp-sales.yml --load-config load/sales.yml
```

### Monitor Execution

#### 1. Check Starlake Logs

```bash
# View recent logs
tail -f logs/starlake.log

# Check execution status
starlake status --job-id <job_id>
```

#### 2. Monitor GCP Services

- Check Cloud Storage for uploaded files
- Monitor Cloud Logging for execution logs
- Review BigQuery for data processing

#### 3. Verify Data in GCP

```bash
# Check loaded data in Cloud Storage
gsutil ls gs://your-data-bucket/sales_data/

# Sample data from BigQuery
bq query --use_legacy_sql=false "
SELECT COUNT(*) as total_rows 
FROM \`your-project-id.starlake_dataset.sales_data\`
"
```

### Next Steps

- Set up scheduling with Cloud Scheduler
- Configure alerts and notifications
- Scale your pipelines as needed
- Implement data quality checks

## Next steps

Congratulations! You've successfully set up Starlake with GCP.

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
- Set up bucket-level permissions
- Use customer-managed encryption keys
- Configure VPC service controls

### Resources

- [Starlake Documentation](https://docs.starlake.ai)
- [GCP Documentation](https://cloud.google.com/docs)
- [GCP Best Practices](https://cloud.google.com/architecture/best-practices)
- [Community Support](https://github.com/starlake-ai/starlake)

### Need Help?

If you encounter any issues:
1. Check the troubleshooting guide
2. Review the logs for error messages
3. Verify GCP permissions
4. Reach out to the community

### Example Advanced Configuration

```yaml
# Advanced GCP configuration
connections:
  gcp:
    type: "gcp"
    project_id: "${GCP_PROJECT_ID}"
    region: "${GCP_REGION}"
    bucket: "${GCP_BUCKET}"
    credentials_file: "${GOOGLE_APPLICATION_CREDENTIALS}"
    options:
      storage_class: "STANDARD"
      location: "US"
      encryption: "AES256"
      lifecycle_policy: true
      versioning: true
```

</div>
