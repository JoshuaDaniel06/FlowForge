"""
FlowForge — Deterministic Transformation Engine
===============================================
A secure, parameter-driven transformation library built on top of Pandas.
Zero dynamic code evaluation (no eval() or exec()). Every transformation
is strictly validated, parameterized, and produces complete step telemetry.
"""

import time
import math
import re
from typing import Any, Dict, List, Optional, Tuple, Union
import pandas as pd
import numpy as np


class TransformationError(Exception):
    """Custom exception raised when a transformation cannot be executed."""
    pass


# ==============================================================================
# 1. COLUMN OPERATIONS
# ==============================================================================

def transform_select_columns(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Keep only the specified columns in the given order.
    Params:
      - columns: list of str
    """
    warnings = []
    target_cols = params.get("columns", [])
    if isinstance(target_cols, str):
        target_cols = [c.strip() for c in target_cols.split(",") if c.strip()]

    if not target_cols:
        raise TransformationError("Select Columns requires at least one column specified in 'columns'.")

    missing = [c for c in target_cols if c not in df.columns]
    if missing:
        raise TransformationError(f"Cannot select columns {missing}; they do not exist in the dataset.")

    available = [c for c in target_cols if c in df.columns]
    return df[available].copy(), warnings


def transform_rename_columns(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Rename one or more columns.
    Params:
      - old_name, new_name (single) OR mapping: dict of {old: new}
    """
    warnings = []
    mapping = params.get("mapping")

    if mapping is None:
        old_col = params.get("old_name")
        new_col = params.get("new_name")
        if not old_col or not new_col:
            raise TransformationError("Rename requires either 'mapping' or both 'old_name' and 'new_name'.")
        mapping = {old_col: new_col}

    missing = [old for old in mapping.keys() if old not in df.columns]
    if missing:
        raise TransformationError(f"Cannot rename non-existent columns: {missing}.")

    for old, new in mapping.items():
        if old == new:
            warnings.append(f"Column '{old}' renamed to the identical name.")

    return df.rename(columns=mapping), warnings


def transform_drop_columns(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Drop specified columns from the dataset.
    Params:
      - columns: list of str (or comma-separated string)
    """
    warnings = []
    drop_cols = params.get("columns", [])
    if isinstance(drop_cols, str):
        drop_cols = [c.strip() for c in drop_cols.split(",") if c.strip()]

    if not drop_cols:
        raise TransformationError("Drop Columns requires at least one column to drop.")

    existing_to_drop = [c for c in drop_cols if c in df.columns]
    missing = [c for c in drop_cols if c not in df.columns]

    if missing:
        warnings.append(f"Columns not found to drop: {missing}")

    if not existing_to_drop:
        return df.copy(), warnings

    return df.drop(columns=existing_to_drop), warnings


def transform_reorder_columns(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Reorder columns. Unspecified columns will be placed after the specified ones.
    Params:
      - columns: list of str
    """
    warnings = []
    order = params.get("columns", [])
    if isinstance(order, str):
        order = [c.strip() for c in order.split(",") if c.strip()]

    missing = [c for c in order if c not in df.columns]
    if missing:
        warnings.append(f"Columns in reorder list missing from dataset: {missing}")

    valid_ordered = [c for c in order if c in df.columns]
    remaining = [c for c in df.columns if c not in valid_ordered]

    new_column_order = valid_ordered + remaining
    return df[new_column_order].copy(), warnings


# ==============================================================================
# 2. ROW OPERATIONS
# ==============================================================================

def _coerce_filter_value(val: Any, target_series: pd.Series) -> Any:
    """Helper to safely coerce a filter comparison value to match the series dtype."""
    if val is None or pd.isna(val):
        return None
    val_str = str(val).strip()

    if pd.api.types.is_numeric_dtype(target_series):
        try:
            if "." in val_str:
                return float(val_str)
            return int(val_str)
        except (ValueError, TypeError):
            try:
                return float(val_str)
            except (ValueError, TypeError):
                return val

    if pd.api.types.is_bool_dtype(target_series):
        lower = val_str.lower()
        if lower in ("true", "1", "t", "yes"):
            return True
        if lower in ("false", "0", "f", "no"):
            return False
        return bool(val)

    if pd.api.types.is_datetime64_any_dtype(target_series):
        try:
            return pd.to_datetime(val_str)
        except Exception:
            return val

    return val_str


def transform_filter_rows(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Type-aware row filtering.
    Params:
      - column: str
      - operator: '=', '!=', '>', '<', '>=', '<=', 'contains', 'not_contains',
                  'starts_with', 'ends_with', 'is_null', 'is_not_null', 'in', 'not_in'
      - value: Any
      - case_sensitive: bool (default False for string operations)
    """
    warnings = []
    col = params.get("column")
    op = (params.get("operator") or "=").lower().strip()
    raw_val = params.get("value")
    case_sensitive = bool(params.get("case_sensitive", False))

    if not col or col not in df.columns:
        raise TransformationError(f"Filter target column '{col}' does not exist in dataset.")

    series = df[col]

    # Null checks
    if op in ("is_null", "is_empty", "null"):
        mask = series.isna() | (series.astype(str).str.strip() == "")
        return df[mask].copy(), warnings

    if op in ("is_not_null", "is_not_empty", "not_null"):
        mask = series.notna() & (series.astype(str).str.strip() != "")
        return df[mask].copy(), warnings

    # Value-based comparisons
    coerced_val = _coerce_filter_value(raw_val, series)

    if op in ("=", "=="):
        if pd.api.types.is_string_dtype(series) or series.dtype == object:
            if not case_sensitive:
                mask = series.astype(str).str.lower() == str(raw_val).lower()
            else:
                mask = series.astype(str) == str(raw_val)
        else:
            try:
                mask = series == coerced_val
            except Exception:
                mask = series.astype(str) == str(raw_val)

    elif op in ("!=", "<>"):
        if pd.api.types.is_string_dtype(series) or series.dtype == object:
            if not case_sensitive:
                mask = series.astype(str).str.lower() != str(raw_val).lower()
            else:
                mask = series.astype(str) != str(raw_val)
        else:
            try:
                mask = series != coerced_val
            except Exception:
                mask = series.astype(str) != str(raw_val)

    elif op == ">":
        mask = pd.to_numeric(series, errors="coerce") > float(raw_val)
    elif op == ">=":
        mask = pd.to_numeric(series, errors="coerce") >= float(raw_val)
    elif op == "<":
        mask = pd.to_numeric(series, errors="coerce") < float(raw_val)
    elif op == "<=":
        mask = pd.to_numeric(series, errors="coerce") <= float(raw_val)

    elif op in ("contains", "like"):
        target_str = str(raw_val)
        mask = series.astype(str).str.contains(re.escape(target_str), case=case_sensitive, na=False)

    elif op in ("not_contains", "not_like"):
        target_str = str(raw_val)
        mask = ~series.astype(str).str.contains(re.escape(target_str), case=case_sensitive, na=False)

    elif op == "starts_with":
        target_str = str(raw_val)
        mask = series.astype(str).str.startswith(target_str, na=False) if case_sensitive \
            else series.astype(str).str.lower().str.startswith(target_str.lower(), na=False)

    elif op == "ends_with":
        target_str = str(raw_val)
        mask = series.astype(str).str.endswith(target_str, na=False) if case_sensitive \
            else series.astype(str).str.lower().str.endswith(target_str.lower(), na=False)

    elif op in ("in", "is_in"):
        if isinstance(raw_val, list):
            items = [str(x).strip() for x in raw_val]
        else:
            items = [x.strip() for x in str(raw_val).split(",") if x.strip()]
        if not case_sensitive:
            items = [x.lower() for x in items]
            mask = series.astype(str).str.lower().isin(items)
        else:
            mask = series.astype(str).isin(items)

    elif op in ("not_in", "is_not_in"):
        if isinstance(raw_val, list):
            items = [str(x).strip() for x in raw_val]
        else:
            items = [x.strip() for x in str(raw_val).split(",") if x.strip()]
        if not case_sensitive:
            items = [x.lower() for x in items]
            mask = ~series.astype(str).str.lower().isin(items)
        else:
            mask = ~series.astype(str).isin(items)

    else:
        raise TransformationError(f"Unsupported filter operator '{op}'.")

    return df[mask].copy(), warnings


def transform_sort_rows(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Sort rows by one or multiple columns.
    Params:
      - column: str or columns: list of str
      - ascending: bool or list of bool (default True)
      - nulls: 'first' or 'last' (default 'last')
    """
    warnings = []
    cols = params.get("columns") or [params.get("column")]
    if isinstance(cols, str):
        cols = [c.strip() for c in cols.split(",") if c.strip()]

    cols = [c for c in cols if c]
    if not cols:
        raise TransformationError("Sort Rows requires at least one column.")

    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise TransformationError(f"Sort columns {missing} do not exist in dataset.")

    ascending = params.get("ascending", True)
    if isinstance(ascending, str):
        ascending = ascending.lower() in ("true", "1", "asc")

    nulls_pos = params.get("nulls", "last").lower()
    na_position = "first" if nulls_pos == "first" else "last"

    return df.sort_values(by=cols, ascending=ascending, na_position=na_position), warnings


def transform_remove_duplicates(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Deduplicate dataset rows.
    Params:
      - subset: list of str (or empty for full-row deduplication)
      - keep: 'first', 'last', or False/none (drop all occurrences of duplicates)
    """
    warnings = []
    subset = params.get("subset")
    if isinstance(subset, str):
        subset = [s.strip() for s in subset.split(",") if s.strip()]

    if subset:
        missing = [c for c in subset if c not in df.columns]
        if missing:
            raise TransformationError(f"Deduplication subset columns {missing} do not exist.")
    else:
        subset = None

    keep_raw = params.get("keep", "first")
    if keep_raw in (False, "none", "drop_all"):
        keep = False
    elif keep_raw == "last":
        keep = "last"
    else:
        keep = "first"

    return df.drop_duplicates(subset=subset, keep=keep), warnings


# ==============================================================================
# 3. TYPE CONVERSION WITH ERROR POLICIES
# ==============================================================================

def transform_type_conversion(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Convert column data type with strict error handling.
    Params:
      - column: str
      - target_type: 'integer', 'float', 'string', 'boolean', 'datetime'
      - policy: 'fail' (stop on error), 'set_null' (replace bad values with None), 'reject_row' (drop invalid rows)
      - datetime_format: str optional (e.g. '%Y-%m-%d')
    """
    warnings = []
    col = params.get("column")
    target_type = (params.get("target_type") or "").lower().strip()
    policy = (params.get("policy") or "set_null").lower().strip()
    datetime_fmt = params.get("datetime_format")

    if not col or col not in df.columns:
        raise TransformationError(f"Type conversion target column '{col}' does not exist.")

    df_out = df.copy()
    series = df_out[col]

    if target_type in ("integer", "int"):
        # Convert via numeric coerce
        converted = pd.to_numeric(series, errors="coerce")
        bad_mask = series.notna() & converted.isna()
        bad_count = int(bad_mask.sum())

        if bad_count > 0:
            if policy == "fail":
                raise TransformationError(f"Failed to convert {bad_count} values to integer in column '{col}'.")
            elif policy == "reject_row":
                warnings.append(f"Dropped {bad_count} rows containing unparseable integers in '{col}'.")
                df_out = df_out[~bad_mask]
                df_out[col] = pd.to_numeric(df_out[col], errors="coerce").astype("Int64")
                return df_out, warnings
            else:  # set_null
                warnings.append(f"Replaced {bad_count} unparseable integer values with null in '{col}'.")
                df_out[col] = converted.astype("Int64")
                return df_out, warnings
        else:
            df_out[col] = converted.astype("Int64")

    elif target_type in ("float", "decimal", "numeric"):
        converted = pd.to_numeric(series, errors="coerce")
        bad_mask = series.notna() & converted.isna()
        bad_count = int(bad_mask.sum())

        if bad_count > 0:
            if policy == "fail":
                raise TransformationError(f"Failed to convert {bad_count} values to float in column '{col}'.")
            elif policy == "reject_row":
                warnings.append(f"Dropped {bad_count} rows with unparseable float values in '{col}'.")
                df_out = df_out[~bad_mask]
                df_out[col] = pd.to_numeric(df_out[col], errors="coerce")
                return df_out, warnings
            else:  # set_null
                warnings.append(f"Replaced {bad_count} unparseable float values with null in '{col}'.")
                df_out[col] = converted
                return df_out, warnings
        else:
            df_out[col] = converted

    elif target_type in ("string", "text", "str"):
        df_out[col] = series.fillna("").astype(str)

    elif target_type in ("boolean", "bool"):
        def parse_bool(v):
            if pd.isna(v):
                return None
            v_str = str(v).strip().lower()
            if v_str in ("1", "true", "t", "yes", "y"):
                return True
            if v_str in ("0", "false", "f", "no", "n"):
                return False
            return None

        converted = series.apply(parse_bool)
        bad_mask = series.notna() & converted.isna()
        bad_count = int(bad_mask.sum())

        if bad_count > 0:
            if policy == "fail":
                raise TransformationError(f"Failed to convert {bad_count} values to boolean in column '{col}'.")
            elif policy == "reject_row":
                warnings.append(f"Dropped {bad_count} rows with unparseable boolean values in '{col}'.")
                df_out = df_out[~bad_mask]
                df_out[col] = df_out[col].apply(parse_bool).astype("boolean")
                return df_out, warnings
            else:  # set_null
                warnings.append(f"Replaced {bad_count} unparseable boolean values with null in '{col}'.")
                df_out[col] = converted.astype("boolean")
                return df_out, warnings
        else:
            df_out[col] = converted.astype("boolean")

    elif target_type in ("datetime", "date", "timestamp"):
        try:
            if datetime_fmt:
                converted = pd.to_datetime(series, format=datetime_fmt, errors="coerce")
            else:
                converted = pd.to_datetime(series, errors="coerce")
        except Exception as e:
            if policy == "fail":
                raise TransformationError(f"Datetime conversion failed: {e}")
            converted = pd.Series([None] * len(series), index=df_out.index)

        bad_mask = series.notna() & converted.isna()
        bad_count = int(bad_mask.sum())

        if bad_count > 0:
            if policy == "fail":
                raise TransformationError(f"Failed to convert {bad_count} values to datetime in column '{col}'.")
            elif policy == "reject_row":
                warnings.append(f"Dropped {bad_count} rows with unparseable datetime values in '{col}'.")
                df_out = df_out[~bad_mask]
                df_out[col] = pd.to_datetime(df_out[col], errors="coerce")
                return df_out, warnings
            else:  # set_null
                warnings.append(f"Replaced {bad_count} unparseable datetime values with null in '{col}'.")
                df_out[col] = converted
                return df_out, warnings
        else:
            df_out[col] = converted

    else:
        raise TransformationError(f"Unsupported target conversion type '{target_type}'.")

    return df_out, warnings


# ==============================================================================
# 4. SAFE DERIVED COLUMNS (NO EVAL / NO EXEC)
# ==============================================================================

def transform_derived_column(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Safely compute a new column without arbitrary code execution.
    Supported operations:
      - Math: add, subtract, multiply, divide, modulo, power
      - String: uppercase, lowercase, strip, concat, substring, replace
      - Date: year, month, day, day_of_week, quarter, date_diff_days
      - Conditional: if_then_else
    """
    warnings = []
    new_col = (params.get("new_column") or params.get("output_column") or "").strip()
    operation = (params.get("operation") or "").lower().strip()

    if not new_col:
        raise TransformationError("Derived column requires 'new_column' name.")

    df_out = df.copy()

    # --- MATH OPERATIONS ---
    if operation in ("add", "subtract", "multiply", "divide", "modulo", "power"):
        col_a = params.get("column_a") or params.get("column")
        if not col_a or col_a not in df.columns:
            raise TransformationError(f"Derived math operation requires existing primary column '{col_a}'.")

        s1 = pd.to_numeric(df_out[col_a], errors="coerce")

        col_b = params.get("column_b")
        const_val = params.get("value")

        if col_b and col_b in df.columns:
            s2 = pd.to_numeric(df_out[col_b], errors="coerce")
        elif const_val is not None:
            s2 = float(const_val)
        else:
            raise TransformationError("Math operation requires either 'column_b' or constant 'value'.")

        if operation == "add":
            df_out[new_col] = s1 + s2
        elif operation == "subtract":
            df_out[new_col] = s1 - s2
        elif operation == "multiply":
            df_out[new_col] = s1 * s2
        elif operation == "divide":
            # Avoid ZeroDivisionError
            if isinstance(s2, (int, float)) and s2 == 0:
                df_out[new_col] = np.nan
                warnings.append("Division by constant zero produced NaN.")
            else:
                denom = s2.replace(0, np.nan) if isinstance(s2, pd.Series) else s2
                df_out[new_col] = s1 / denom
        elif operation == "modulo":
            df_out[new_col] = s1 % s2
        elif operation == "power":
            df_out[new_col] = s1 ** s2

    # --- STRING OPERATIONS ---
    elif operation in ("uppercase", "upper"):
        col = params.get("column") or params.get("column_a")
        if not col or col not in df.columns:
            raise TransformationError(f"Uppercase requires existing column '{col}'.")
        df_out[new_col] = df_out[col].astype(str).str.upper()

    elif operation in ("lowercase", "lower"):
        col = params.get("column") or params.get("column_a")
        if not col or col not in df.columns:
            raise TransformationError(f"Lowercase requires existing column '{col}'.")
        df_out[new_col] = df_out[col].astype(str).str.lower()

    elif operation in ("strip", "trim"):
        col = params.get("column") or params.get("column_a")
        if not col or col not in df.columns:
            raise TransformationError(f"Strip requires existing column '{col}'.")
        df_out[new_col] = df_out[col].astype(str).str.strip()

    elif operation == "concat":
        cols = params.get("columns") or []
        sep = params.get("separator", " ")
        if isinstance(cols, str):
            cols = [c.strip() for c in cols.split(",") if c.strip()]
        missing = [c for c in cols if c not in df.columns]
        if missing:
            raise TransformationError(f"Cannot concatenate missing columns: {missing}")
        if not cols:
            raise TransformationError("Concat requires at least two columns.")

        combined = df_out[cols[0]].fillna("").astype(str)
        for next_col in cols[1:]:
            combined = combined + sep + df_out[next_col].fillna("").astype(str)
        df_out[new_col] = combined

    elif operation == "substring":
        col = params.get("column") or params.get("column_a")
        start = int(params.get("start", 0))
        length = params.get("length")
        stop = (start + int(length)) if length is not None else None
        if not col or col not in df.columns:
            raise TransformationError(f"Substring requires existing column '{col}'.")
        df_out[new_col] = df_out[col].astype(str).str.slice(start=start, stop=stop)

    elif operation == "replace":
        col = params.get("column") or params.get("column_a")
        find_str = str(params.get("find", ""))
        replace_with = str(params.get("replace_with", ""))
        if not col or col not in df.columns:
            raise TransformationError(f"Replace requires existing column '{col}'.")
        df_out[new_col] = df_out[col].astype(str).str.replace(find_str, replace_with, regex=False)

    # --- DATE OPERATIONS ---
    elif operation in ("year", "month", "day", "day_of_week", "quarter"):
        col = params.get("column") or params.get("column_a")
        if not col or col not in df.columns:
            raise TransformationError(f"Date extraction requires existing column '{col}'.")
        dt_series = pd.to_datetime(df_out[col], errors="coerce")

        if operation == "year":
            df_out[new_col] = dt_series.dt.year.astype("Int64")
        elif operation == "month":
            df_out[new_col] = dt_series.dt.month.astype("Int64")
        elif operation == "day":
            df_out[new_col] = dt_series.dt.day.astype("Int64")
        elif operation == "day_of_week":
            df_out[new_col] = dt_series.dt.day_name()
        elif operation == "quarter":
            df_out[new_col] = dt_series.dt.quarter.astype("Int64")

    # --- CONDITIONAL IF-THEN-ELSE ---
    elif operation in ("if_then_else", "condition"):
        cond_col = params.get("condition_column") or params.get("column")
        cond_op = (params.get("operator") or "=").lower().strip()
        cond_val = params.get("condition_value") or params.get("value")
        true_val = params.get("true_value", 1)
        false_val = params.get("false_value", 0)

        if not cond_col or cond_col not in df.columns:
            raise TransformationError(f"Conditional derived column requires existing column '{cond_col}'.")

        s = df_out[cond_col]
        if cond_op in ("=", "=="):
            mask = s.astype(str) == str(cond_val)
        elif cond_op in ("!=", "<>"):
            mask = s.astype(str) != str(cond_val)
        elif cond_op == ">":
            mask = pd.to_numeric(s, errors="coerce") > float(cond_val)
        elif cond_op == ">=":
            mask = pd.to_numeric(s, errors="coerce") >= float(cond_val)
        elif cond_op == "<":
            mask = pd.to_numeric(s, errors="coerce") < float(cond_val)
        elif cond_op == "<=":
            mask = pd.to_numeric(s, errors="coerce") <= float(cond_val)
        elif cond_op in ("is_null", "null"):
            mask = s.isna()
        else:
            raise TransformationError(f"Unsupported conditional operator '{cond_op}'.")

        df_out[new_col] = np.where(mask, true_val, false_val)

    else:
        raise TransformationError(f"Unsupported derived operation '{operation}'.")

    return df_out, warnings


# ==============================================================================
# 5. AGGREGATIONS
# ==============================================================================

def transform_aggregation(df: pd.DataFrame, params: Dict[str, Any]) -> Tuple[pd.DataFrame, List[str]]:
    """
    Perform group-by aggregation.
    Params:
      - group_by: list of str
      - agg_func: 'sum', 'mean', 'avg', 'count', 'min', 'max', 'nunique'
      - value_column: str
      - output_name: str optional (default {value_column}_{agg_func})
    """
    warnings = []
    group_cols = params.get("group_by", [])
    if isinstance(group_cols, str):
        group_cols = [c.strip() for c in group_cols.split(",") if c.strip()]

    if not group_cols:
        raise TransformationError("Aggregation requires at least one 'group_by' column.")

    missing_group = [c for c in group_cols if c not in df.columns]
    if missing_group:
        raise TransformationError(f"Grouping columns missing from dataset: {missing_group}")

    val_col = params.get("value_column")
    if not val_col or val_col not in df.columns:
        raise TransformationError(f"Aggregation value column '{val_col}' does not exist in dataset.")

    agg_func = (params.get("agg_func") or "count").lower().strip()
    if agg_func == "avg":
        agg_func = "mean"

    valid_funcs = {"sum", "mean", "count", "min", "max", "nunique", "std"}
    if agg_func not in valid_funcs:
        raise TransformationError(f"Unsupported aggregation function '{agg_func}'. Must be one of {valid_funcs}.")

    out_name = (params.get("output_name") or f"{val_col}_{agg_func}").strip()

    # Cast value column to numeric if sum or mean
    df_calc = df.copy()
    if agg_func in ("sum", "mean", "std"):
        df_calc[val_col] = pd.to_numeric(df_calc[val_col], errors="coerce")

    grouped = df_calc.groupby(group_cols, as_index=False)[val_col].agg(agg_func)
    grouped = grouped.rename(columns={val_col: out_name})

    return grouped, warnings


# ==============================================================================
# 6. STEP EXECUTION DISPATCHER
# ==============================================================================

STEP_REGISTRY = {
    "select_columns": transform_select_columns,
    "rename_column": transform_rename_columns,
    "rename_columns": transform_rename_columns,
    "drop_columns": transform_drop_columns,
    "reorder_columns": transform_reorder_columns,
    "filter_rows": transform_filter_rows,
    "sort_rows": transform_sort_rows,
    "remove_duplicates": transform_remove_duplicates,
    "deduplicate": transform_remove_duplicates,
    "type_conversion": transform_type_conversion,
    "derived_column": transform_derived_column,
    "aggregation": transform_aggregation,
}


def execute_step(
    df: pd.DataFrame,
    step: Dict[str, Any],
    error_policy: str = "stop_on_error",
) -> Tuple[pd.DataFrame, Dict[str, Any]]:
    """
    Execute a single transformation step on a DataFrame and capture performance metrics.
    """
    step_id = step.get("id") or "step_unknown"
    step_name = step.get("name") or "Unnamed Step"
    step_type = step.get("type")
    params = step.get("params") or {}

    rows_before = len(df)
    cols_before = list(df.columns)
    start_time = time.perf_counter()

    if step_type not in STEP_REGISTRY:
        err_msg = f"Unknown transformation step type: '{step_type}'."
        if error_policy == "stop_on_error":
            raise TransformationError(err_msg)
        return df, {
            "step_id": step_id,
            "step_name": step_name,
            "type": step_type,
            "status": "failed",
            "error": err_msg,
            "rows_before": rows_before,
            "rows_after": rows_before,
            "row_delta": 0,
            "cols_before": cols_before,
            "cols_after": cols_before,
            "duration_ms": 0.0,
            "warnings": [],
        }

    func = STEP_REGISTRY[step_type]

    try:
        new_df, warnings = func(df, params)
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        rows_after = len(new_df)
        cols_after = list(new_df.columns)

        telemetry = {
            "step_id": step_id,
            "step_name": step_name,
            "type": step_type,
            "status": "warning" if warnings else "success",
            "error": None,
            "rows_before": rows_before,
            "rows_after": rows_after,
            "row_delta": rows_after - rows_before,
            "cols_before": cols_before,
            "cols_after": cols_after,
            "duration_ms": elapsed_ms,
            "warnings": warnings,
        }
        return new_df, telemetry

    except Exception as exc:
        elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
        err_msg = str(exc)

        if error_policy == "stop_on_error":
            raise TransformationError(f"Step '{step_name}' ({step_id}) failed: {err_msg}") from exc

        # Continue with warning
        telemetry = {
            "step_id": step_id,
            "step_name": step_name,
            "type": step_type,
            "status": "failed",
            "error": err_msg,
            "rows_before": rows_before,
            "rows_after": rows_before,
            "row_delta": 0,
            "cols_before": cols_before,
            "cols_after": cols_before,
            "duration_ms": elapsed_ms,
            "warnings": [f"Execution error bypassed by error policy: {err_msg}"],
        }
        return df, telemetry


def execute_pipeline_transformations(
    df: pd.DataFrame,
    steps: List[Dict[str, Any]],
    error_policy: str = "stop_on_error",
) -> Tuple[pd.DataFrame, List[Dict[str, Any]], Dict[str, Any]]:
    """
    Execute an ordered sequence of transformation steps.
    Returns:
      (final_dataframe, list_of_step_telemetry, summary_dictionary)
    """
    total_start = time.perf_counter()
    initial_rows = len(df)
    initial_cols = list(df.columns)
    current_df = df.copy()

    step_telemetry_list = []
    has_errors = False

    for idx, step in enumerate(steps):
        try:
            current_df, telemetry = execute_step(current_df, step, error_policy=error_policy)
            step_telemetry_list.append(telemetry)
            if telemetry["status"] == "failed":
                has_errors = True
        except TransformationError as e:
            step_telemetry_list.append({
                "step_id": step.get("id") or f"step_{idx+1}",
                "step_name": step.get("name") or f"Step {idx+1}",
                "type": step.get("type"),
                "status": "failed",
                "error": str(e),
                "rows_before": len(current_df),
                "rows_after": len(current_df),
                "row_delta": 0,
                "duration_ms": 0.0,
                "warnings": [],
            })
            has_errors = True
            break

    total_duration_ms = round((time.perf_counter() - total_start) * 1000, 2)

    summary = {
        "status": "failed" if has_errors else "success",
        "total_steps": len(steps),
        "steps_executed": len(step_telemetry_list),
        "initial_rows": initial_rows,
        "final_rows": len(current_df),
        "row_delta": len(current_df) - initial_rows,
        "initial_columns": initial_cols,
        "final_columns": list(current_df.columns),
        "total_duration_ms": total_duration_ms,
    }

    return current_df, step_telemetry_list, summary
