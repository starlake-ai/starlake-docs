# JSON Files Ingestion

## 1. Format Detection

Starlake supports three JSON formats, selected via the `format` metadata property or auto-detected from file content:

- **JSON**: one JSON object per line (newline-delimited JSON). Supports nested structures.
- **JSON_FLAT**: flat objects without nesting or arrays (faster parsing).
- **JSON_ARRAY**: a single JSON array containing multiple objects.

Auto-detection: if the file starts with `[` it is treated as `JSON_ARRAY`; if it starts with `{` it is treated as `JSON`.

```yaml
table:
  metadata:
    format: "JSON"
```

## 2. Multiline Support

When `multiline` is `true`, JSON objects can span multiple lines. Default is `false` (one object per line), which is faster for large files.

```yaml
table:
  metadata:
    multiline: false
```

## 3. Nested Structure Support

JSON objects can contain nested structures mapped with `type: "struct"` and repeated elements mapped with `array: true`. Multi-level nesting is supported.

```yaml
attributes:
  - name: "order_lines"
    type: "struct"
    array: true
    attributes:
      - name: "line_id"
        type: "integer"
      - name: "product_id"
        type: "integer"
      - name: "quantity"
        type: "integer"
```

Warehouse support for nested types varies:

| Warehouse | Nested Type |
|---|---|
| BigQuery | Native STRUCT and ARRAY |
| Databricks | Native STRUCT and ARRAY |
| Snowflake | VARIANT column |
| Redshift | Requires flattening |
| DuckDB | Native STRUCT and ARRAY |

## 4. Encoding

The file is read according to the configured encoding (default: `UTF-8`). Override with the `encoding` property in the table metadata.

## 5. Row Filtering

The `filter` option at the table level applies a SQL WHERE clause to filter accepted data before writing. Applied after column renaming.

```yaml
table:
  filter: "status != 'DELETED'"
```

## 6. Type Validation

Every record is validated against the type schema before loading. Each attribute is assigned a type backed by a regex pattern. Values that match are loaded into the target table; values that fail are rejected to the `audit.rejected` table.

Built-in types include: `string`, `int`, `long`, `double`, `decimal`, `boolean`, `date`, `timestamp`, and numerous ISO date/time variants (`ISO_DATE_TIME`, `ISO_LOCAL_DATE`, `RFC_1123_DATE_TIME`, etc.). Custom types with user-defined regex patterns are also supported.

## 7. Required Field Check

Each attribute can be marked `required: true`. When set, the field must be present and non-null in the source record or the row is rejected.

## 8. Column Renaming

The `rename` property maps a source field to a different target column name in the database. Table-level renaming is also supported via `table.rename`.

```yaml
attributes:
  - name: "src_field"
    rename: "target_col"
```

## 9. Privacy Transformations

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

SQL-based privacy expressions are also supported:

```yaml
attributes:
  - name: "email"
    privacy: "SHA256"
  - name: "phone"
    privacy: "SQL: CONCAT(SUBSTR(phone, 1, 3), '****')"
```

## 10. Computed Columns (Script)

The `script` property defines a Spark SQL expression to compute a derived column. Scripts can reference other columns, Spark SQL functions, and the file metadata column `sl_input_file_name`. Scripted fields must appear at the end of the attribute list and are automatically made optional (nullable).

```yaml
attributes:
  - name: "order_id"
    type: "integer"
  - name: "source_file"
    script: "regexp_extract(sl_input_file_name, '.+/(.+)$', 1)"
  - name: "loaded_at"
    script: "current_timestamp()"
  - name: "full_name"
    script: "concat(first_name, ' ', last_name)"
```

## 11. Ignored Columns

Columns marked with `ignore: true` are excluded from the target table but remain available for use in `script` expressions.

## 12. Default Values

Optional attributes can specify a `default` value used when the source value is NULL. Not valid for struct or array types.

```yaml
attributes:
  - name: "country"
    type: "string"
    default: "UNKNOWN"
```

## 13. Foreign Keys

The `foreignKey` property declares a relationship to another table. Supported syntaxes: `table`, `domain.table`, `table.column`, `domain.table.column`.

```yaml
attributes:
  - name: "customer_id"
    type: "int"
    foreignKey: "customers.id"
```

## 14. Pre/Post SQL Hooks

SQL statements can be executed before and after ingestion via `presql` and `postsql`.

```yaml
table:
  presql:
    - "TRUNCATE TABLE staging.events"
  postsql:
    - "CALL refresh_materialized_view('events_summary')"
```

## 15. Rejection Routing

Records that fail any validation check are not silently dropped — they are routed to the `audit.rejected` table for inspection and reporting.

## 16. Post-Load Expectations

After data is written to the target table, optional data quality assertions are evaluated. See the full [Expectations reference](./700-expectations.md) for all 53 built-in macros covering completeness, validity, volume, schema, uniqueness, and numeric checks.

## 17. Freshness Monitoring

The `freshness` property defines staleness thresholds for the loaded data.

```yaml
table:
  metadata:
    freshness:
      warn: "6h"
      error: "1d"
```

## 18. Primary Key Declaration

The `primaryKey` property declares the table's primary key columns, used for merge operations and data quality.

## 19. Ingestion Metrics

Attributes can be tagged with a `metricType` to compute statistics during ingestion:

- `CONTINUOUS` — min, max, mean, median, variance, standard deviation, skewness, kurtosis, percentiles.
- `DISCRETE` — count distinct, category frequency, category count.
- `TEXT` — text field statistics.

---

## Summary

| Check | Phase |
|---|---|
| Format detection (JSON / JSON_FLAT / JSON_ARRAY) | Pre-load |
| Multiline handling (`multiline`) | Pre-load |
| Nested structure parsing (`struct`, `array`) | Pre-load |
| Encoding | Pre-load |
| Pre-SQL hooks (`presql`) | Pre-load |
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