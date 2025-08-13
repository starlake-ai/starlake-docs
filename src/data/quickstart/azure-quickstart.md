---
author: Starlake Team
summary: Quick start guide for using Starlake with Microsoft Azure data services
id: azure_quickstart
categories: Azure, Data Engineering, Cloud
status: Published
icon: azure
title: Quickstart for dbt and Azure
description: Get started with Starlake and Azure data services in minutes
tags: Azure, dbt, Data Engineering, Cloud, Quick Start
tabs:
  - id: 1
    label: Introduction
    content: |
      # Introduction to Starlake with Azure
      
      Welcome to the Starlake Azure quick start guide! This guide will walk you through setting up Starlake with Microsoft Azure data services.
      
      ## What you'll learn
      
      - How to set up Azure resources and permissions
      - How to configure Starlake for Azure services
      - How to create your first data pipeline
      - How to deploy and monitor your pipelines
      
      ## Prerequisites
      
      - An Azure subscription
      - Azure CLI installed and configured
      - Basic knowledge of Azure services
      - Starlake CLI installed
      - PowerShell or Bash shell
      
      ## Why Azure + Starlake?
      
      - **Integrated Services**: Seamless integration with Azure data services
      - **Scalability**: Auto-scaling with Azure's cloud infrastructure
      - **Security**: Enterprise-grade security with Azure AD
      - **Cost-effective**: Pay-as-you-go pricing model
      - **Compliance**: Built-in compliance and governance features
      
      Let's get started!
  
  - id: 2
    label: Set up Azure resources
    content: |
      # Set up Azure Resources
      
      Before you can use Starlake with Azure, you need to configure your Azure resources and permissions.
      
      ## Step 1: Create Azure Resource Group
      
      ```bash
      # Login to Azure
      az login
      
      # Create resource group
      az group create \
        --name starlake-rg \
        --location eastus \
        --tags environment=dev project=starlake
      ```
      
      ## Step 2: Create Azure Storage Account
      
      ```bash
      # Create storage account
      az storage account create \
        --name starlakestorage \
        --resource-group starlake-rg \
        --location eastus \
        --sku Standard_LRS \
        --kind StorageV2 \
        --https-only true
      
      # Get storage account key
      STORAGE_KEY=$(az storage account keys list \
        --account-name starlakestorage \
        --resource-group starlake-rg \
        --query '[0].value' -o tsv)
      ```
      
      ## Step 3: Create Azure Data Lake Storage Gen2
      
      ```bash
      # Create container for data
      az storage container create \
        --name data \
        --account-name starlakestorage \
        --account-key $STORAGE_KEY
      
      # Create container for logs
      az storage container create \
        --name logs \
        --account-name starlakestorage \
        --account-key $STORAGE_KEY
      ```
      
      ## Step 4: Create Azure Synapse Analytics (Optional)
      
      ```bash
      # Create Synapse workspace
      az synapse workspace create \
        --name starlake-synapse \
        --resource-group starlake-rg \
        --storage-account starlakestorage \
        --file-system data \
        --sql-admin-login-user starlakeadmin \
        --sql-admin-login-password YourSecurePassword123! \
        --location eastus
      
      # Create SQL pool
      az synapse sql pool create \
        --name starlake-pool \
        --workspace-name starlake-synapse \
        --resource-group starlake-rg \
        --performance-level DW100c
      ```
      
      ## Step 5: Create Service Principal
      
      ```bash
      # Create service principal
      SP_INFO=$(az ad sp create-for-rbac \
        --name starlake-sp \
        --role contributor \
        --scopes /subscriptions/$(az account show --query id -o tsv)/resourceGroups/starlake-rg)
      
      # Extract credentials
      CLIENT_ID=$(echo $SP_INFO | jq -r '.appId')
      CLIENT_SECRET=$(echo $SP_INFO | jq -r '.password')
      TENANT_ID=$(echo $SP_INFO | jq -r '.tenant')
      ```
  
  - id: 3
    label: Configure Starlake
    content: |
      # Configure Starlake for Azure
      
      Now let's configure Starlake to work with your Azure environment.
      
      ## Environment Variables
      
      Set the following environment variables:
      
      ```bash
      export AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)
      export AZURE_TENANT_ID=$TENANT_ID
      export AZURE_CLIENT_ID=$CLIENT_ID
      export AZURE_CLIENT_SECRET=$CLIENT_SECRET
      export AZURE_STORAGE_ACCOUNT=starlakestorage
      export AZURE_STORAGE_KEY=$STORAGE_KEY
      export AZURE_SYNAPSE_WORKSPACE=starlake-synapse
      export AZURE_SYNAPSE_POOL=starlake-pool
      ```
      
      ## Starlake Configuration
      
      Create a `starlake.conf` file in your project root:
      
      ```yaml
      connections:
        azure:
          type: "azure"
          subscription_id: "${AZURE_SUBSCRIPTION_ID}"
          tenant_id: "${AZURE_TENANT_ID}"
          client_id: "${AZURE_CLIENT_ID}"
          client_secret: "${AZURE_CLIENT_SECRET}"
          storage_account: "${AZURE_STORAGE_ACCOUNT}"
          storage_key: "${AZURE_STORAGE_KEY}"
          synapse_workspace: "${AZURE_SYNAPSE_WORKSPACE}"
          synapse_pool: "${AZURE_SYNAPSE_POOL}"
          options:
            spark.sql.adaptive.enabled: true
            spark.sql.adaptive.coalescePartitions.enabled: true
      
      # Global settings
      settings:
        default-connection: "azure"
        default-format: "PARQUET"
        default-mode: "FILE"
      ```
      
      ## Test Connection
      
      ```bash
      starlake test-connection --connection azure
      ```
      
      ## Create Azure Data Factory (Optional)
      
      ```bash
      # Create Data Factory
      az datafactory create \
        --name starlake-adf \
        --resource-group starlake-rg \
        --location eastus
      
      # Create linked service for storage
      az datafactory linked-service create \
        --factory-name starlake-adf \
        --resource-group starlake-rg \
        --name AzureStorageLinkedService \
        --properties '{
          "type": "AzureStorage",
          "typeProperties": {
            "connectionString": {
              "type": "SecureString",
              "value": "DefaultEndpointsProtocol=https;AccountName=starlakestorage;AccountKey='$STORAGE_KEY'"
            }
          }
        }'
      ```
  
  - id: 4
    label: Create your first pipeline
    content: |
      # Create Your First Pipeline
      
      Let's create a simple data pipeline using Starlake and Azure.
      
      ## Step 1: Define the Extract
      
      Create `extract/azure-sales.yml`:
      
      ```yaml
      extract:
        connectionRef: "azure"
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
      
      ## Step 4: Upload to Azure Storage
      
      ```bash
      # Upload sample data to Azure Blob Storage
      az storage blob upload-batch \
        --account-name starlakestorage \
        --account-key $STORAGE_KEY \
        --source data/ \
        --destination data
      ```
  
  - id: 5
    label: Deploy and monitor
    content: |
      # Deploy and Monitor
      
      Now let's deploy your pipeline and monitor its execution.
      
      ## Deploy the Pipeline
      
      ```bash
      # Extract data from source
      starlake extract --config extract/azure-sales.yml
      
      # Load data into Azure
      starlake load --config load/sales.yml
      
      # Or run both in sequence
      starlake run --extract-config extract/azure-sales.yml --load-config load/sales.yml
      ```
      
      ## Monitor Execution
      
      ### 1. Check Starlake Logs
      
      ```bash
      # View recent logs
      tail -f logs/starlake.log
      
      # Check execution status
      starlake status --job-id <job_id>
      ```
      
      ### 2. Monitor Azure Resources
      
      ```bash
      # Check storage account usage
      az storage account show \
        --name starlakestorage \
        --resource-group starlake-rg \
        --query "usageInBytes"
      
      # List blobs in container
      az storage blob list \
        --account-name starlakestorage \
        --account-key $STORAGE_KEY \
        --container-name data \
        --output table
      ```
      
      ### 3. Monitor Synapse Analytics (if using)
      
      ```sql
      -- Connect to Synapse SQL pool
      -- Check loaded data
      SELECT COUNT(*) as total_rows 
      FROM starlake_schema.sales_data;
      
      -- Sample data
      SELECT * 
      FROM starlake_schema.sales_data 
      LIMIT 10;
      
      -- Data quality check
      SELECT 
        COUNT(*) as total_orders,
        SUM(amount) as total_amount,
        MIN(sale_date) as earliest_sale,
        MAX(sale_date) as latest_sale
      FROM starlake_schema.sales_data;
      ```
      
      ### 4. Monitor Data Factory (if using)
      
      ```bash
      # List pipelines
      az datafactory pipeline list \
        --factory-name starlake-adf \
        --resource-group starlake-rg
      
      # Get pipeline run details
      az datafactory pipeline-run show \
        --factory-name starlake-adf \
        --resource-group starlake-rg \
        --run-id <run_id>
      ```
      
      ### 5. Set up Azure Monitor Alerts
      
      ```bash
      # Create action group for alerts
      az monitor action-group create \
        --name starlake-alerts \
        --resource-group starlake-rg \
        --short-name starlake \
        --action email admin@yourcompany.com
      
      # Create alert rule for storage account
      az monitor metrics alert create \
        --name storage-alert \
        --resource-group starlake-rg \
        --scopes /subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/starlake-rg/providers/Microsoft.Storage/storageAccounts/starlakestorage \
        --condition "avg UsedCapacity > 1000000000" \
        --action /subscriptions/$AZURE_SUBSCRIPTION_ID/resourceGroups/starlake-rg/providers/microsoft.insights/actionGroups/starlake-alerts
      ```
      
      ## Next Steps
      
      - Set up scheduling with Azure Logic Apps
      - Configure alerts and notifications
      - Scale your pipelines as needed
      - Implement data quality checks
  
  - id: 6
    label: Next steps
    content: |
      # Next Steps
      
      Congratulations! You've successfully set up Starlake with Azure.
      
      ## What's Next?
      
      ### Advanced Configuration
      
      - **Data Quality**: Implement data validation rules
      - **Incremental Loading**: Set up efficient incremental updates
      - **Partitioning**: Optimize performance with table partitioning
      - **Security**: Implement Azure AD authentication and RBAC
      
      ### Scheduling and Orchestration
      
      ```bash
      # Create Logic App for scheduling
      az logic workflow create \
        --name starlake-scheduler \
        --resource-group starlake-rg \
        --location eastus \
        --definition '{
          "triggers": {
            "Recurrence": {
              "recurrence": {
                "frequency": "Day",
                "interval": 1
              },
              "type": "Recurrence"
            }
          },
          "actions": {
            "CallStarlake": {
              "type": "Http",
              "inputs": {
                "method": "POST",
                "uri": "https://your-function-url.com/api/trigger",
                "body": {
                  "action": "run-pipeline"
                }
              }
            }
          }
        }'
      ```
      
      ### Monitoring and Alerting
      
      - Set up Azure Monitor dashboards
      - Configure Application Insights
      - Monitor data quality metrics
      - Track pipeline performance and costs
      
      ### Security Enhancements
      
      - Implement Azure AD authentication
      - Set up role-based access control (RBAC)
      - Use Azure Key Vault for secrets
      - Configure network security groups
      
      ## Resources
      
      - [Starlake Documentation](https://docs.starlake.ai)
      - [Azure Documentation](https://docs.microsoft.com/azure)
      - [Azure Synapse Analytics](https://docs.microsoft.com/azure/synapse-analytics)
      - [Azure Data Factory](https://docs.microsoft.com/azure/data-factory)
      - [Community Support](https://github.com/starlake-ai/starlake)
      
      ## Need Help?
      
      If you encounter any issues:
      1. Check the troubleshooting guide
      2. Review the logs for error messages
      3. Verify Azure permissions
      4. Check Azure subscription limits
      5. Reach out to the community
      
      ## Example Advanced Configuration
      
      ```yaml
      # Advanced Azure configuration
      connections:
        azure:
          type: "azure"
          subscription_id: "${AZURE_SUBSCRIPTION_ID}"
          tenant_id: "${AZURE_TENANT_ID}"
          client_id: "${AZURE_CLIENT_ID}"
          client_secret: "${AZURE_CLIENT_SECRET}"
          storage_account: "${AZURE_STORAGE_ACCOUNT}"
          storage_key: "${AZURE_STORAGE_KEY}"
          synapse_workspace: "${AZURE_SYNAPSE_WORKSPACE}"
          synapse_pool: "${AZURE_SYNAPSE_POOL}"
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
        optimizeWrite: true
        autoCompact: true
      ```
---

This is a comprehensive quick start guide for using Starlake with Microsoft Azure data services.
