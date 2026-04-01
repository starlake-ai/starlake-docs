# CSV/DSV Files Ingestion

## 1. Delimiter Parsing

Each line is split using the configured `separator` character. The default separator is `;` (semicolon). Any single character is supported (comma, pipe, tab, etc.). Multi-character separators are supported with Spark 3+.

```yaml
table:
  metadata:
    format: "DSV"
    separator: ";"
```

## 2. Header Handling

When `withHeader` is `true` (the default), the first line defines column names. When `false`, columns are referenced by zero-based index in the attribute definitions.

```yaml
table:
  metadata:
    withHeader: true
```

## 3. Quoting and Escaping

Fields containing the delimiter or newlines can be wrapped in a quote character. An escape character handles literal quotes inside quoted fields.

```yaml
table:
  metadata:
    quote: "\""
    escape: "\\"
```

## 4. Encoding

The file is read according to the configured encoding. Default is `UTF-8`. Override for legacy files with encodings such as `ISO-8859-1` or `Windows-1252`.

## 5. Line Filtering

The `filter` option at the table level applies a SQL WHERE clause to filter accepted data before writing. Applied after column renaming.

```yaml
table:
  filter: "amount > 0 AND status = 'ACTIVE'"
```

## 6. Empty Value Handling

Two properties control how empty and null values behave:

- `emptyIsNull`: when `true` (default), empty string values are treated as NULL.
- `nullValue`: the string representation of null in the source file (default: empty string when `emptyIsNull` is true).
- `fillWithDefaultValue`: when `true`, NULL values are replaced with the column's `default` value.

```yaml
table:
  metadata:
    emptyIsNull: true
    fillWithDefaultValue: true
```

## 7. Acknowledgment File

The `ack` property requires a companion file with the specified extension to exist alongside the data file before loading begins. This prevents loading incomplete uploads.

```yaml
table:
  metadata:
    ack: ".ack"
```

## 8. Trimming per Attribute

A `trim` strategy can be applied to each column value. Supported values: `NONE`, `LEFT`, `RIGHT`, `BOTH`.

```yaml
attributes:
  - name: "customer_name"
    type: "string"
    trim: "BOTH"
```

## 9. Type Validation

Every record is validated against the type schema before loading. Each attribute is assigned a type backed by a regex pattern. Values that match are loaded into the target table; values that fail are rejected to the `audit.rejected` table.

Built-in types include: `string`, `int`, `long`, `double`, `decimal`, `boolean`, `date`, `timestamp`, and numerous ISO date/time variants (`ISO_DATE_TIME`, `ISO_LOCAL_DATE`, `RFC_1123_DATE_TIME`, etc.). Custom types with user-defined regex patterns are also supported.

## 10. Required Field Check

Each attribute can be marked `required: true`. When set, the field must be present and non-null in the source record or the row is rejected.

## 11. Column Renaming

The `rename` property maps a source column to a different target column name in the database. The original name is used to read from source; the renamed name is used after ingestion.

```yaml
attributes:
  - name: "src_col"
    rename: "target_col"
```

Table-level renaming is also supported via `table.rename`.

## 12. Privacy Transformations

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
  - name: "ssn"
    privacy: "HIDE"
  - name: "id"
    privacy: "SQL: CONCAT(SUBSTR(id, 1, 3), '****', SUBSTR(id, -2))"
```

## 13. Computed Columns (Script)

The `script` property defines a Spark SQL expression to compute a derived column. Scripts can reference other columns, Spark SQL functions, and the file metadata column `sl_input_file_name`. Scripted fields must appear at the end of the attribute list and are automatically made optional (nullable).

```yaml
attributes:
  - name: "order_id"
    type: "string"
  - name: "total_price"
    script: "quantity * sale_price"
  - name: "email_domain"
    script: "regexp_extract(email, '.+@(.+)', 1)"
  - name: "source_file"
    script: "regexp_extract(sl_input_file_name, '.+/(.+)$', 1)"
  - name: "ingestion_year"
    script: "year(current_date())"
```

## 14. Ignored Columns

Columns marked with `ignore: true` are excluded from the target table but remain available for use in `script` expressions.

## 15. Default Values

Optional attributes can specify a `default` value used when the source value is NULL. Not valid for struct or array types.

```yaml
attributes:
  - name: "status"
    type: "string"
    default: "UNKNOWN"
```

## 16. Foreign Keys

The `foreignKey` property declares a relationship to another table. Supported syntaxes: `table`, `domain.table`, `table.column`, `domain.table.column`.

```yaml
attributes:
  - name: "product_id"
    type: "int"
    foreignKey: "products.id"
```

## 17. Pre/Post SQL Hooks

SQL statements can be executed before and after ingestion via `presql` and `postsql`.

```yaml
table:
  presql:
    - "DELETE FROM staging.orders WHERE date = current_date()"
  postsql:
    - "ANALYZE TABLE orders COMPUTE STATISTICS"
```

## 18. Rejection Routing

Records that fail any validation check are not silently dropped — they are routed to the `audit.rejected` table for inspection and reporting.

## 19. Post-Load Expectations

After data is written to the target table, optional data quality assertions are evaluated. See the full [Expectations reference](./700-expectations.md) for all 53 built-in macros covering completeness, validity, volume, schema, uniqueness, and numeric checks.

## 20. Freshness Monitoring

The `freshness` property defines staleness thresholds for the loaded data. If data is older than the warning or error threshold, alerts are raised.

```yaml
table:
  metadata:
    freshness:
      warn: "1d"
      error: "2d"
```

## 21. Primary Key Declaration

The `primaryKey` property declares the table's primary key columns, used for merge operations and data quality.

```yaml
table:
  primaryKey:
    - "order_id"
```

## 22. Ingestion Metrics

Attributes can be tagged with a `metricType` to compute statistics during ingestion:

- `CONTINUOUS` — min, max, mean, median, variance, standard deviation, skewness, kurtosis, percentiles.
- `DISCRETE` — count distinct, category frequency, category count.
- `TEXT` — text field statistics.

```yaml
attributes:
  - name: "amount"
    type: "double"
    metricType: "CONTINUOUS"
```

## 23. Spark Options Pass-Through

The `options` property passes key-value pairs directly to the underlying Spark CSV parser for advanced configuration.

```yaml
table:
  metadata:
    options:
      maxColumns: "100"
      inferSchema: "false"
```

---

## Summary

| Check | Phase |
|---|---|
| Delimiter parsing (`separator`) | Pre-load |
| Header handling (`withHeader`) | Pre-load |
| Quoting and escaping (`quote`, `escape`) | Pre-load |
| Encoding | Pre-load |
| Empty value handling (`emptyIsNull`, `nullValue`) | Pre-load |
| Acknowledgment file (`ack`) | Pre-load |
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