---
title: "Quickstart for Starlake and AWS"
id: "aws"
level: 'Beginner'
icon: 'aws'
tags: ['AWS']
hide_table_of_contents: true
description: "Get started with Starlake and AWS data services in minutes"
---

<div style={{maxWidth: '900px'}}>

## Introduction

In this quickstart guide, you'll learn how to use Starlake with AWS data services. It will show you how to: 

- Set up AWS credentials
- Configure Starlake for AWS
- Create your first data pipeline
- Deploy and monitor your pipelines

### Prerequisites

- An AWS account
- Basic knowledge of AWS services
- Starlake CLI installed

Let's get started!

## Set up AWS credentials

Before you can use Starlake with AWS, you need to configure your AWS credentials.

### Step 1: Create an IAM User

1. Log in to your AWS Management Console
2. Navigate to IAM service
3. Click "Users" and then "Add user"
4. Enter a username (e.g., "starlake-user")
5. Select "Programmatic access"

### Step 2: Attach Permissions

Attach the following policies to your user:
- AmazonS3FullAccess
- AmazonRedshiftFullAccess
- AmazonGlueFullAccess

### Step 3: Get Access Keys

1. After creating the user, click "Create access key"
2. Save the Access Key ID and Secret Access Key
3. Configure these in your Starlake environment

## Configure Starlake

Now let's configure Starlake to work with your AWS environment.

### Environment Variables

Set the following environment variables:

```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_DEFAULT_REGION=us-east-1
```

### Starlake Configuration

Create a `starlake.conf` file:

```yaml
connections:
  aws:
    type: "aws"
    region: "us-east-1"
    bucket: "your-data-bucket"
```

## Create your first pipeline

Let's create a simple data pipeline using Starlake and AWS.

### Step 1: Define the Extract

Create `extract/aws-sales.yml`:

```yaml
extract:
  connectionRef: "aws"
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
starlake extract --config extract/aws-sales.yml

# Load data into AWS
starlake load --config load/sales.yml

# Or run both in sequence
starlake run --extract-config extract/aws-sales.yml --load-config load/sales.yml
```

### Monitor Execution

#### 1. Check Starlake Logs

```bash
# View recent logs
tail -f logs/starlake.log

# Check execution status
starlake status --job-id <job_id>
```

#### 2. Monitor AWS Services

- Check S3 bucket for uploaded files
- Monitor CloudWatch logs
- Review AWS Glue job status

#### 3. Verify Data

```bash
# Check loaded data
aws s3 ls s3://your-data-bucket/sales_data/

# Sample data
aws s3 cp s3://your-data-bucket/sales_data/part-00000.parquet - | head -10
```

### Next Steps

- Set up scheduling with cron or Airflow
- Configure alerts and notifications
- Scale your pipelines as needed
- Implement data quality checks

## Next steps

Congratulations! You've successfully set up Starlake with AWS.

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
0 2 * * * /path/to/starlake run --extract-config extract/aws-sales.yml --load-config load/sales.yml
```

#### Monitoring and Alerting

- Set up AWS CloudWatch alerts
- Configure Starlake notifications
- Monitor data quality metrics
- Track pipeline performance

#### Security Enhancements

- Implement IAM roles and policies
- Set up S3 bucket policies
- Use AWS KMS for encryption
- Configure VPC and security groups

### Resources

- [Starlake Documentation](https://docs.starlake.ai)
- [AWS Documentation](https://docs.aws.amazon.com)
- [AWS Best Practices](https://aws.amazon.com/architecture/best-practices/)
- [Community Support](https://github.com/starlake-ai/starlake)

### Need Help?

If you encounter any issues:
1. Check the troubleshooting guide
2. Review the logs for error messages
3. Verify AWS permissions
4. Reach out to the community

### Example Advanced Configuration

```yaml
# Advanced AWS configuration
connections:
  aws:
    type: "aws"
    region: "us-east-1"
    bucket: "your-data-bucket"
    options:
      encryption: "AES256"
      lifecycle_policy: true
      versioning: true
```

</div>
