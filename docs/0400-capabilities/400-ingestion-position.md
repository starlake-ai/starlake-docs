# POSITION (Fixed-Width) Files Ingestion

## 1. Column Boundary Parsing

Each column is extracted using zero-based `first` and `last` position properties defined in the YAML schema. Starlake parses each line using the defined column positions — there is no delimiter, so positions must be exact.

```yaml
table:
  metadata:
    format: "POSITION"
  attributes:
    - name: order_id
      position:
        first: 0
        last: 4
    - name: customer_id
      position:
        first: 5
        last: 9
```

## 2. Encoding

The file is read according to the configured encoding (default: `UTF-8`). Override with the `encoding` property in the table metadata. Particularly important for mainframe/COBOL exports which may use EBCDIC or other legacy encodings.

## 3. Row Filtering

The `filter` option at the table level applies a SQL WHERE clause to filter accepted data before writing. Applied after column renaming.

```yaml
table:
  filter: "status != 'DELETED'"
```

## 4. Trimming per Attribute

A `trim` strategy is applied to each extracted value. Supported values: `NONE`, `LEFT`, `RIGHT`, `BOTH`. Particularly useful for space-padded string fields from COBOL/mainframe exports.

```yaml
attributes:
  - name: "customer_name"
    type: "string"
    trim: "BOTH"
```

## 5. Type Validation

Every record is validated against the type schema before loading. Each attribute is assigned a type backed by a regex pattern. Values that match are loaded into the target table; values that fail are rejected to the `audit.rejected` table.

Built-in types include: `string`, `int`, `long`, `double`, `decimal`, `boolean`, `date`, `timestamp`, and numerous ISO date/time variants (`ISO_DATE_TIME`, `ISO_LOCAL_DATE`, `RFC_1123_DATE_TIME`, etc.). Custom types with user-defined regex patterns are also supported.

## 6. Required Field Check

Each attribute can be marked `required: true`. When set, the field must be present and non-null in the source record or the row is rejected.

## 7. Column Renaming

The `rename` property maps a source column to a different target column name in the database. Table-level renaming is also supported via `table.rename`.

## 8. Privacy Transformations

The `privacy` property applies a transformation to sensitive column values during ingestion. Built-in algorithms:

| Algorithm | Description |
|---|---|
| `NONE` | No transformation |
| `HIDE` | Replace with a fixed string (e.g., `***`) |
| `MD5` | MD5 hash |
| `SHA1` | SHA-1 hash |
| `SHA256` | SHA-256 hash |
| `SHA512` | SHA-512 hash |
| `AES` | AES encryption (requires parameters) |

SQL-based privacy expressions are also supported with the `SQL:` prefix.

## 9. Computed Columns (Script)

The `script` property defines a Spark SQL expression to compute a derived column. Scripts can reference other columns, Spark SQL functions, and the file metadata column `sl_input_file_name`. Scripted fields must appear at the end of the attribute list and are automatically made optional (nullable).

```yaml
attributes:
  - name: "order_id"
    position:
      first: 0
      last: 4
  - name: "source_file"
    script: "regexp_extract(sl_input_file_name, '.+/(.+)$', 1)"
  - name: "loaded_at"
    script: "current_timestamp()"
```

## 10. Ignored Columns

Columns marked with `ignore: true` are excluded from the target table but remain available for use in `script` expressions.

## 11. Default Values

Optional attributes can specify a `default` value used when the source value is NULL.

```yaml
attributes:
  - name: "status"
    type: "string"
    position:
      first: 34
      last: 43
    default: "PENDING"
```

## 12. Foreign Keys

The `foreignKey` property declares a relationship to another table. Supported syntaxes: `table`, `domain.table`, `table.column`, `domain.table.column`.

## 13. Pre/Post SQL Hooks

SQL statements can be executed before and after ingestion via `presql` and `postsql`.

```yaml
table:
  presql:
    - "TRUNCATE TABLE staging.orders"
  postsql:
    - "CALL update_order_summary()"
```

## 14. Rejection Routing

Records that fail any of the above checks are not silently dropped — they are routed to the `audit.rejected` table for inspection and reporting.

## 15. Post-Load Expectations

After data is written to the target table, optional data quality assertions are evaluated. See the full [Expectations reference](./700-expectations.md) for all 53 built-in macros covering completeness, validity, volume, schema, uniqueness, and numeric checks.

## 16. Freshness Monitoring

The `freshness` property defines staleness thresholds for the loaded data.

```yaml
table:
  metadata:
    freshness:
      warn: "1d"
      error: "2d"
```

## 17. Primary Key Declaration

The `primaryKey` property declares the table's primary key columns, used for merge operations and data quality.

## 18. Ingestion Metrics

Attributes can be tagged with a `metricType` to compute statistics during ingestion:

- `CONTINUOUS` — min, max, mean, median, variance, standard deviation, skewness, kurtosis, percentiles.
- `DISCRETE` — count distinct, category frequency, category count.
- `TEXT` — text field statistics.

---

## Summary

| Check | Phase |
|---|---|
| Column boundary extraction (`first` / `last`) | Pre-load |
| Encoding | Pre-load |
| Pre-SQL hooks (`presql`) | Pre-load |
| Trimming (`trim`) | Pre-load |
| Type validation via regex | Pre-load |
| Required field presence | Pre-load |
| Column renaming (`rename`) | Pre-load |
| Privacy transformations (`privacy`) | Pre-load |
| Computed columns (`script`) | Pre-load |
| Default values (`default`) | Pre-load |
| Ignored columns (`ignore`) | Pre-load |
| Row filtering (`filter`) | Pre-load |
| Rejection to `audit.rejected` | Load |
| Post-SQL hooks (`postsql`) | Post-load |
| Post-load expectations | Post-load |
| Freshness monitoring | Post-load |
| Ingestion metrics | Post-load |