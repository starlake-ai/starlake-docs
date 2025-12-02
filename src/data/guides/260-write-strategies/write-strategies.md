---
title: "Write Strategies"
id: "starlake-write-strategy"
level: 'Intermediate'
icon: 'starlake'
tags: ['Starlake', 'Load']
hide_table_of_contents: true
description: "Learn how to control how Starlake writes data to your tables directly from the user interface."
---

## Introduction

When you load data into your database, Starlake lets you control **how the data is written** to your target tables.  
This behavior is called a **write strategy**. It defines whether new records should be appended, replaced, merged, or versioned historically.

You can configure the write strategy directly in the **Load Wizard** or by editing an existing table definition in the Starlake GUI.

---

## Step 1 — Open the Load Configuration

1. Navigate to the **Load** section in your project.  
2. Click **“Create Load”** to define a new dataset, or open an existing one.  
3. Choose your file source (CSV, JSON, XML, etc.) and review the preview.

![](/img/guides/write-strategies/step1.png)

Once the file preview appears, go to the **“Write Strategy”** section in the configuration panel.

---

## Step 2 — Select a Write Strategy

Starlake offers several strategies that define how incoming data interacts with existing data in your database.

Use the **dropdown menu** labeled **“Write Strategy”** to select one of the following options:

**Append**  Insert all new rows into the target table. Existing data remains untouched.
**Overwrite**  Replace all rows in the target table with the new data.
**Upsert by Key**  Merge new data with existing rows using a key column (e.g., `id`).
**Upsert by Key and Timestamp**  Merge by key and update only if the new record is more recent.
**Overwrite by Partition**  Overwrite only partitions present in the incoming data.
**Delete Then Insert**  Delete all rows matching incoming keys before inserting new data.
**SCD2 (Slowly Changing Dimension Type 2)**  Track historical changes to maintain full record history.
**Adaptive**  Automatically select a strategy at runtime based on configurable rules.

![](/img/guides/write-strategies/step2.png)

Click the option that matches your use case — Starlake will automatically adapt the configuration fields shown next.

---

## Step 3 — Configure Strategy Parameters

Depending on the strategy you choose, additional options will appear below the dropdown:

### **APPEND**
- No additional configuration needed.  
- Ideal for incremental loads.

### **DELETE THEN INSERT**
- Define the **key columns** used to identify duplicates.  
- The system deletes old records before inserting new ones.

### **OVERWRITE**
- Replaces the entire table content.  
- Use with caution for full refreshes.

### **SCD2**
- Select your **key** and **timestamp** columns.  
- Optionally specify custom start and end timestamp columns (default: `start_ts`, `end_ts`).  
- Use this mode to maintain a full history of changes for analytical or auditing purposes.

### **UPSERT BY KEY**
- You must select one or more **key columns** (e.g. `id`, `email`).  
- Optionally specify **“Target Table”** to control merge destination.

### **UPSERT BY KEY AND TIMESTAMP**
- Select **key columns** and choose a **timestamp column**.  
- Starlake will update only records with an older timestamp in the target.

### **OVERWRITE BY PARTITION**
- Requires a **partition column** defined in the *sink* configuration.  
- Existing partitions matching the new data will be replaced.