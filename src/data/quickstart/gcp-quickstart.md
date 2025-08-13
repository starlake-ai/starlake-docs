---
author: Starlake Team
summary: Quick start guide for using Starlake with Google Cloud Platform
id: gcp_quickstart
categories: GCP, Data Engineering, Cloud
status: Published
icon: gcp
title: Quickstart for starlake and GCP
description: Get started with Starlake and Google Cloud Platform in minutes
tags: GCP, starlake, Data Engineering, Cloud, Quick Start
tabs:
  - id: 1
    label: Introduction
    content: |
      # Introduction to Starlake with GCP
      
      Welcome to the Starlake Google Cloud Platform quick start guide! This guide will walk you through setting up Starlake with Google Cloud Platform.
      
      ## What you'll learn
      
      - How to set up Google Cloud resources and permissions
      - How to configure Starlake for GCP services
      - How to create your first data pipeline
      - How to deploy and monitor your pipelines
      
      ## Prerequisites
      
      - A Google Cloud Platform account
      - Google Cloud SDK installed and configured
      - Basic knowledge of GCP services
      - Starlake CLI installed
      - Billing enabled on your GCP project
      
      ## Why GCP + Starlake?
      
      - **Serverless**: No infrastructure management required
      - **Scalability**: Auto-scaling with Google's infrastructure
      - **Cost-effective**: Pay only for what you use
      - **Integration**: Native integration with Google Cloud services
      - **Performance**: Optimized for Google's data services
      
      Let's get started!
  
  - id: 2
    label: Set up GCP resources
    content: |
      # Set up GCP Resources
      
      Before you can use Starlake with GCP, you need to configure your Google Cloud resources and permissions.
      
      ## Step 1: Create GCP Project
      
      ```bash
      # Set your project ID
      export PROJECT_ID=your-project-id
      
      # Create new project (optional)
      gcloud projects create $PROJECT_ID --name="Starlake Project"
      
      # Set the project as default
      gcloud config set project $PROJECT_ID
      
      # Enable billing (required for most services)
      gcloud billing projects link $PROJECT_ID --billing-account=YOUR_BILLING_ACCOUNT_ID
      ```
      
      ## Step 2: Enable Required APIs
      
      ```bash
      # Enable BigQuery API
      gcloud services enable bigquery.googleapis.com
      
      # Enable Cloud Storage API
      gcloud services enable storage.googleapis.com
      
      # Enable Cloud Functions API (for serverless)
      gcloud services enable cloudfunctions.googleapis.com
      
      # Enable Cloud Scheduler API (for scheduling)
      gcloud services enable cloudscheduler.googleapis.com
      
      # Enable Cloud Build API (for CI/CD)
      gcloud services enable cloudbuild.googleapis.com
      ```
      
      ## Step 3: Create Cloud Storage Bucket
      
      ```bash
      # Create a unique bucket name
      export BUCKET_NAME=starlake-data-$(date +%s)
      
      # Create bucket
      gsutil mb -l us-central1 gs://$BUCKET_NAME
      
      # Create folders for data organization
      gsutil mkdir gs://$BUCKET_NAME/data
      gsutil mkdir gs://$BUCKET_NAME/logs
      gsutil mkdir gs://$BUCKET_NAME/temp
      ```
      
      ## Step 4: Create BigQuery Dataset
      
      ```bash
      # Create BigQuery dataset
      bq mk --dataset \
        --location=US \
        $PROJECT_ID:starlake_dataset
      
      # Create schema for your data
      bq mk --table \
        --location=US \
        $PROJECT_ID:starlake_dataset.sales_data \
        order_id:STRING,customer_id:STRING,product_id:STRING,amount:FLOAT,sale_date:DATE,created_at:TIMESTAMP
      ```
      
      ## Step 5: Create Service Account
      
      ```bash
      # Create service account
      gcloud iam service-accounts create starlake-sa \
        --display-name="Starlake Service Account" \
        --description="Service account for Starlake GCP integration"
      
      # Get service account email
      export SA_EMAIL=starlake-sa@$PROJECT_ID.iam.gserviceaccount.com
      
      # Grant BigQuery permissions
      gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/bigquery.dataEditor"
      
      gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/bigquery.jobUser"
      
      # Grant Cloud Storage permissions
      gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:$SA_EMAIL" \
        --role="roles/storage.objectAdmin"
      
      # Create and download key
      gcloud iam service-accounts keys create starlake-sa-key.json \
        --iam-account=$SA_EMAIL
      ```
  
  - id: 3
    label: Configure Starlake
    content: |
      # Configure Starlake for GCP
      
      Now let's configure Starlake to work with your GCP environment.
      
      ## Environment Variables
      
      Set the following environment variables:
      
      ```bash
      export GOOGLE_CLOUD_PROJECT=$PROJECT_ID
      export GOOGLE_APPLICATION_CREDENTIALS=/path/to/starlake-sa-key.json
      export GCP_BUCKET_NAME=$BUCKET_NAME
      export BIGQUERY_DATASET=starlake_dataset
      export BIGQUERY_LOCATION=US
      ```
      
      ## Starlake Configuration
      
      Create a `starlake.conf` file in your project root:
      
      ```yaml
      connections:
        gcp:
          type: "gcp"
          project: "${GOOGLE_CLOUD_PROJECT}"
          credentials: "${GOOGLE_APPLICATION_CREDENTIALS}"
          bucket: "${GCP_BUCKET_NAME}"
          dataset: "${BIGQUERY_DATASET}"
          location: "${BIGQUERY_LOCATION}"
          options:
            spark.sql.adaptive.enabled: true
            spark.sql.adaptive.coalescePartitions.enabled: true
      
      # Global settings
      settings:
        default-connection: "gcp"
        default-format: "PARQUET"
        default-mode: "FILE"
      ```
      
      ## Test Connection
      
      ```bash
      starlake test-connection --connection gcp
      ```
      
      ## Create Cloud Functions (Optional)
      
      ```bash
      # Create function for pipeline triggers
      gcloud functions deploy starlake-trigger \
        --runtime python39 \
        --trigger-http \
        --allow-unauthenticated \
        --entry-point trigger_pipeline \
        --source ./functions \
        --set-env-vars PROJECT_ID=$PROJECT_ID,BUCKET_NAME=$BUCKET_NAME
      ```
      
      ## Set up Cloud Scheduler (Optional)
      
      ```bash
      # Create scheduled job
      gcloud scheduler jobs create http starlake-daily \
        --schedule="0 2 * * *" \
        --uri="https://your-function-url.com/trigger" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{"action":"run-pipeline"}'
      ```
  
  - id: 4
    label: Create your first pipeline
    content: |
      # Create Your First Pipeline
      
      Let's create a simple data pipeline using Starlake and GCP.
      
      ## Step 1: Define the Extract
      
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
      
      ## Step 4: Upload to Cloud Storage
      
      ```bash
      # Upload sample data to Cloud Storage
      gsutil cp data/sales_sample.csv gs://$BUCKET_NAME/data/
      
      # Set appropriate permissions
      gsutil iam ch serviceAccount:$SA_EMAIL:objectViewer gs://$BUCKET_NAME
      ```
  
  - id: 5
    label: Deploy and monitor
    content: |
      # Deploy and Monitor
      
      Now let's deploy your pipeline and monitor its execution.
      
      ## Deploy the Pipeline
      
      ```bash
      # Extract data from source
      starlake extract --config extract/gcp-sales.yml
      
      # Load data into BigQuery
      starlake load --config load/sales.yml
      
      # Or run both in sequence
      starlake run --extract-config extract/gcp-sales.yml --load-config load/sales.yml
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
      
      # Check query history
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
      
      ### 3. Monitor Cloud Storage
      
      ```bash
      # List objects in bucket
      gsutil ls gs://$BUCKET_NAME/data/
      
      # Check bucket usage
      gsutil du -sh gs://$BUCKET_NAME/
      
      # Monitor storage class
      gsutil ls -L gs://$BUCKET_NAME/
      ```
      
      ### 4. Verify Data in BigQuery
      
      ```sql
      -- Check loaded data
      SELECT COUNT(*) as total_rows 
      FROM `$PROJECT_ID.starlake_dataset.sales_data`;
      
      -- Sample data
      SELECT * 
      FROM `$PROJECT_ID.starlake_dataset.sales_data` 
      LIMIT 10;
      
      -- Data quality check
      SELECT 
        COUNT(*) as total_orders,
        SUM(amount) as total_amount,
        MIN(sale_date) as earliest_sale,
        MAX(sale_date) as latest_sale
      FROM `$PROJECT_ID.starlake_dataset.sales_data`;
      ```
      
      ### 5. Set up Cloud Monitoring
      
      ```bash
      # Create monitoring workspace
      gcloud monitoring workspaces create \
        --display-name="Starlake Monitoring"
      
      # Create alerting policy
      gcloud alpha monitoring policies create \
        --policy-from-file=alert-policy.yaml
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
      
      Congratulations! You've successfully set up Starlake with Google Cloud Platform.
      
      ## What's Next?
      
      ### Advanced Configuration
      
      - **Data Quality**: Implement data validation rules
      - **Incremental Loading**: Set up efficient incremental updates
      - **Partitioning**: Optimize performance with table partitioning
      - **Clustering**: Improve query performance with clustering
      
      ### Scheduling and Orchestration
      
      ```bash
      # Create Cloud Scheduler job
      gcloud scheduler jobs create http starlake-daily \
        --schedule="0 2 * * *" \
        --uri="https://your-function-url.com/trigger" \
        --http-method=POST \
        --headers="Content-Type=application/json" \
        --message-body='{"action":"run-pipeline"}'
      
      # Create Cloud Build trigger for CI/CD
      gcloud builds triggers create github \
        --name="starlake-pipeline" \
        --repo-name="your-repo" \
        --branch-pattern="main" \
        --build-config="cloudbuild.yaml"
      ```
      
      ### Monitoring and Alerting
      
      - Set up BigQuery alerts for job failures
      - Configure Cloud Monitoring dashboards
      - Monitor data quality metrics
      - Track pipeline performance and costs
      
      ### Security Enhancements
      
      - Implement IAM policies
      - Set up VPC Service Controls
      - Use Cloud KMS for encryption
      - Configure Data Loss Prevention (DLP)
      
      ## Resources
      
      - [Starlake Documentation](https://docs.starlake.ai)
      - [Google Cloud Documentation](https://cloud.google.com/docs)
      - [BigQuery Documentation](https://cloud.google.com/bigquery/docs)
      - [Cloud Storage Documentation](https://cloud.google.com/storage/docs)
      - [Community Support](https://github.com/starlake-ai/starlake)
      
      ## Need Help?
      
      If you encounter any issues:
      1. Check the troubleshooting guide
      2. Review the logs for error messages
      3. Verify GCP permissions
      4. Check billing and quotas
      5. Reach out to the community
      
      ## Example Advanced Configuration
      
      ```yaml
      # Advanced GCP configuration
      connections:
        gcp:
          type: "gcp"
          project: "${GOOGLE_CLOUD_PROJECT}"
          credentials: "${GOOGLE_APPLICATION_CREDENTIALS}"
          bucket: "${GCP_BUCKET_NAME}"
          dataset: "${BIGQUERY_DATASET}"
          location: "${BIGQUERY_LOCATION}"
          options:
            spark.sql.adaptive.enabled: true
            spark.sql.adaptive.coalescePartitions.enabled: true
            spark.sql.adaptive.skewJoin.enabled: true
      
      # Data quality rules
      quality:
        rules:
          - name: "amount_positive"
            sql: "amount > 0"
            severity: "ERROR"
          - name: "valid_dates"
            sql: "sale_date <= CURRENT_DATE()"
            severity: "WARNING"
      
      # Performance optimization
      performance:
        partitionBy: ["sale_date"]
        clusterBy: ["customer_id", "product_id"]
        optimizeWrite: true
        autoCompact: true
      ```
---

This is a comprehensive quick start guide for using Starlake with Google Cloud Platform.
