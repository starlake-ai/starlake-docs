---
title: "Orchestrate in Snowflake Tasks"
id: "starlake-orchestrate-snowflake-tasks"
level: 'Beginner'
icon: 'starlake'
tags: ['Starlake', "Orchestrate", "Snowflake"]
hide_table_of_contents: true
description: "Learn how to orchestrate tasks in Snowflake."
---


## Set schedules

You can set schedules for your orchestrations using cron expressions. This allows you to automate the execution of your data pipelines at specified intervals.

Simply head to the Orchestrate/Schedules menu and add a new schedule with your desired cron expression for each table or task you want to run periodically.

![](/img/guides/orchestrate-in-snowflake-tasks/step1.png)


Note that you do not need to set a schedule for tasks that are dependencies of other tasks, since they will be triggered automatically when their parent tasks are executed.


## Configure External Stage (Optional)

If you are loading Data from Cloud Storage (like S3, GCS, or ADLS), you can configure Snowflake Tasks to orchestrate the loading process. This is particularly useful for automating data ingestion workflows. Snowflake Tasks need to know the external stage where your data is stored. 

To create an external stage in Snowflake, you can use the following SQL command:

```sql
CREATE OR REPLACE STAGE my_external_stage
URL='s3://my-bucket/path/to/data/'
STORAGE_INTEGRATION = my_s3_integration;
```

External stage configuration in Snowflake documentation: 
- for Google Cloud Storage: https://docs.snowflake.com/en/user-guide/data-load-gcs-config
- for Amazon S3: https://docs.snowflake.com/en/user-guide/data-load-s3-config
- for Azure Container: https://docs.snowflake.com/en/user-guide/data-load-azure-config

Once you have created the external stage, you can configure Snowflake Tasks in Starlake by specifying the stage name in the Orchestrate/Config/snowflake-load-sql Tasks menu. This will allow Starlake to create and manage Snowflake Tasks that load data from the specified external stage into your Snowflake tables.

![](/img/guides/orchestrate-in-snowflake-tasks/step3.png)


## Dry Run Snowflake Tasks

First let's generate our Snowflake Tasks code. Navigate to Orchestrate/Dags and click "generate" to create the Snowpark code that will handle your loads and transformations.

Before deploying your Snowflake Tasks, it's a good practice to perform a dry run. This allows you to validate the configuration and ensure that everything is set up correctly without actually executing the tasks. 

To perform a dry run, click on the "Dry Run" button. This will simulate the execution of your Snowflake Tasks and provide feedback on any potential issues or errors in the configuration.

If the dry run is successful and you are satisfied with the configuration, you can proceed to deploy the Snowflake Tasks by clicking on the "Deploy" button. This will create the tasks in your Snowflake environment, ready to be executed according to the schedules you have set.

![](/img/guides/orchestrate-in-snowflake-tasks/step4.png)


## Deploy Snowflake Tasks

Once you have successfully completed the dry run and are satisfied with the configuration, you can proceed to deploy the Snowflake Tasks.

To deploy the tasks, simply click on the "Deploy" button. This action will create the tasks in your Snowflake environment, making them ready for execution based on the schedules you have defined.

You can check on the status of your deployed tasks in the Snowflake UI. Navigate to the "Tasks" section to view the list of tasks, their current status, and any execution history.

The tasks will have been created in the schema you specified at project creation time.


![](/img/guides/orchestrate-in-snowflake-tasks/step5.png)
