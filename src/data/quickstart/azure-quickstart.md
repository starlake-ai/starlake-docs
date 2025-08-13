---
title: "Quickstart for Starlake and Azure"
id: "azure"
level: 'Beginner'
icon: 'azure'
tags: ['Azure']
hide_table_of_contents: true
description: "Get started with Starlake and Azure data services in minutes"
---

<div style={{maxWidth: '900px'}}>

## Introduction

In this quickstart guide, you'll learn how to use Starlake with Azure data services. It will show you how to: 

- Set up Azure credentials and permissions
- Configure Starlake for Azure
- Create your first data pipeline
- Deploy and monitor your pipelines

### Prerequisites

- An Azure account (trial or paid)
- Basic knowledge of Azure services
- Starlake CLI installed
- Access to create storage accounts and databases

Let's get started!

## Set up Azure credentials

Before you can use Starlake with Azure, you need to configure your Azure credentials and permissions.

### Step 1: Create an Azure Service Principal

1. Log in to your Azure portal
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **"New registration"**
4. Enter a name (e.g., `starlake-app`)
5. Select **"Accounts in this organizational directory only"**
6. Click **"Register"**

### Step 2: Get Application Credentials

1. Note the **Application (client) ID** and **Directory (tenant) ID**
2. Go to **Certificates & secrets**
3. Click **"New client secret"**
4. Add a description and select expiration
5. Copy the **Value** (this is your client secret)

### Step 3: Assign Permissions

1. Go to **API permissions**
2. Click **"Add a permission"**
3. Select **"Azure Storage"** and **"Delegated permissions"**
4. Select **"user_impersonation"**
5. Click **"Grant admin consent"**

## Configure Starlake

Now let's configure Starlake to work with your Azure environment.

### Environment Variables

Set the following environment variables in your shell:

```bash
export AZURE_TENANT_ID=your_tenant_id
export AZURE_CLIENT_ID=your_client_id
export AZURE_CLIENT_SECRET=your_client_secret
export AZURE_SUBSCRIPTION_ID=your_subscription_id
export AZURE_STORAGE_ACCOUNT=your_storage_account
export AZURE_STORAGE_KEY=your_storage_key
```

### Starlake Configuration

Create a `starlake.conf` file in your project root:

```yaml
connections:
  azure:
    type: "azure"
    tenant_id: "${AZURE_TENANT_ID}"
    client_id: "${AZURE_CLIENT_ID}"
    client_secret: "${AZURE_CLIENT_SECRET}"
    subscription_id: "${AZURE_SUBSCRIPTION_ID}"
    storage_account: "${AZURE_STORAGE_ACCOUNT}"
    storage_key: "${AZURE_STORAGE_KEY}"
    options:
      container: "starlake-data"
      endpoint: "https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"

# Global settings
settings:
  default-connection: "azure"
  default-format: "PARQUET"
  default-mode: "FILE"
```

### Test Connection

Test your connection with:

```bash
starlake test-connection --connection azure
```

## Create your first pipeline

Let's create a simple data pipeline using Starlake and Azure.

### Step 1: Define the Extract

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
starlake extract --config extract/azure-sales.yml

# Load data into Azure
starlake load --config load/sales.yml

# Or run both in sequence
starlake run --extract-config extract/azure-sales.yml --load-config load/sales.yml
```

### Monitor Execution

#### 1. Check Starlake Logs

```bash
# View recent logs
tail -f logs/starlake.log

# Check execution status
starlake status --job-id <job_id>
```

#### 2. Monitor Azure Services

- Check Azure Storage for uploaded files
- Monitor Azure Monitor logs
- Review Azure Data Factory job status

#### 3. Verify Data in Azure

```bash
# Check loaded data
az storage blob list --container-name starlake-data --account-name your_storage_account

# Sample data
az storage blob download --container-name starlake-data --name sales_data/part-00000.parquet --file - --account-name your_storage_account
```

### Next Steps

- Set up scheduling with Azure Data Factory
- Configure alerts and notifications
- Scale your pipelines as needed
- Implement data quality checks

## Next steps

Congratulations! You've successfully set up Starlake with Azure.

### What's Next?

#### Advanced Configuration

- **Data Quality**: Implement data validation rules
- **Incremental Loading**: Set up efficient incremental updates
- **Partitioning**: Optimize performance with table partitioning
- **Clustering**: Improve query performance with clustering keys

#### Scheduling and Orchestration

```bash
# Set up Azure Data Factory pipeline
az datafactory pipeline create --resource-group your-rg --factory-name your-factory --name starlake-pipeline --pipeline @pipeline.json
```

#### Monitoring and Alerting

- Set up Azure Monitor alerts
- Configure Starlake notifications
- Monitor data quality metrics
- Track pipeline performance

#### Security Enhancements

- Implement Azure AD authentication
- Set up storage account policies
- Use Azure Key Vault for secrets
- Configure network security groups

### Resources

- [Starlake Documentation](https://docs.starlake.ai)
- [Azure Documentation](https://docs.microsoft.com/azure)
- [Azure Best Practices](https://docs.microsoft.com/azure/architecture/best-practices/)
- [Community Support](https://github.com/starlake-ai/starlake)

### Need Help?

If you encounter any issues:
1. Check the troubleshooting guide
2. Review the logs for error messages
3. Verify Azure permissions
4. Reach out to the community

### Example Advanced Configuration

```yaml
# Advanced Azure configuration
connections:
  azure:
    type: "azure"
    tenant_id: "${AZURE_TENANT_ID}"
    client_id: "${AZURE_CLIENT_ID}"
    client_secret: "${AZURE_CLIENT_SECRET}"
    subscription_id: "${AZURE_SUBSCRIPTION_ID}"
    storage_account: "${AZURE_STORAGE_ACCOUNT}"
    storage_key: "${AZURE_STORAGE_KEY}"
    options:
      container: "starlake-data"
      endpoint: "https://${AZURE_STORAGE_ACCOUNT}.blob.core.windows.net"
      encryption: "AES256"
      lifecycle_policy: true
      versioning: true
```

</div>
