---
title: "Project Setup on BigQuery"
id: "project-setup-on-bigquery"
level: 'Beginner'
icon: 'bigquery'
tags: ['BigQuery']
hide_table_of_contents: true
description: "Learn how to connect Starlake with your BigQuery data sources."
---

## Create a New Project


Are you a CLI user? Check out our [CLI guide](/category/project-setup).


__Prerequisites__

- A Google Cloud account with BigQuery enabled
- Basic knowledge of BigQuery services
- Starlake installed and running

![Step 1](/img/guides/project-setup-on-bigquery/step1.png "Step 1")

1. Login to Starlake. If you don't have an account, you'll need to create one.
2. Click on the "New Project" button. You'll be prompted to enter a name and description for your project.
3. Hit the "Next" button to configure your database connection.

## Configure BigQuery Connection

1. Under "BigQuery Configuration", enter your BigQuery upload you service account JSON key:
![Step 2]( /img/guides/project-setup-on-bigquery/step2.1.png "Step 2")
   - Service Account Key: <your_service_account_key>
  To get a service account key, follow these steps:
   1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
   2. Navigate to "IAM & Admin" > "Service Accounts".
   3. Select or create a service account with the necessary permissions for BigQuery.
   4. Click on the service account, go to the "Keys" tab, and create a new key in JSON format.
   5. Download the JSON key file and load it to use in Starlake.
  Any extra options required by your organization may be added by clicking the "Advanced Options" button.
1. Test the connection to ensure Starlake can access your BigQuery account.
![Step 2]( /img/guides/project-setup-on-bigquery/step2.2.png "Step 2")
1. Hit the "Next" button to select your orchestrator.


## Select Orchestrator (Optional)

![Step 3]( /img/guides/project-setup-on-bigquery/step3.png "Step 3")

1. Enable orchestration.
2. Choose your preferred orchestrator from the list provided (Google Cloud Composer by default).
3. Hit the "Next" button to proceed to the final step. Configure your Git integration settings as needed.


## Configure Git Integration (Optional)

By default, Starlake uses an internal Git repository where you can commit your changes but not pushe them to an external Git repository.
Note: You can always download later your project files and Git history to a local folder from inside Starlake.

To configure Git integration:

![Step 4]( /img/guides/project-setup-on-bigquery/step4.png "Step 4")

1. Deselect "Use internal Git repository" if you want to use an external Git provider.
2. Select your Git provider (e.g., GitHub, GitLab, Bitbucket).
3. Enter your Git repository details:
   - Repository URL: <your_repository_url>
   - Authentication Method: "Personal Access Token" is currently supported.
   - Personal Access Token: <your_personal_access_token> (see [here](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) for more details).
4. Test your connection to ensure Starlake can access your Git repository.
5. Hit the "Next" button to configure AI integration.


## Configure AI Integration (Optional)

![Step 5]( /img/guides/project-setup-on-snowflake/step5.png "Step 5")

1. Enable AI integration if desired.
2. Choose your preferred AI provider from the list provided (e.g., OpenAI).
3. Enter your AI provider details:
   - API Key: <your_api_key> (see [here](https://platform.openai.com/api-keys))
4. Hit the "Next" button to proceed to the final step. Review your project settings and click "Finish" to complete the setup.

## Review and Finish

![Step 6]( /img/guides/project-setup-on-bigquery/step6.png "Step 6")

1. Review all your project settings.
2. Click "Finish" to complete the setup.
