# Ingestion Checks for XML Files

## 1. Row Tag Detection

Each XML file is parsed by identifying a repeating element that represents a single record. The `rowTag` option specifies this element. It can be auto-detected or set explicitly.

```yaml
table:
  metadata:
    format: "XML"
    options:
      rowTag: "country"
```

## 2. Attribute Prefix Mapping

XML node attributes are mapped to columns with a configurable prefix (default: `_`) to avoid naming collisions with child elements.

For example, `<country name="France">` produces a column named `_name`.

```yaml
table:
  metadata:
    options:
      attributePrefix: "_"
```

## 3. Nested Structure Support

Child elements are mapped as columns. Repeated child elements are treated as arrays with nested attributes, using `type: "struct"` and `array: true`.

```yaml
attributes:
  - name: "_name"
    type: "string"
  - name: "rank"
    type: "int"
  - name: "neighbor"
    type: "struct"
    array: true
    attributes:
      - name: "_name"
        type: "string"
      - name: "_direction"
        type: "string"
```

Warehouse support for nested types varies:

| Warehouse | Nested Type |
|---|---|
| BigQuery | Native STRUCT and ARRAY |
| Databricks | Native STRUCT and ARRAY |
| Snowflake | VARIANT column |
| Redshift | Requires flattening |
| DuckDB | Native STRUCT and ARRAY |

## 4. XSD Validation

An optional XSD schema can be provided for record-level validation. Records that do not conform to the XSD are rejected.

```yaml
table:
  metadata:
    options:
      rowValidationXSDPath: "path/to/schema.xsd"
```

## 5. Encoding

The file is read according to the configured encoding (default: `UTF-8`). Override with the `encoding` property in the table metadata.

## 6. Row Filtering

The `filter` option at the table level applies a SQL WHERE clause to filter accepted data before writing. Applied after column renaming.

```yaml
table:
  filter: "rank <= 10"
```

## 7. Type Validation

Every record is validated against the type schema before loading. Each attribute is assigned a type backed by a regex pattern. Values that match are loaded into the target table; values that fail are rejected to the `audit.rejected` table.

Built-in types include: `string`, `int`, `long`, `double`, `decimal`, `boolean`, `date`, `timestamp`, and numerous ISO date/time variants (`ISO_DATE_TIME`, `ISO_LOCAL_DATE`, `RFC_1123_DATE_TIME`, etc.). Custom types with user-defined regex patterns are also supported.

## 8. Required Field Check

Each attribute can be marked `required: true`. When set, the field must be present and non-null in the source record or the row is rejected.

## 9. Column Renaming

The `rename` property maps a source element or attribute to a different target column name in the database. Table-level renaming is also supported via `table.rename`.

## 10. Privacy Transformations

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

## 11. Computed Columns (Script)

The `script` property defines a Spark SQL expression to compute a derived column. Scripts can reference other columns, Spark SQL functions, and the file metadata column `sl_input_file_name`. Scripted fields must appear at the end of the attribute list and are automatically made optional (nullable).

```yaml
attributes:
  - name: "_name"
    type: "string"
  - name: "source_file"
    script: "regexp_extract(sl_input_file_name, '.+/(.+)$', 1)"
  - name: "loaded_at"
    script: "current_timestamp()"
```

## 12. Ignored Columns

Columns marked with `ignore: true` are excluded from the target table but remain available for use in `script` expressions.

## 13. Default Values

Optional attributes can specify a `default` value used when the source value is NULL. Not valid for struct or array types.

## 14. Foreign Keys

The `foreignKey` property declares a relationship to another table. Supported syntaxes: `table`, `domain.table`, `table.column`, `domain.table.column`.

## 15. Pre/Post SQL Hooks

SQL statements can be executed before and after ingestion via `presql` and `postsql`.

```yaml
table:
  presql:
    - "DELETE FROM staging.countries WHERE batch_id = '{{batch_id}}'"
  postsql:
    - "ANALYZE TABLE countries COMPUTE STATISTICS"
```

## 16. Rejection Routing

Records that fail any validation check are not silently dropped — they are routed to the `audit.rejected` table for inspection and reporting.

## 17. Post-Load Expectations

After data is written to the target table, optional data quality assertions are evaluated. See the full [Expectations reference](./700-expectations.md) for all 53 built-in macros covering completeness, validity, volume, schema, uniqueness, and numeric checks.

## 18. Freshness Monitoring

The `freshness` property defines staleness thresholds for the loaded data.

```yaml
table:
  metadata:
    freshness:
      warn: "1d"
      error: "2d"
```

## 19. Primary Key Declaration

The `primaryKey` property declares the table's primary key columns, used for merge operations and data quality.

## 20. Ingestion Metrics

Attributes can be tagged with a `metricType` to compute statistics during ingestion:

- `CONTINUOUS` — min, max, mean, median, variance, standard deviation, skewness, kurtosis, percentiles.
- `DISCRETE` — count distinct, category frequency, category count.
- `TEXT` — text field statistics.

---

## Summary

| Check | Phase |
|---|---|
| Row tag detection (`rowTag`) | Pre-load |
| Attribute prefix mapping (`attributePrefix`) | Pre-load |
| Nested structure parsing (`struct`, `array`) | Pre-load |
| XSD validation (`rowValidationXSDPath`) | Pre-load |
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