---
description: "How Starlake loads fixed-width (POSITION) files: column boundaries, encoding, regex row filters, trimming, type validation and privacy transforms."
---

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

Every line of a file is a record: unlike DSV files, POSITION files have no header line by default (`withHeader: false`). When each file starts with a header line, set `withHeader: true`: the first line of each file is then skipped, in Spark and in native mode. A `withHeader: true` set on the domain applies to its POSITION tables too, and Starlake logs a warning about it when it reads the project.

## 2. Encoding

The file is read according to the configured encoding (default: `UTF-8`). Override with the `encoding` property in the table metadata. Particularly important for mainframe/COBOL exports which may use EBCDIC or other legacy encodings.

## 3. Row Filtering

The `filter` option at the table level applies a SQL WHERE clause to filter accepted data before writing. Applied after column renaming.

```yaml
table:
  filter: "status != 'DELETED'"
```

In Spark mode, the filter of a POSITION table is evaluated against the raw line, in a column named `value`. This is the recommended way to skip header banners, footer/trailer records, comment lines, or short/truncated rows.

```yaml
table:
  filter: "LENGTH(value) >= 80 AND SUBSTR(value, 1, 2) = '01'"
```

Common patterns:

| Goal | Expression |
|---|---|
| Skip header banner | `SUBSTR(value, 1, 2) != '00'` |
| Skip trailer record | `SUBSTR(value, 1, 2) != '99'` |
| Skip comment lines | `value NOT LIKE '#%'` |
| Drop short/truncated lines | `LENGTH(value) >= 80` |
| Keep only detail records | `SUBSTR(value, 1, 2) = '01'` |

### Regex filtering

For pattern-based skipping you need a regex predicate — for example, keep only lines whose first 8 bytes are a valid `YYYYMMDD` date and drop everything else (banners, summaries, blanks):

```yaml title="Spark mode"
table:
  filter: "value RLIKE '^[0-9]{8}'"
```

### Native mode

With `loader: native` on BigQuery, the filter runs in the second step, once the line is sliced: it reads the attributes, under their final names and converted to their types, not the raw line. A value that does not convert is `NULL` for the filter. Write it on the attributes, in BigQuery SQL. For example, to skip the trailer records, whose `record_type` attribute is `99`, and keep the lines whose `account` attribute has 8 digits:

```yaml title="BigQuery native mode"
table:
  loader: native
  filter: "record_type != '99' AND REGEXP_CONTAINS(account, r'^[0-9]{8}$')"
```

The lines that the filter drops are neither rejected nor counted.

:::note Dialect portability
The expression is passed through to the active engine without dialect translation. A Spark filter reads the raw line (`value`) in Spark SQL, for example `value RLIKE 'pattern'`. A native BigQuery filter reads the attributes in BigQuery SQL, for example `REGEXP_CONTAINS(account, r'pattern')`. Keep one variant per mode if you may switch between Spark and native modes.
:::

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

## 19. BigQuery Native Mode

POSITION files can also be loaded directly to BigQuery without going through Spark by setting `loader: native` (at table, domain, connection, or project scope — see [Native Load Mode](../0300-guides/200-load/170-native.mdx)). This pushes parsing entirely into BigQuery and avoids the JVM `String` overhead that Spark incurs when reading large fixed-width files.

How it works internally:

1. **First step.** Starlake issues a BigQuery LoadJob that reads each line as a single `STRING` column named `value`. The field delimiter is set to a control character (``) that is vanishingly unlikely to appear in fixed-width data, so each line becomes one row in a temporary table.
2. **Second step.** Each attribute is sliced with `SUBSTR(value, first+1, length)` and converted to the type of its column. The values of the types other than strings and bytes are trimmed first, since fixed-width fields are padded. Dates, times and timestamps are read with the pattern of their type, and booleans with its regular expressions.
3. **Rejection.** A line is rejected when the slice of an attribute is not blank and does not convert, or when the slice of a required attribute is blank. A blank slice of an optional attribute is `NULL`, or the slice itself for a string. A line on which a strict conversion of a script would fail (`CAST`, `PARSE_DATE`...) is rejected too. The rejected lines are counted in the audit log and written to `audit.rejected`, and, with `sinkReplayToFile`, to a replay file. `rejectMaxRecords` and `rejectAllOnError` apply.
4. **Filter.** The `filter` expression is applied as a `WHERE` clause in the second step, on the attributes rather than on the raw line (see [Native mode](#native-mode) in Section 3). The lines that it drops are neither rejected nor counted.

A table with a type that BigQuery SQL cannot read (a date pattern with text fields such as `MMM`, two-digit years, zones or optional sections, most predefined formatters, a boolean regular expression that BigQuery may read differently, or a `double` type with a zone) is loaded with Spark, with a warning. So is a table with a privacy that is not SQL.

Trade-offs vs Spark mode for POSITION:

| Capability | Spark mode | BigQuery native |
|---|---|---|
| Per-row rejection to `audit.rejected` | Yes | Yes |
| Patterns of `date`, `timestamp`, `datetime`, `time` and `boolean` types | Yes | Yes |
| Patterns of string and number types | Yes | No |
| Computed columns (`script`) | Yes | Yes (via second-step SQL) |
| Privacy transformations | Yes (UDFs + SQL) | SQL-prefix only; others load with Spark |
| `trim` | As declared | Always on values other than strings and bytes, never on strings |
| `default` | Yes | No |
| Encoding support | Any JVM Charset | UTF-8, ISO-8859-1, UTF-16 |
| Throughput on multi-GB files | Standard | Usually faster |

If you need the patterns of string and number types, `default` values, or `trim` on string fields, keep the default Spark mode. See [Native Load Mode](../0300-guides/200-load/170-native.mdx) for all the differences.

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
| BigQuery native loading (two-step `SUBSTR` + conversion) | Load |