"""
FlowForge Data Contracts Validation Engine (Stage 8 - Feature 7)
Validates incoming datasets against defined schema and data quality contracts
before dependent transformations execute.
"""

from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np


def validate_data_contract(
    df: pd.DataFrame,
    rules: List[Dict[str, Any]],
    error_policy: str = "stop_on_error"
) -> Dict[str, Any]:
    """
    Validate a DataFrame against a list of data contract rules.

    Each rule supports:
    - rule_name: str
    - column_name: str
    - is_required: bool (default True)
    - expected_type: str ("string", "integer", "float", "boolean", "datetime", "any")
    - allow_null: bool (default True)
    - min_value: Optional[float]
    - max_value: Optional[float]
    - is_unique: bool (default False)
    - permitted_values: Optional[List[Any]]

    Returns detailed validation results per rule and aggregate status.
    """
    total_rules = len(rules)
    passed_count = 0
    warning_count = 0
    failed_count = 0
    has_hard_failure = False

    rule_results = []
    total_rows = len(df) if df is not None else 0

    for idx, rule in enumerate(rules):
        rule_id = rule.get("id") or idx + 1
        rule_name = rule.get("rule_name") or f"Rule {idx + 1}"
        col = (rule.get("column_name") or "").strip()
        is_required = rule.get("is_required", True)
        expected_type = (rule.get("expected_type") or "any").strip().lower()
        allow_null = rule.get("allow_null", True)
        min_val = rule.get("min_value")
        max_val = rule.get("max_value")
        is_unique = rule.get("is_unique", False)
        permitted_values = rule.get("permitted_values") or []

        # 1. Missing Column Check
        if df is None or col not in df.columns:
            if is_required:
                has_hard_failure = True
                failed_count += 1
                rule_results.append({
                    "rule_id": rule_id,
                    "rule_name": rule_name,
                    "column": col,
                    "status": "failed",
                    "affected_rows": total_rows,
                    "explanation": f"Required column '{col}' is missing from the input dataset.",
                    "can_continue": False,
                    "is_hard_failure": True,
                })
            else:
                # Optional column missing -> passes with notice
                passed_count += 1
                rule_results.append({
                    "rule_id": rule_id,
                    "rule_name": rule_name,
                    "column": col,
                    "status": "passed",
                    "affected_rows": 0,
                    "explanation": f"Optional column '{col}' is not present; skipping further checks.",
                    "can_continue": True,
                    "is_hard_failure": False,
                })
            continue

        series = df[col]
        rule_status = "passed"
        affected_rows = 0
        explanations = []

        # 2. Null Values Check
        if not allow_null:
            null_mask = series.isna() | (series.astype(str).str.strip() == "") | (series.astype(str).str.strip().str.lower() == "nan") | (series.astype(str).str.strip().str.lower() == "none")
            null_count = int(null_mask.sum())
            if null_count > 0:
                affected_rows = max(affected_rows, null_count)
                explanations.append(f"{null_count} null or empty values found where nulls are disallowed")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        # 3. Expected Type Check
        non_null_series = series.dropna()
        if expected_type in ("integer", "int", "numeric_integer"):
            invalid_type_count = 0
            for val in non_null_series:
                try:
                    s_val = str(val).strip()
                    if s_val == "":
                        continue
                    float_val = float(s_val)
                    if not float_val.is_integer():
                        invalid_type_count += 1
                except (ValueError, TypeError):
                    invalid_type_count += 1

            if invalid_type_count > 0:
                affected_rows = max(affected_rows, invalid_type_count)
                explanations.append(f"{invalid_type_count} values could not be parsed as valid integers")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        elif expected_type in ("float", "numeric", "number"):
            invalid_type_count = 0
            for val in non_null_series:
                try:
                    s_val = str(val).strip()
                    if s_val == "":
                        continue
                    float(s_val)
                except (ValueError, TypeError):
                    invalid_type_count += 1

            if invalid_type_count > 0:
                affected_rows = max(affected_rows, invalid_type_count)
                explanations.append(f"{invalid_type_count} values could not be parsed as numbers")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        elif expected_type in ("boolean", "bool"):
            valid_bools = {"true", "false", "1", "0", "yes", "no", "t", "f"}
            invalid_bool_count = sum(
                1 for v in non_null_series if str(v).strip().lower() not in valid_bools
            )
            if invalid_bool_count > 0:
                affected_rows = max(affected_rows, invalid_bool_count)
                explanations.append(f"{invalid_bool_count} values could not be parsed as boolean")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        elif expected_type in ("datetime", "date", "timestamp"):
            invalid_date_count = 0
            for v in non_null_series:
                try:
                    pd.to_datetime(v)
                except Exception:
                    invalid_date_count += 1
            if invalid_date_count > 0:
                affected_rows = max(affected_rows, invalid_date_count)
                explanations.append(f"{invalid_date_count} values could not be parsed as dates")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        # 4. Numeric Range Check (min_value / max_value)
        if min_val is not None or max_val is not None:
            numeric_vals = pd.to_numeric(series, errors="coerce")
            range_violations = 0
            if min_val is not None and max_val is not None:
                range_mask = (numeric_vals < float(min_val)) | (numeric_vals > float(max_val))
                range_violations = int(range_mask.sum())
                if range_violations > 0:
                    affected_rows = max(affected_rows, range_violations)
                    explanations.append(f"{range_violations} values outside [{min_val}, {max_val}] range")
                    rule_status = "failed" if error_policy == "stop_on_error" else "warning"
            elif min_val is not None:
                range_mask = numeric_vals < float(min_val)
                range_violations = int(range_mask.sum())
                if range_violations > 0:
                    affected_rows = max(affected_rows, range_violations)
                    explanations.append(f"{range_violations} values below minimum {min_val}")
                    rule_status = "failed" if error_policy == "stop_on_error" else "warning"
            elif max_val is not None:
                range_mask = numeric_vals > float(max_val)
                range_violations = int(range_mask.sum())
                if range_violations > 0:
                    affected_rows = max(affected_rows, range_violations)
                    explanations.append(f"{range_violations} values above maximum {max_val}")
                    rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        # 5. Uniqueness Check
        if is_unique:
            valid_vals = series.dropna()
            if not valid_vals.empty and isinstance(valid_vals.iloc[0], str):
                valid_vals = valid_vals.astype(str).str.strip()
            
            dup_mask = valid_vals.duplicated(keep=False)
            dup_count = int(dup_mask.sum())
            if dup_count > 0:
                affected_rows = max(affected_rows, dup_count)
                explanations.append(f"{dup_count} duplicate values found in unique column")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        # 6. Permitted Values Check
        if permitted_values and len(permitted_values) > 0:
            permitted_set = {str(pv).strip().lower() for pv in permitted_values}
            disallowed_count = 0
            for val in non_null_series:
                clean_val = str(val).strip().lower()
                if clean_val and clean_val not in permitted_set:
                    disallowed_count += 1
            if disallowed_count > 0:
                affected_rows = max(affected_rows, disallowed_count)
                explanations.append(f"{disallowed_count} values not in permitted list: {permitted_values}")
                rule_status = "failed" if error_policy == "stop_on_error" else "warning"

        # Tally counts
        if rule_status == "passed":
            passed_count += 1
            can_continue = True
            explanation = "All validation checks passed."
        elif rule_status == "warning":
            warning_count += 1
            can_continue = True
            explanation = "; ".join(explanations)
        else:
            failed_count += 1
            can_continue = False
            explanation = "; ".join(explanations)

        rule_results.append({
            "rule_id": rule_id,
            "rule_name": rule_name,
            "column": col,
            "status": rule_status,
            "affected_rows": affected_rows,
            "explanation": explanation,
            "can_continue": can_continue,
            "is_hard_failure": False,
        })

    # Overall contract status
    if has_hard_failure or failed_count > 0:
        overall_status = "failed"
        can_continue_overall = False
    elif warning_count > 0:
        overall_status = "warning"
        can_continue_overall = (error_policy == "continue_on_warning")
    else:
        overall_status = "passed"
        can_continue_overall = True

    summary = (
        f"{passed_count}/{total_rules} rules passed"
        + (f", {warning_count} warnings" if warning_count > 0 else "")
        + (f", {failed_count} failures" if failed_count > 0 else "")
        + (" (Hard Failure: Missing required column)" if has_hard_failure else "")
    )

    return {
        "status": overall_status,
        "can_continue": can_continue_overall,
        "has_hard_failure": has_hard_failure,
        "error_policy": error_policy,
        "total_rules": total_rules,
        "passed_count": passed_count,
        "warning_count": warning_count,
        "failed_count": failed_count,
        "summary": summary,
        "rule_results": rule_results,
    }
