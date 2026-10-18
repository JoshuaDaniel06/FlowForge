"""
FlowForge Schema Change Detection Engine (Stage 9 - Feature 8)
Compares incoming dataset schema with expected schema and data contracts.
Detects missing columns, unexpected columns, type mismatches, and required violations.
"""

from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np


def infer_column_type(series: pd.Series) -> str:
    """Infer standardized data type for a pandas Series."""
    dtype_str = str(series.dtype).lower()
    
    if "int" in dtype_str:
        return "integer"
    if "float" in dtype_str:
        # Check if float values are actually whole numbers
        non_null = series.dropna()
        if not non_null.empty:
            try:
                if (non_null % 1 == 0).all():
                    return "integer"
            except Exception:
                pass
        return "float"
    if "bool" in dtype_str:
        return "boolean"
    if "datetime" in dtype_str:
        return "datetime"
    
    # Object or string type: inspect values
    non_null = series.dropna().astype(str).str.strip()
    if non_null.empty:
        return "string"

    # Try parsing sample as integer
    sample = non_null.head(50)
    int_convertible = True
    for v in sample:
        try:
            f = float(v)
            if not f.is_integer():
                int_convertible = False
                break
        except (ValueError, TypeError):
            int_convertible = False
            break
    if int_convertible:
        return "integer"

    # Try parsing sample as float
    float_convertible = True
    for v in sample:
        try:
            float(v)
        except (ValueError, TypeError):
            float_convertible = False
            break
    if float_convertible:
        return "float"

    # Try parsing sample as datetime
    try:
        parsed_dates = pd.to_datetime(sample, errors="coerce")
        if parsed_dates.notna().sum() == len(sample):
            return "datetime"
    except Exception:
        pass

    return "string"


def normalize_type_name(t: str) -> str:
    """Normalize type strings for comparison."""
    t_clean = (t or "string").strip().lower()
    if t_clean in ("int", "integer", "bigint", "int64", "int32"):
        return "integer"
    if t_clean in ("float", "numeric", "number", "float64", "double"):
        return "float"
    if t_clean in ("bool", "boolean"):
        return "boolean"
    if t_clean in ("date", "datetime", "timestamp"):
        return "datetime"
    if t_clean in ("str", "string", "text", "varchar"):
        return "string"
    return t_clean


def detect_schema_changes(
    current_df: pd.DataFrame,
    expected_columns: Optional[List[Dict[str, Any]]] = None,
    contract_rules: Optional[List[Dict[str, Any]]] = None,
    pipeline: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Compare current input schema with expected schema or data contracts.

    Returns:
    - current_schema: List of detected column metadata
    - expected_schema: List of expected column definitions
    - missing_columns: Columns expected but missing in current data
    - unexpected_columns: Columns in data but not expected
    - type_changes: Columns where detected type differs from expected type
    - required_violations: Missing required columns or nullability violations
    - compatible_columns: Columns matching in name and type
    - compatibility_status: 'compatible' | 'warning' | 'incompatible'
    - can_execute: bool
    - summary: str
    """
    if current_df is None:
        current_df = pd.DataFrame()

    # 1. Infer Current Schema
    current_columns = list(current_df.columns)
    current_schema = []
    current_type_map = {}

    for col in current_columns:
        s = current_df[col]
        inferred_type = infer_column_type(s)
        has_nulls = bool(s.isna().any() or (s.astype(str).str.strip() == "").any())
        current_type_map[col] = inferred_type
        current_schema.append({
            "name": col,
            "type": inferred_type,
            "has_nulls": has_nulls,
            "sample_values": [str(v) for v in s.dropna().head(3).tolist()],
        })

    # 2. Build Expected Schema Map
    # Priority: contract_rules -> expected_columns -> fallback defaults
    expected_map = {}
    if contract_rules and len(contract_rules) > 0:
        for r in contract_rules:
            col_name = r.get("column_name", "").strip()
            if col_name:
                expected_map[col_name] = {
                    "name": col_name,
                    "expected_type": normalize_type_name(r.get("expected_type", "string")),
                    "is_required": bool(r.get("is_required", True)),
                    "allow_null": bool(r.get("allow_null", True)),
                    "rule_name": r.get("rule_name", f"Rule for {col_name}"),
                }
    elif expected_columns and len(expected_columns) > 0:
        for ec in expected_columns:
            name = ec.get("name") or ec.get("column") or ""
            if name:
                expected_map[name] = {
                    "name": name,
                    "expected_type": normalize_type_name(ec.get("type", "string")),
                    "is_required": bool(ec.get("required", ec.get("is_required", True))),
                    "allow_null": bool(ec.get("allow_null", True)),
                    "rule_name": f"Schema definition for {name}",
                }
    else:
        # Default baseline for FlowForge customer datasets
        default_baseline = [
            {"name": "id", "expected_type": "integer", "is_required": True, "allow_null": False},
            {"name": "name", "expected_type": "string", "is_required": True, "allow_null": True},
            {"name": "email", "expected_type": "string", "is_required": True, "allow_null": False},
            {"name": "age", "expected_type": "integer", "is_required": True, "allow_null": True},
            {"name": "city", "expected_type": "string", "is_required": False, "allow_null": True},
        ]
        for db in default_baseline:
            expected_map[db["name"]] = {**db, "rule_name": f"Default {db['name']}"}

    expected_schema = list(expected_map.values())
    expected_col_names = set(expected_map.keys())
    current_col_names = set(current_columns)

    # 3. Detect Missing Columns
    missing_columns = []
    required_violations = []

    for col_name in expected_col_names:
        if col_name not in current_col_names:
            meta = expected_map[col_name]
            is_req = meta["is_required"]
            severity = "incompatible" if is_req else "warning"
            explanation = (
                f"Required column '{col_name}' is missing from the incoming dataset."
                if is_req
                else f"Optional column '{col_name}' is missing from the incoming dataset."
            )
            missing_item = {
                "column": col_name,
                "expected_type": meta["expected_type"],
                "is_required": is_req,
                "severity": severity,
                "explanation": explanation,
            }
            missing_columns.append(missing_item)
            if is_req:
                required_violations.append({
                    "column": col_name,
                    "type": "missing_required_column",
                    "explanation": explanation,
                })

    # 4. Detect Unexpected Columns
    unexpected_columns = []
    for col_name in current_columns:
        if col_name not in expected_col_names:
            detected_type = current_type_map[col_name]
            unexpected_columns.append({
                "column": col_name,
                "detected_type": detected_type,
                "severity": "warning",
                "explanation": f"Column '{col_name}' ({detected_type}) is present in incoming data but not defined in expected schema.",
            })

    # 5. Detect Type Changes
    type_changes = []
    compatible_columns = []

    for col_name in current_columns:
        if col_name in expected_map:
            exp_meta = expected_map[col_name]
            exp_type = exp_meta["expected_type"]
            det_type = current_type_map[col_name]

            if exp_type != "any" and exp_type != det_type:
                # Assess severity of type change
                is_breaking = False
                # If expected is integer but incoming is string, verify if values are convertible
                if exp_type == "integer" and det_type == "string":
                    is_breaking = True
                elif exp_type == "float" and det_type == "string":
                    is_breaking = True
                elif exp_type == "datetime" and det_type != "datetime":
                    is_breaking = True

                severity = "incompatible" if is_breaking else "warning"
                type_changes.append({
                    "column": col_name,
                    "expected_type": exp_type,
                    "detected_type": det_type,
                    "severity": severity,
                    "explanation": f"Column '{col_name}' expected type '{exp_type}', but detected type is '{det_type}'.",
                })
            else:
                compatible_columns.append({
                    "column": col_name,
                    "type": det_type,
                    "is_required": exp_meta["is_required"],
                })

    # 6. Overall Compatibility Status
    has_incompatible = any(m["severity"] == "incompatible" for m in missing_columns) or \
                       any(t["severity"] == "incompatible" for t in type_changes) or \
                       len(required_violations) > 0

    has_warnings = len(unexpected_columns) > 0 or \
                   any(m["severity"] == "warning" for m in missing_columns) or \
                   any(t["severity"] == "warning" for t in type_changes)

    if has_incompatible:
        compatibility_status = "incompatible"
        can_execute = False
    elif has_warnings:
        compatibility_status = "warning"
        can_execute = True
    else:
        compatibility_status = "compatible"
        can_execute = True

    # 7. Human-Readable Summary
    summary_parts = []
    if missing_columns:
        req_missing = sum(1 for m in missing_columns if m["is_required"])
        opt_missing = len(missing_columns) - req_missing
        if req_missing:
            summary_parts.append(f"{req_missing} required column(s) missing")
        if opt_missing:
            summary_parts.append(f"{opt_missing} optional column(s) missing")
    if unexpected_columns:
        summary_parts.append(f"{len(unexpected_columns)} unexpected column(s)")
    if type_changes:
        summary_parts.append(f"{len(type_changes)} type mismatch(es)")

    if not summary_parts:
        summary = "Incoming schema is fully compatible with expected pipeline contract."
    else:
        status_label = "Incompatible / Breaking Changes" if has_incompatible else "Schema Drift / Warnings"
        summary = f"{status_label}: {', '.join(summary_parts)}."

    return {
        "compatibility_status": compatibility_status,
        "can_execute": can_execute,
        "has_hard_failure": has_incompatible,
        "summary": summary,
        "current_schema": current_schema,
        "expected_schema": expected_schema,
        "missing_columns": missing_columns,
        "unexpected_columns": unexpected_columns,
        "type_changes": type_changes,
        "required_violations": required_violations,
        "compatible_columns": compatible_columns,
        "stats": {
            "total_current_columns": len(current_columns),
            "total_expected_columns": len(expected_schema),
            "missing_count": len(missing_columns),
            "unexpected_count": len(unexpected_columns),
            "type_change_count": len(type_changes),
            "compatible_count": len(compatible_columns),
        }
    }
