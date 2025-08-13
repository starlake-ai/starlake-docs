---
author: Starlake Team
summary: Quick start guide for using Starlake with Google BigQuery
id: bigquery_quickstart
categories: BigQuery, Data Warehouse, Cloud
status: Published
icon: bigquery
title: Quickstart for dbt and BigQuery
description: Get started with Starlake and BigQuery in minutes
tags: BigQuery, dbt, Data Warehouse, Cloud, Quick Start
tabs:
  - id: 1
    label: Introduction
    content: |
      # Introduction to Starlake with BigQuery
      
      Welcome to the Starlake BigQuery quick start guide! This guide will walk you through setting up Starlake with Google BigQuery.
      
      ## What you'll learn
      
      - How to set up Google Cloud credentials
      - How to configure Starlake for BigQuery
      - How to create your first data pipeline
      - How to deploy and monitor your pipelines
      
      ## Prerequisites
      
      - A Google Cloud Platform account
      - BigQuery enabled in your project
      - Basic knowledge of SQL and data warehousing
      - Starlake CLI installed
      - Google Cloud SDK installed
      
      ## Why BigQuery + Starlake?
      
      - **Serverless**: No infrastructure management required
      - **Scalability**: Handles petabytes of data automatically
      - **Cost-effective**: Pay only for data processed
      - **Integration**: Native integration with Google Cloud services
      - **Performance**: Fast queries with columnar storage
      
      Let's get started!
  
  - id: 2
    label: Set up Google Cloud credentials
    content: |
      # Set up Google Cloud Credentials
      
      Before you can use Starlake with BigQuery, you need to configure your Google Cloud credentials.
      
      ## Step 1: Create a Google Cloud Project
      
      1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
      2. Click **"Select a project"** or create a new one
      3. Note your **Project ID** (you'll need this later)
      
      ## Step 2: Enable BigQuery API
      
      1. In the Google Cloud Console, go to **APIs & Services** > **Library**
      2. Search for **"BigQuery API"**
      3. Click on it and press **"Enable"**
      
      ## Step 3: Create a Service Account
      
      1. Go to **IAM & Admin** > **Service Accounts**
      2. Click **"Create Service Account"**
      3. Enter a name (e.g., `starlake-service-account`)
      4. Add description: "Service account for Starlake BigQuery integration"
      5. Click **"Create and Continue"**
      
      ## Step 4: Assign Permissions
      
      Add these roles to your service account:
      
      - **BigQuery Data Editor**
      - **BigQuery Job User**
      - **BigQuery User**
      - **Storage Object Admin** (if using GCS)
      
      ## Step 5: Create and Download Key
      
      1. Click on your service account
      2. Go to **Keys** tab
      3. Click **"Add Key"** > **"Create new key"**
      4. Choose **JSON** format
      5. Download the key file and save it securely
      
      ## Step 6: Set Up Authentication
      
      ```bash
      # Set the path to your service account key
      export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/service-account-key.json"
      
      # Or authenticate using gcloud
      gcloud auth application-default login
      ```
  
  - id: 3
    label: Configure Starlake
    content: |
      # Configure Starlake for BigQuery
      
      Now let's configure Starlake to work with your BigQuery environment.
      
      ## Environment Variables
      
      Set the following environment variables:
      
      ```bash
      export GOOGLE_CLOUD_PROJECT=your-project-id
      export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
      export BIGQUERY_DATASET=starlake_dataset
      export BIGQUERY_LOCATION=US
      ```
      
      **Note**: Replace `your-project-id` with your actual Google Cloud project ID.
      
      ## Starlake Configuration
      
      Create a `starlake.conf` file in your project root:
      
      ```yaml
      connections:
        bigquery:
          type: "bigquery"
          project: "${GOOGLE_CLOUD_PROJECT}"
          dataset: "${BIGQUERY_DATASET}"
          location: "${BIGQUERY_LOCATION}"
          credentials: "${GOOGLE_APPLICATION_CREDENTIALS}"
          options:
            useLegacySql: false
            allowLargeResults: true
      
      # Global settings
      settings:
        default-connection: "bigquery"
        default-format: "PARQUET"
        default-mode: "FILE"
      ```
      
      ## Create BigQuery Dataset
      
      ```bash
      # Using bq command line tool
      bq mk --dataset \
        --location=US \
        ${GOOGLE_CLOUD_PROJECT}:${BIGQUERY_DATASET}
      
      # Or using gcloud
      gcloud bigquery datasets create ${BIGQUERY_DATASET} \
        --location=US \
        --project=${GOOGLE_CLOUD_PROJECT}
      ```
      
      ## Test Connection
      
      ```bash
      starlake test-connection --connection bigquery
      ```
  
  - id: 4
    label: Create your first pipeline
    content: |
      # Create Your First Pipeline
      
      Let's create a simple data pipeline using Starlake and BigQuery.
      
      ## Step 1: Define the Extract
      
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
      
      ## Step 2: Define the Load
      
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
      
      ## Step 3: Create Sample Data
      
      Create a sample CSV file `data/sales_sample.csv`:
      
      ```csv
      order_id,customer_id,product_id,amount,sale_date,created_at
      ORD001,CUST001,PROD001,150.50,2024-01-15,2024-01-15 10:30:00
      ORD002,CUST002,PROD002,299.99,2024-01-16,2024-01-16 14:20:00
      ORD003,CUST001,PROD003,75.25,2024-01-17,2024-01-17 09:15:00
      ```
      
      ## Step 4: Upload to Google Cloud Storage
      
      ```bash
      # Create a GCS bucket (if not exists)
      gsutil mb gs://your-bucket-name
      
      # Upload sample data
      gsutil cp data/sales_sample.csv gs://your-bucket-name/sales/
      ```
  
  - id: 5
    label: Deploy and monitor
    content: |
      # Deploy and Monitor
      
      Now let's deploy your pipeline and monitor its execution.
      
      ## Deploy the Pipeline
      
      ```bash
      # Extract data from source
      starlake extract --config extract/bigquery-sales.yml
      
      # Load data into BigQuery
      starlake load --config load/sales.yml
      
      # Or run both in sequence
      starlake run --extract-config extract/bigquery-sales.yml --load-config load/sales.yml
      ```
      
      ## Monitor Execution
      
      ### 1. Check Starlake Logs
      
      ```bash
      # View recent logs
      tail -f logs/starlake.log
      
      # Check execution status
      starlake status --job-id <job_id>
      ```
      
      ### 2. Monitor BigQuery Jobs
      
      ```bash
      # List recent jobs
      bq ls --jobs --max_results=10
      
      # Get job details
      bq show --job=true <job_id>
      ```
      
      ### 3. Verify Data in BigQuery
      
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
      
      ### 4. Monitor Costs
      
      ```bash
      # Check BigQuery usage
      bq query --use_legacy_sql=false "
        SELECT 
          job_type,
          SUM(total_bytes_processed) as bytes_processed,
          SUM(total_slot_ms) as slot_ms,
          COUNT(*) as job_count
        FROM \`region-us\`.INFORMATION_SCHEMA.JOBS_BY_PROJECT
        WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 24 HOUR)
        GROUP BY job_type
        ORDER BY bytes_processed DESC;
      "
      ```
      
      ## Next Steps
      
      - Set up scheduling with Cloud Scheduler
      - Configure alerts and notifications
      - Scale your pipelines as needed
      - Implement data quality checks
  
  - id: 6
    label: Next steps
    content: |
      # Next Steps
      
      Congratulations! You've successfully set up Starlake with BigQuery.
      
      ## What's Next?
      
      ### Advanced Configuration
      
      - **Data Quality**: Implement data validation rules
      - **Incremental Loading**: Set up efficient incremental updates
      - **Partitioning**: Optimize performance with table partitioning
      - **Clustering**: Improve query performance with clustering
      
      ### Scheduling and Orchestration
      
      ```bash
      # Set up Cloud Scheduler job
      gcloud scheduler jobs create http starlake-daily \
        --schedule="0 2 * * *" \
        --uri="https://your-function-url.com/trigger" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{"action":"run-pipeline"}'
      ```
      
      ### Monitoring and Alerting
      
      - Set up BigQuery alerts for job failures
      - Configure Cloud Monitoring dashboards
      - Monitor data quality metrics
      - Track pipeline performance and costs
      
      ### Security Enhancements
      
      - Implement row-level security (RLS)
      - Set up column-level security
      - Use BigQuery's data masking features
      - Configure IAM policies
      
      ## Resources
      
      - [Starlake Documentation](https://docs.starlake.ai)
      - [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
      - [BigQuery Best Practices](https://cloud.google.com/bigquery/docs/best-practices)
      - [Community Support](https://github.com/starlake-ai/starlake)
      
      ## Need Help?
      
      If you encounter any issues:
      1. Check the troubleshooting guide
      2. Review the logs for error messages
      3. Verify BigQuery permissions
      4. Check Google Cloud billing
      5. Reach out to the community
      
      ## Example Advanced Configuration
      
      ```yaml
      # Advanced BigQuery configuration
      connections:
        bigquery:
          type: "bigquery"
          project: "${GOOGLE_CLOUD_PROJECT}"
          dataset: "${BIGQUERY_DATASET}"
          location: "${BIGQUERY_LOCATION}"
          credentials: "${GOOGLE_APPLICATION_CREDENTIALS}"
          options:
            useLegacySql: false
            allowLargeResults: true
            maximumBytesBilled: "1000000000"
            priority: "INTERACTIVE"
      
      # Data quality rules
      quality:
        rules:
          - name: "amount_positive"
            sql: "amount > 0"
            severity: "ERROR"
          - name: "valid_dates"
            sql: "sale_date <= CURRENT_DATE()"
            severity: "WARNING"
      ```
---

This is a comprehensive quick start guide for using Starlake with Google BigQuery.
