---
title: "Install Starlake Native App from Snowflake Marketplace"
id: "starlake-snowflake-native-app-install"
level: 'Beginner'
icon: 'snowflake'
tags: ['Snowflake']
hide_table_of_contents: true
description: "Learn how to install Starlake as a Snowflake Native App from the Snowflake Marketplace."
---

## Starlake on Snowflake Native App 

In this quickstart guide, you'll learn how to install Starlake as a Snowflake Native App from the Snowflake Marketplace. 


## Locate Starlake in Snowflake Marketplace

__Prerequisites__

- A Snowflake account
- Basic knowledge of Snowflake services

Let's get started!

1. Log in to Snowflake Snowsight
2. Navigate to the "Data Products / Marketplace" section
3. Search for "Starlake" in the Marketplace using the search bar
4. Click on the "Starlake" listing
5. Click "Install" to add Starlake to your Snowflake account

## Install Starlake

1. After clicking "Install", you will be prompted to select a warehouse name and size for Starlake.
2. Leave the default (starlake_compute_wh and X-SMALL) or choose a name for your warehouse (e.g., "STL_WH") and select the desired size (e.g., "X-Small").
3. Click "Continue" to proceed with the installation.
4. Within a few seconds, Starlake will be installed
5. Once the installation is complete, you need to wait for the app URL to be generated (requires 2 to 3 minutes). Keep hitting the "Refresh URL" button on the page until the URL appears.


## Access Starlake

1. Once the app URL is generated, click on it to access Starlake.
2. You may be prompted to log in with the root user credentials (admin@localhost.localdomain).
3. After logging in, you can start using Starlake for your data integration and analytics needs.
4. The first time you access Starlake, you will be able to set the default root password for the root user (admin@localhost.localdomain).
5. Click on your email in top bottom-left bar and select "My Profile". 
6. In the "Update Password" tab enter the old password ("admin" by default) and enter your new password.


## Enroll users

Users are automatically enrolled through the "Sign Up" link on the Starlake login screen.

You can however whitelist the users that are allowed to enroll.

In the bottom left bar, click on your email and select "Admin" then on the "Platform whitelist" tab enter one valid user email address per line. To allow all users from a specific domain, enter the domain name only (e.g., `example.com`)

Note that only users with a valid Snowflake account can access the app.

