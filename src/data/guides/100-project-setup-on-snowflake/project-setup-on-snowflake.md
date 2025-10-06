---
title: "Project Setup on Snowflake"
id: "project-setup-on-snowflake"
level: 'Beginner'
icon: 'snowflake'
tags: ['Snowflake']
hide_table_of_contents: true
description: "Learn how to connect Starlake with your Snowflake data sources."
---

## Create a New Project


__Prerequisites__

- A Snowflake account
- Basic knowledge of Snowflake services
- Starlake installed and running

![Step 1](/img/guides/project-setup-on-snowflake/step1.png "Step 1")

1. Login to Starlake. If you don't have an account, you'll need to create one.
2. Click on the "New Project" button. You'll be prompted to enter a name and description for your project.
3. Hit the "Next" button to configure your database connection.

## Configure Snowflake Connection

1. Under "Snowflake Configuration", enter your Snowflake account details:
![Step 2]( /img/guides/project-setup-on-snowflake/step2.1.png "Step 2")
   - Account identifier in the form <org_name>-<account_name> (e.g., qbuqrxc-or28007)
   - Username: <your_username> as listed in Snowsight in the "Admin / Users & roles" section
   - Password: you may here use a programmatic access token for authentication see [here](https://docs.snowflake.com/en/user-guide/programmatic-access-tokens#generating-a-programmatic-access-token))
   - Warehouse: COMPUTE_WH by default
   - Database: <your_database>
   - Default schema (PUBLIC by default)
  Any extra options required by your organization may be added by clicking the "Advanced Options" button.
2. Test the connection to ensure Starlake can access your Snowflake account.
![Step 2]( /img/guides/project-setup-on-snowflake/step2.2.png "Step 2")
3. Hit the "Next" button to select your orchestrator.


## Select Orchestrator (Optional)

![Step 3]( /img/guides/project-setup-on-snowflake/step3.png "Step 3")

1. Enable orchestration.
2. Choose your preferred orchestrator from the list provided (Snowflake Task by default).
3. Hit the "Next" button to proceed to the final step. Configure your Git integration settings as needed.


## Configure Git Integration (Optional)

By default, Starlake uses an internal Git repository where you can commit your changes but not pushe them to an external Git repository.
Note: You can always download later your project files and Git history to a local folder from inside Starlake.

To configure Git integration:

![Step 4]( /img/guides/project-setup-on-snowflake/step4.png "Step 4")

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

![Step 6]( /img/guides/project-setup-on-snowflake/step6.png "Step 6")

1. Review all your project settings.
2. Click "Finish" to complete the setup.

## Video Recap

<div>
<video width="100%" height="100%" controls>
  <source src="/img/guides/project-setup-on-snowflake/project-setup-on-snowflake.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>
</div>