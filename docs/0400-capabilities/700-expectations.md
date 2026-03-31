# Starlake — Data Quality Expectations

Expectations are data quality assertions evaluated after data is written to the target table. Each expectation references a Jinja2 SQL macro and checks a condition on the result. Set `failOnError: true` on any expectation to halt the pipeline on failure.

```yaml
expectations:
  - expect: "expect_column_values_to_be_unique('order_id') => result(0) == 0"
    failOnError: true
  - expect: "expect_table_row_count_to_be_between(100, 10000) => result(0) == 0"
```

## Condition Variables

- `count` — number of result rows.
- `result` — first row as a collection.
- `results` — all rows as nested collections.

## Custom Macros

Custom expectations are defined as `.j2` (Jinja2) template files in the `metadata/expectations/` directory. The placeholder `SL_THIS` refers to the target table name.

---

## Completeness

| Macro | What it checks |
|---|---|
| `expect_column_values_to_be_null(column, mostly)` | Minimum fraction of values are NULL |
| `expect_column_values_to_not_be_null(column)` | No NULL values in column |

## Validity

| Macro | What it checks |
|---|---|
| `expect_column_values_to_be_in_set(column, values)` | All values in allowed set |
| `expect_column_values_to_not_be_in_set(column, values)` | No values in forbidden set |
| `expect_column_values_to_match_regex(column, regex, mostly)` | Percentage of values matching regex |
| `expect_column_values_to_match_regex_list(column, patterns)` | Values match at least one regex |
| `expect_column_values_to_not_match_regex(column, pattern)` | No values match regex |
| `expect_column_values_to_not_match_regex_list(column, patterns)` | Values don't match any regex |
| `expect_column_values_to_match_like_pattern(column, pattern)` | All values match LIKE pattern |
| `expect_column_values_to_match_like_pattern_list(column, patterns, match_on)` | Values match one or all LIKE patterns |
| `expect_column_values_to_not_match_like_pattern(column, pattern)` | No values match LIKE pattern |
| `expect_column_values_to_not_match_like_pattern_list(column, patterns, mostly)` | Minimum fraction don't match patterns |
| `expect_column_value_lengths_to_equal(column, length)` | All values have exact length |
| `expect_column_value_lengths_to_be_between(column, lower, upper)` | Value lengths within range |
| `expect_column_pair_values_to_be_equal(column_a, column_b)` | Two columns have equal values |
| `expect_column_pair_values_to_be_in_set(column_a, column_b, pairs)` | Column pairs in allowed set |
| `expect_column_most_common_value_to_be_in_set(column, values)` | Most frequent value in set |

## Volume

| Macro | What it checks |
|---|---|
| `expect_table_row_count_to_equal(expected)` | Exact row count |
| `expect_table_row_count_to_be_between(lower, upper)` | Row count within range |
| `expect_table_row_count_to_equal_other_table(table1, table2)` | Two tables have same row count |

## Schema

| Macro | What it checks |
|---|---|
| `expect_column_to_exist(column)` | Column exists in table |
| `expect_column_values_to_be_of_type(column, type)` | All values are specific type |
| `expect_column_values_to_be_in_type_list(column, types)` | All values are one of specified types |
| `expect_table_column_count_to_equal(expected)` | Exact column count |
| `expect_table_column_count_to_be_between(min, max)` | Column count within range |
| `expect_table_columns_to_match_set(columns)` | Columns match set (order-independent) |
| `expect_table_columns_to_match_ordered_list(columns)` | Columns match exact ordered list |

## Uniqueness

| Macro | What it checks |
|---|---|
| `expect_column_values_to_be_unique(column)` | No duplicate values |
| `expect_compound_columns_to_be_unique(columns)` | Multi-column combination is unique |
| `expect_select_column_values_to_be_unique_within_record(columns)` | Values within a row are all distinct |
| `expect_column_unique_value_count_to_be_between(column, lower, upper)` | Distinct count within range |
| `expect_column_proportion_of_unique_values_to_be_between(column, lower, upper)` | Unique ratio within range |
| `expect_column_distinct_values_to_equal_set(column, values)` | Distinct values exactly match set |
| `expect_column_distinct_values_to_contain_set(column, values)` | Column contains all specified values |
| `expect_column_distinct_values_to_be_in_set(column, values)` | All distinct values in allowed set |

## Numeric

| Macro | What it checks |
|---|---|
| `expect_column_values_to_be_between(column, lower, upper)` | All values within range |
| `expect_column_min_to_be_between(column, lower, upper)` | Minimum value within range |
| `expect_column_max_to_be_between(column, lower, upper)` | Maximum value within range |
| `expect_column_mean_to_be_between(column, lower, upper)` | Average within range |
| `expect_column_median_to_be_between(column, lower, upper)` | Median within range |
| `expect_column_sum_to_be_between(column, lower, upper)` | Sum within range |
| `expect_column_stdev_to_be_between(column, lower, upper)` | Standard deviation within range |
| `expect_column_quantile_values_to_be_between(column, quantiles, lowers, uppers)` | Quantile values within ranges |
| `expect_column_value_z_scores_to_be_less_than(column, threshold)` | All z-scores below threshold |
| `expect_column_kl_divergence_to_be_less_than(column, distribution, threshold)` | KL divergence below threshold |
| `expect_column_pair_values_a_to_be_greater_than_b(column_a, column_b)` | Column A > Column B |
| `expect_multicolumn_sum_to_equal(columns, expected_sum)` | Sum across columns equals value |

## Unexpected Rows

| Macro | What it checks |
|---|---|
| `unexpected_rows_expectation(table1, table2, key)` | Rows in table1 not found in table2 |
