---
author: Starlake Team
summary: Quick start guide for using Starlake with Databricks unified analytics platform
id: databricks_quickstart
categories: Databricks, Data Engineering, Cloud
status: Published
icon: databricks
title: Quickstart for starlake and Databricks
description: Get started with Starlake and Databricks in minutes
tags: Databricks, starlake, Data Engineering, Cloud, Quick Start
tabs:
  - id: 1
    label: Introduction
    content: |
      # Introduction to Starlake with Databricks
      
      Welcome to the Starlake Databricks quick start guide! This guide will walk you through setting up Starlake with Databricks unified analytics platform.
      
      ## What you'll learn
      
      - How to set up Databricks workspace and clusters
      - How to configure Starlake for Databricks
      - How to create your first data pipeline
      - How to deploy and monitor your pipelines
      
      ## Prerequisites
      
      - A Databricks workspace (Azure, AWS, or GCP)
      - Admin access to your Databricks workspace
      - Basic knowledge of Apache Spark and SQL
      - Starlake CLI installed
      - Python 3.8+ installed
      
      ## Why Databricks + Starlake?
      
      - **Unified Platform**: Data engineering, analytics, and ML in one place
      - **Scalability**: Auto-scaling clusters for any workload
      - **Performance**: Optimized Spark engine with Delta Lake
      - **Collaboration**: Multi-user workspace with version control
      - **Integration**: Native integration with cloud providers
      
      Let's get started!
  
  - id: 2
    label: Set up Databricks workspace
    content: |
      # Set up Databricks Workspace
      
      Before you can use Starlake with Databricks, you need to configure your Databricks workspace.
      
      ## Step 1: Create Databricks Workspace
      
      ### For Azure Databricks:
      
      1. Go to Azure Portal
      2. Search for **"Azure Databricks"**
      3. Click **"Create"**
      4. Fill in the required details:
         - **Workspace name**: `starlake-workspace`
         - **Subscription**: Your Azure subscription
         - **Resource group**: Create new or use existing
         - **Location**: Choose your preferred region
         - **Pricing tier**: Standard or Premium
      5. Click **"Review + Create"** then **"Create"**
      
      ### For AWS Databricks:
      
      1. Go to [Databricks AWS Console](https://accounts.cloud.databricks.com/)
      2. Click **"Create Workspace"**
      3. Choose **"AWS"** as cloud provider
      4. Fill in workspace details and click **"Create"**
      
      ### For GCP Databricks:
      
      1. Go to [Databricks GCP Console](https://accounts.gcp.databricks.com/)
      2. Click **"Create Workspace"**
      3. Choose **"GCP"** as cloud provider
      4. Fill in workspace details and click **"Create"**
      
      ## Step 2: Create a Cluster
      
      1. Open your Databricks workspace
      2. Go to **"Compute"** in the left sidebar
      3. Click **"Create Cluster"**
      4. Configure your cluster:
         - **Cluster name**: `starlake-cluster`
         - **Cluster mode**: **All-purpose** or **Single node**
         - **Databricks runtime version**: Choose latest LTS version
         - **Node type**: Choose based on your workload (e.g., `Standard_DS3_v2` for Azure)
         - **Min workers**: 1
         - **Max workers**: 2-4 (adjust based on needs)
         - **Auto-termination**: 30 minutes (for cost optimization)
      5. Click **"Create Cluster"**
      
      ## Step 3: Create a Personal Access Token
      
      1. In Databricks, click on your user profile (top right)
      2. Select **"User Settings"**
      3. Go to **"Access Tokens"** tab
      4. Click **"Generate New Token"**
      5. Add a comment (e.g., "Starlake integration")
      6. Click **"Generate"**
      7. **Copy and save the token** (you won't see it again!)
  
  - id: 3
    label: Configure Starlake
    content: |
      # Configure Starlake for Databricks
      
      Now let's configure Starlake to work with your Databricks environment.
      
      ## Environment Variables
      
      Set the following environment variables:
      
      ```bash
      export DATABRICKS_HOST=https://your-workspace.cloud.databricks.com
      export DATABRICKS_TOKEN=your-personal-access-token
      export DATABRICKS_CLUSTER_ID=your-cluster-id
      export DATABRICKS_CATALOG=starlake_catalog
      export DATABRICKS_SCHEMA=starlake_schema
      ```
      
      **Note**: Replace the values with your actual Databricks workspace details.
      
      ## Get Cluster ID
      
      To find your cluster ID:
      
      1. Go to **"Compute"** in Databricks
      2. Click on your cluster name
      3. Copy the cluster ID from the URL or cluster details
      
      ## Starlake Configuration
      
      Create a `starlake.conf` file in your project root:
      
      ```yaml
      connections:
        databricks:
          type: "databricks"
          host: "${DATABRICKS_HOST}"
          token: "${DATABRICKS_TOKEN}"
          cluster_id: "${DATABRICKS_CLUSTER_ID}"
          catalog: "${DATABRICKS_CATALOG}"
          schema: "${DATABRICKS_SCHEMA}"
          options:
            spark.sql.adaptive.enabled: true
            spark.sql.adaptive.coalescePartitions.enabled: true
      
      # Global settings
      settings:
        default-connection: "databricks"
        default-format: "DELTA"
        default-mode: "FILE"
      ```
      
      ## Create Unity Catalog (Optional)
      
      If using Unity Catalog:
      
      ```sql
      -- Create catalog
      CREATE CATALOG IF NOT EXISTS starlake_catalog;
      
      -- Create schema
      CREATE SCHEMA IF NOT EXISTS starlake_catalog.starlake_schema;
      
      -- Grant permissions
      GRANT ALL PRIVILEGES ON CATALOG starlake_catalog TO `your-user@domain.com`;
      GRANT ALL PRIVILEGES ON SCHEMA starlake_catalog.starlake_schema TO `your-user@domain.com`;
      ```
      
      ## Test Connection
      
      ```bash
      starlake test-connection --connection databricks
      ```
  
  - id: 4
    label: Create your first pipeline
    content: |
      # Create Your First Pipeline
      
      Let's create a simple data pipeline using Starlake and Databricks.
      
      ## Step 1: Define the Extract
      
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
      
      ## Step 2: Define the Load
      
      Create `load/sales.yml`:
      
      ```yaml
      table:
        pattern: "sales_data.*.parquet"
        metadata:
          mode: "FILE"
          format: "DELTA"
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
      
      ### For Azure:
      ```bash
      # Upload to Azure Blob Storage
      az storage blob upload-batch \
        --account-name your-storage-account \
        --container-name data \
        --source data/
      ```
      
      ### For AWS:
      ```bash
      # Upload to S3
      aws s3 cp data/sales_sample.csv s3://your-bucket/sales/
      ```
      
      ### For GCP:
      ```bash
      # Upload to GCS
      gsutil cp data/sales_sample.csv gs://your-bucket/sales/
      ```
  
  - id: 5
    label: Deploy and monitor
    content: |
      # Deploy and Monitor
      
      Now let's deploy your pipeline and monitor its execution.
      
      ## Deploy the Pipeline
      
      ```bash
      # Extract data from source
      starlake extract --config extract/databricks-sales.yml
      
      # Load data into Databricks
      starlake load --config load/sales.yml
      
      # Or run both in sequence
      starlake run --extract-config extract/databricks-sales.yml --load-config load/sales.yml
      ```
      
      ## Monitor Execution
      
      ### 1. Check Starlake Logs
      
      ```bash
      # View recent logs
      tail -f logs/starlake.log
      
      # Check execution status
      starlake status --job-id <job_id>
      ```
      
      ### 2. Monitor Databricks Jobs
      
      1. Go to **"Workflows"** in Databricks
      2. Click on your job to view details
      3. Check the **"Runs"** tab for execution history
      4. Click on a run to see detailed logs
      
      ### 3. Monitor Cluster Usage
      
      1. Go to **"Compute"** in Databricks
      2. Click on your cluster
      3. Check the **"Metrics"** tab for:
         - CPU usage
         - Memory usage
         - Network I/O
         - Cost tracking
      
      ### 4. Verify Data in Databricks
      
      Open a notebook in Databricks and run:
      
      ```sql
      -- Check loaded data
      SELECT COUNT(*) as total_rows 
      FROM starlake_catalog.starlake_schema.sales_data;
      
      -- Sample data
      SELECT * 
      FROM starlake_catalog.starlake_schema.sales_data 
      LIMIT 10;
      
      -- Data quality check
      SELECT 
        COUNT(*) as total_orders,
        SUM(amount) as total_amount,
        MIN(sale_date) as earliest_sale,
        MAX(sale_date) as latest_sale
      FROM starlake_catalog.starlake_schema.sales_data;
      ```
      
      ### 5. Check Delta Lake History
      
      ```sql
      -- View table history
      DESCRIBE HISTORY starlake_catalog.starlake_schema.sales_data;
      
      -- Check table details
      DESCRIBE DETAIL starlake_catalog.starlake_schema.sales_data;
      ```
      
      ## Next Steps
      
      - Set up scheduling with Databricks Jobs
      - Configure alerts and notifications
      - Scale your pipelines as needed
      - Implement data quality checks
  
  - id: 6
    label: Next steps
    content: |
      # Next Steps
      
      Congratulations! You've successfully set up Starlake with Databricks.
      
      ## What's Next?
      
      ### Advanced Configuration
      
      - **Data Quality**: Implement data validation rules
      - **Incremental Loading**: Set up efficient incremental updates
      - **Partitioning**: Optimize performance with table partitioning
      - **Z-Ordering**: Improve query performance with Z-ordering
      
      ### Scheduling and Orchestration
      
      ```python
      # Create a Databricks job
      from databricks_api import DatabricksAPI
      
      db = DatabricksAPI(
        host=DATABRICKS_HOST,
        token=DATABRICKS_TOKEN
      )
      
      # Create job
      job = db.jobs.create_job(
        name="Starlake Daily Pipeline",
        existing_cluster_id=DATABRICKS_CLUSTER_ID,
        notebook_task={
          "notebook_path": "/Shared/starlake-pipeline",
          "base_parameters": {
            "config_path": "extract/databricks-sales.yml"
          }
        },
        schedule={
          "quartz_cron_expression": "0 0 2 * * ?",
          "timezone_id": "UTC"
        }
      )
      ```
      
      ### Monitoring and Alerting
      
      - Set up Databricks alerts for job failures
      - Configure cluster auto-scaling
      - Monitor data quality metrics
      - Track pipeline performance and costs
      
      ### Security Enhancements
      
      - Implement row-level security (RLS)
      - Set up column-level security
      - Use Unity Catalog for data governance
      - Configure network security
      
      ## Resources
      
      - [Starlake Documentation](https://docs.starlake.ai)
      - [Databricks Documentation](https://docs.databricks.com)
      - [Delta Lake Documentation](https://docs.delta.io)
      - [Community Support](https://github.com/starlake-ai/starlake)
      
      ## Need Help?
      
      If you encounter any issues:
      1. Check the troubleshooting guide
      2. Review the logs for error messages
      3. Verify Databricks permissions
      4. Check cluster configuration
      5. Reach out to the community
      
      ## Example Advanced Configuration
      
      ```yaml
      # Advanced Databricks configuration
      connections:
        databricks:
          type: "databricks"
          host: "${DATABRICKS_HOST}"
          token: "${DATABRICKS_TOKEN}"
          cluster_id: "${DATABRICKS_CLUSTER_ID}"
          catalog: "${DATABRICKS_CATALOG}"
          schema: "${DATABRICKS_SCHEMA}"
          options:
            spark.sql.adaptive.enabled: true
            spark.sql.adaptive.coalescePartitions.enabled: true
            spark.databricks.delta.optimizeWrite.enabled: true
            spark.databricks.delta.autoCompact.enabled: true
            spark.databricks.delta.properties.defaults.enableChangeDataFeed: true
      
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
        zOrderBy: ["customer_id", "product_id"]
        optimizeWrite: true
        autoCompact: true
      ```
---

This is a comprehensive quick start guide for using Starlake with Databricks unified analytics platform.
