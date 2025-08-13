---
author: Starlake Team
summary: Quick start guide for using Starlake with AWS data services
id: aws_quickstart
categories: AWS, Data Engineering, Cloud
status: Published
icon: aws
title: Quickstart for starlake and AWS
description: Get started with Starlake and AWS data services in minutes
tags: AWS, starlake, Data Engineering, Cloud, Quick Start
tabs:
  - id: 1
    label: Introduction
    content: |
      # Introduction to Starlake with AWS
      
      Welcome to the Starlake AWS quick start guide! This guide will walk you through setting up Starlake with AWS data services.
      
      ## What you'll learn
      
      - How to set up AWS credentials
      - How to configure Starlake for AWS
      - How to create your first data pipeline
      - How to deploy and monitor your pipelines
      
      ## Prerequisites
      
      - An AWS account
      - Basic knowledge of AWS services
      - Starlake CLI installed
      
      Let's get started!
  
  - id: 2
    label: Set up AWS credentials
    content: |
      # Set up AWS Credentials
      
      Before you can use Starlake with AWS, you need to configure your AWS credentials.
      
      ## Step 1: Create an IAM User
      
      1. Log in to your AWS Management Console
      2. Navigate to IAM service
      3. Click "Users" and then "Add user"
      4. Enter a username (e.g., "starlake-user")
      5. Select "Programmatic access"
      
      ## Step 2: Attach Permissions
      
      Attach the following policies to your user:
      - AmazonS3FullAccess
      - AmazonRedshiftFullAccess
      - AmazonGlueFullAccess
      
      ## Step 3: Get Access Keys
      
      1. After creating the user, click "Create access key"
      2. Save the Access Key ID and Secret Access Key
      3. Configure these in your Starlake environment
      
  - id: 3
    label: Configure Starlake
    content: |
      # Configure Starlake for AWS
      
      Now let's configure Starlake to work with your AWS environment.
      
      ## Environment Variables
      
      Set the following environment variables:
      
      ```bash
      export AWS_ACCESS_KEY_ID=your_access_key
      export AWS_SECRET_ACCESS_KEY=your_secret_key
      export AWS_DEFAULT_REGION=us-east-1
      ```
      
      ## Starlake Configuration
      
      Create a `starlake.conf` file:
      
      ```yaml
      connections:
        aws:
          type: "aws"
          region: "us-east-1"
          bucket: "your-data-bucket"
      ```
      
  - id: 4
    label: Create your first pipeline
    content: |
      # Create Your First Pipeline
      
      Let's create a simple data pipeline using Starlake and AWS.
      
      ## Step 1: Define the Extract
      
      Create `extract/aws-sales.yml`:
      
      ```yaml
      extract:
        connectionRef: "aws"
        tables:
          - name: "sales_data"
            schema: "public"
            incremental: true
            timestamp: "created_at"
      ```
      
      ## Step 2: Define the Load
      
      Create `load/sales.yml`:
      
      ```yaml
      table:
        pattern: "sales_data.*.parquet"
        metadata:
          mode: "FILE"
          format: "PARQUET"
        attributes:
          - name: "order_id"
            type: "string"
            required: true
          - name: "amount"
            type: "float"
      ```
      
  - id: 5
    label: Deploy and monitor
    content: |
      # Deploy and Monitor
      
      Now let's deploy your pipeline and monitor its execution.
      
      ## Deploy the Pipeline
      
      ```bash
      starlake extract --config extract/aws-sales.yml
      starlake load --config load/sales.yml
      ```
      
      ## Monitor Execution
      
      1. Check the Starlake logs for execution status
      2. Monitor AWS CloudWatch for resource usage
      3. Verify data in your target warehouse
      
      ## Next Steps
      
      - Set up scheduling with AWS EventBridge
      - Configure alerts and notifications
      - Scale your pipelines as needed
      
  - id: 6
    label: Next steps
    content: |
      # Next Steps
      
      Congratulations! You've successfully set up Starlake with AWS.
      
      ## What's Next?
      
      - **Advanced Configuration**: Learn about advanced AWS features
      - **Scheduling**: Set up automated pipeline execution
      - **Monitoring**: Implement comprehensive monitoring
      - **Security**: Enhance security configurations
      
      ## Resources
      
      - [Starlake Documentation](https://docs.starlake.ai)
      - [AWS Documentation](https://docs.aws.amazon.com)
      - [Community Support](https://github.com/starlake-ai/starlake)
      
      ## Need Help?
      
      If you encounter any issues:
      1. Check the troubleshooting guide
      2. Review the logs for error messages
      3. Reach out to the community
---

This is a comprehensive quick start guide for using Starlake with AWS data services.
