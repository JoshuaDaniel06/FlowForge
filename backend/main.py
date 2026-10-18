import json
import os
from io import BytesIO, StringIO
from typing import Any, Dict, List, Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from psycopg2 import sql
from pydantic import BaseModel

from backend.data_quality import analyze_data
from backend.database import (
    check_connection,
    delete_pipeline,
    get_connection,
    get_pipeline,
    get_public_tables,
    init_db,
    list_pipeline_runs,
    list_pipelines,
    record_pipeline_run,
    save_pipeline,
)
from backend.transformations import (
    TransformationError,
    execute_pipeline_transformations,
    execute_step,
)

# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()


# ==========================================
# PYDANTIC SCHEMAS
# ==========================================

class PipelinePayload(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    input_source: Optional[Dict[str, Any]] = {"type": "current_dataset"}
    steps: Optional[List[Dict[str, Any]]] = []
    destination: Optional[Dict[str, Any]] = {"type": "postgres", "table": "customers"}
    error_policy: Optional[str] = "stop_on_error"
    version: Optional[int] = 1
    status: Optional[str] = "saved"


class StepPreviewPayload(BaseModel):
    step: Optional[Dict[str, Any]] = None
    step_index: Optional[int] = None
    steps: Optional[List[Dict[str, Any]]] = None
    records: Optional[List[Dict[str, Any]]] = None
    row_limit: Optional[int] = 25


class PipelinePreviewPayload(BaseModel):
    steps: List[Dict[str, Any]]
    records: Optional[List[Dict[str, Any]]] = None
    error_policy: Optional[str] = "stop_on_error"


class PipelineExecutionPayload(BaseModel):
    pipeline_id: Optional[str] = None
    pipeline: Optional[PipelinePayload] = None
    records: Optional[List[Dict[str, Any]]] = None



# ==========================================
# FASTAPI APP
# ==========================================

app = FastAPI(
    title="FlowForge",
    description="Configurable ETL Pipeline Engineering Platform",
    version="2.0.0",
)


# ==========================================
# CORS
# ==========================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Attempt initial database table setup if PostgreSQL is reachable."""
    try:
        init_db()
        print("PostgreSQL FlowForge database tables initialized successfully.")
    except Exception as e:
        print(f"Database initialization deferred (check credentials in .env): {e}")


# ==========================================
# HOME & HEALTH
# ==========================================

@app.get("/")
def home():
    return {
        "platform": "FlowForge",
        "version": "2.0.0",
        "status": "online",
        "message": "FlowForge ETL Pipeline Engineering API is running",
    }


# ==========================================
# HELPER FUNCTIONS
# ==========================================

async def read_csv_file(file: UploadFile):
    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file selected.",
        )

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file.",
        )

    contents = await file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty.",
        )

    try:
        df = pd.read_csv(BytesIO(contents))
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read CSV file: {error}",
        )

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="CSV file does not contain any records.",
        )

    return df


def dataframe_to_records(df: pd.DataFrame):
    """Convert a DataFrame into JSON-safe records for the React dashboard."""
    if df is None or df.empty:
        return []

    return json.loads(
        df.to_json(
            orient="records",
            date_format="iso",
        )
    )


# ==========================================
# ANALYZE CSV
# ==========================================

@app.post("/analyze")
async def analyze_csv(
    file: UploadFile = File(...),
):
    df = await read_csv_file(file)

    try:
        quality_report, cleaned_df = analyze_data(df)

        return {
            "filename": file.filename,
            "quality_report": quality_report,
            "records": dataframe_to_records(df),
            "cleaned_records_data": dataframe_to_records(cleaned_df),
            "cleaned_records": len(cleaned_df),
        }

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Data analysis failed: {error}",
        )


# ==========================================
# CLEAN CSV
# ==========================================

@app.post("/clean")
async def clean_csv(
    file: UploadFile = File(...),
):
    df = await read_csv_file(file)

    try:
        _, cleaned_df = analyze_data(df)

        csv_buffer = StringIO()
        cleaned_df.to_csv(csv_buffer, index=False)

        csv_bytes = BytesIO(
            csv_buffer.getvalue().encode("utf-8")
        )

        return StreamingResponse(
            csv_bytes,
            media_type="text/csv",
            headers={
                "Content-Disposition": "attachment; filename=cleaned_customers.csv"
            },
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Data cleaning failed: {error}",
        )


# ==========================================
# POSTGRESQL DATABASE ENDPOINTS
# ==========================================

@app.get("/db/status")
def get_db_status():
    """Check PostgreSQL connectivity and return non-sensitive status info."""
    return check_connection()


@app.get("/db/tables")
def list_tables():
    """List available tables in the PostgreSQL database."""
    try:
        tables = get_public_tables()
        return {"status": "success", "tables": tables}
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to query database tables: {error}",
        )


@app.get("/db/preview/{table_name}")
def preview_table_data(table_name: str, limit: int = 50):
    """Safely preview records from a PostgreSQL table."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Verify table exists in public schema to prevent arbitrary injection
        cursor.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = %s;
        """, (table_name,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' not found.")

        # Safe parameterized execution with sql.Identifier
        query = sql.SQL("SELECT * FROM {} LIMIT %s;").format(sql.Identifier(table_name))
        cursor.execute(query, (limit,))
        colnames = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        
        records = [dict(zip(colnames, row)) for row in rows]
        
        cursor.close()
        conn.close()
        return {
            "table": table_name,
            "columns": colnames,
            "row_count": len(records),
            "records": records,
        }
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Could not preview table '{table_name}': {error}",
        )


# ==========================================
# LOAD CLEANED DATA TO POSTGRESQL
# ==========================================

@app.post("/load")
async def load_to_postgres(
    file: UploadFile = File(...),
):
    """Load cleaned customer data into PostgreSQL."""
    df = await read_csv_file(file)

    try:
        quality_report, cleaned_df = analyze_data(df)

        conn = get_connection()
        cursor = conn.cursor()

        # Ensure customers table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS customers (
                id BIGINT PRIMARY KEY,
                name VARCHAR(255),
                email VARCHAR(255),
                age INT,
                city VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
        """)

        insert_query = """
        INSERT INTO customers (id, name, email, age, city, updated_at)
        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            age = EXCLUDED.age,
            city = EXCLUDED.city,
            updated_at = CURRENT_TIMESTAMP;
        """

        records = []
        for _, row in cleaned_df.iterrows():
            customer_id = (
                int(row["id"])
                if pd.notna(row["id"])
                else None
            )
            name = (
                str(row["name"])
                if pd.notna(row["name"])
                else None
            )
            email = (
                str(row["email"])
                if pd.notna(row["email"])
                else None
            )
            age = (
                int(row["age"])
                if pd.notna(row["age"])
                else None
            )
            city = (
                str(row["city"])
                if pd.notna(row["city"])
                else None
            )

            if customer_id is not None:
                records.append((customer_id, name, email, age, city))

        if records:
            cursor.executemany(insert_query, records)
            conn.commit()

        cursor.close()
        conn.close()

        return {
            "status": "success",
            "message": "Cleaned data successfully loaded into PostgreSQL.",
            "records_loaded": len(records),
            "quality_report": quality_report,
        }

    except Exception as error:
        return {
            "status": "error",
            "message": f"PostgreSQL loading error: {error}",
        }


# ==========================================
# PIPELINE WORKBENCH ENDPOINTS (STAGE 2)
# ==========================================

@app.get("/pipelines")
def get_all_pipelines():
    """Retrieve all saved pipelines from PostgreSQL."""
    try:
        pipelines = list_pipelines()
        return {"status": "success", "pipelines": pipelines}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pipelines: {e}")


@app.get("/pipelines/runs")
def get_pipeline_runs(pipeline_id: Optional[str] = None, limit: int = 50):
    """Retrieve execution run history and telemetry from PostgreSQL."""
    try:
        runs = list_pipeline_runs(pipeline_id=pipeline_id, limit=limit)
        return {"status": "success", "runs": runs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load run history: {e}")


@app.get("/pipelines/{pipeline_id}")
def get_pipeline_by_id(pipeline_id: str):
    """Retrieve a specific pipeline by ID."""
    p = get_pipeline(pipeline_id)
    if not p:
        raise HTTPException(status_code=404, detail="Pipeline not found.")
    return {"status": "success", "pipeline": p}


@app.post("/pipelines")
def create_or_update_pipeline(pipeline: PipelinePayload):
    """Save or update a pipeline in PostgreSQL."""
    try:
        saved = save_pipeline(pipeline.dict())
        return {
            "status": "success",
            "message": f"Pipeline '{saved['name']}' saved successfully.",
            "pipeline": saved,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save pipeline: {e}")


@app.delete("/pipelines/{pipeline_id}")
def remove_pipeline(pipeline_id: str):
    """Delete a pipeline by ID."""
    try:
        deleted = delete_pipeline(pipeline_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Pipeline not found.")
        return {"status": "success", "message": "Pipeline deleted successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete pipeline: {e}")


@app.post("/pipelines/validate")
def validate_pipeline(pipeline: PipelinePayload):
    """
    Validate a pipeline workflow configuration before execution.
    Checks required fields, valid step types, step dependencies, and destination settings.
    """
    errors = []
    warnings = []

    if not pipeline.name or not pipeline.name.strip():
        errors.append("Pipeline name cannot be empty.")

    steps = pipeline.steps or []
    if not steps:
        warnings.append("Pipeline contains no processing steps. Execution will load data unmodified.")

    valid_step_types = {
        "select_columns",
        "rename_column",
        "drop_columns",
        "reorder_columns",
        "filter_rows",
        "sort_rows",
        "remove_duplicates",
        "type_conversion",
        "derived_column",
        "aggregation",
    }

    seen_step_ids = set()
    for idx, step in enumerate(steps):
        step_id = step.get("id") or f"step_{idx+1}"
        if step_id in seen_step_ids:
            errors.append(f"Duplicate step ID '{step_id}' found at position {idx+1}.")
        seen_step_ids.add(step_id)

        step_type = step.get("type")
        if not step_type or step_type not in valid_step_types:
            errors.append(f"Step {idx+1} has invalid or unsupported transformation type '{step_type}'.")
            continue

        # Check type-specific requirements
        params = step.get("params") or {}
        if step_type == "select_columns":
            cols = params.get("columns", [])
            if not cols:
                errors.append(f"Step {idx+1} (Select Columns) must specify at least one column to keep.")
        elif step_type == "rename_column":
            old_col = params.get("old_name")
            new_col = params.get("new_name")
            if not old_col or not new_col:
                errors.append(f"Step {idx+1} (Rename Column) requires both 'old_name' and 'new_name'.")
            elif old_col == new_col:
                warnings.append(f"Step {idx+1} (Rename Column) renames '{old_col}' to the same name.")
        elif step_type == "drop_columns":
            cols = params.get("columns", [])
            if not cols:
                errors.append(f"Step {idx+1} (Drop Columns) must specify at least one column to drop.")
        elif step_type == "filter_rows":
            col = params.get("column")
            op = params.get("operator")
            if not col or not op:
                errors.append(f"Step {idx+1} (Filter Rows) requires both 'column' and 'operator'.")
        elif step_type == "sort_rows":
            col = params.get("column")
            if not col:
                errors.append(f"Step {idx+1} (Sort Rows) requires a target 'column'.")
        elif step_type == "type_conversion":
            col = params.get("column")
            target_type = params.get("target_type")
            if not col or not target_type:
                errors.append(f"Step {idx+1} (Type Conversion) requires both 'column' and 'target_type'.")

    # Check destination
    dest = pipeline.destination or {}
    dest_type = dest.get("type", "postgres")
    if dest_type == "postgres":
        table_name = dest.get("table", "customers")
        if not table_name or not table_name.isidentifier():
            errors.append(f"Invalid destination PostgreSQL table identifier '{table_name}'.")

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "step_count": len(steps),
    }


def _get_base_dataframe(records: Optional[List[Dict[str, Any]]] = None) -> pd.DataFrame:
    """Helper to return DataFrame from records or fallback to root customers.csv."""
    if records and len(records) > 0:
        return pd.DataFrame(records)
    
    # Try loading customers.csv from project root
    root_csv = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "customers.csv")
    if os.path.exists(root_csv):
        return pd.read_csv(root_csv)
    
    # Fallback to minimal dataframe
    return pd.DataFrame({
        "id": [1, 2, 3],
        "name": ["Sample One", "Sample Two", "Sample Three"],
        "email": ["one@example.com", "two@example.com", "three@example.com"],
        "age": [25, 35, 45],
        "city": ["New York", "London", "Tokyo"],
    })


# ==========================================
# TRANSFORMATION EXECUTION & INTERMEDIATE PREVIEW
# ==========================================

@app.post("/pipelines/preview-step")
def preview_single_step(payload: StepPreviewPayload):
    """
    Execute a single transformation step (or step at step_index within a sequence)
    for intermediate data preview.
    Returns input and output rows/columns, sample data, schema changes, conversion failures,
    duration, and telemetry.
    """
    try:
        base_df = _get_base_dataframe(payload.records)
        row_limit = payload.row_limit or 25

        # If step_index and steps are provided, compute input to this step by running preceding steps
        if payload.steps and payload.step_index is not None and 0 <= payload.step_index < len(payload.steps):
            target_step = payload.steps[payload.step_index]
            current_df = base_df.copy()
            for i in range(payload.step_index):
                current_df, _ = execute_step(current_df, payload.steps[i], error_policy="continue_on_warning")
            df_in = current_df
        elif payload.step:
            target_step = payload.step
            df_in = base_df.copy()
        else:
            raise HTTPException(status_code=400, detail="Must provide either 'step' or 'steps' with 'step_index'.")

        cols_before = list(df_in.columns)
        schema_before = [
            {"name": col, "type": str(df_in[col].dtype), "null_count": int(df_in[col].isna().sum())}
            for col in df_in.columns
        ]
        sample_before = dataframe_to_records(df_in.head(row_limit))

        # Execute target step
        df_out, telemetry = execute_step(df_in, target_step, error_policy="continue_on_warning")
        cols_after = list(df_out.columns)
        schema_after = [
            {"name": col, "type": str(df_out[col].dtype), "null_count": int(df_out[col].isna().sum())}
            for col in df_out.columns
        ]
        sample_after = dataframe_to_records(df_out.head(row_limit))

        # Calculate schema diffs
        added_columns = [c for c in cols_after if c not in cols_before]
        dropped_columns = [c for c in cols_before if c not in cols_after]
        type_changes = []
        for col in cols_after:
            if col in cols_before:
                type_in = str(df_in[col].dtype)
                type_out = str(df_out[col].dtype)
                if type_in != type_out:
                    type_changes.append({"column": col, "from": type_in, "to": type_out})

        conversion_failures = [
            w for w in telemetry.get("warnings", [])
            if "unparseable" in w.lower() or "convert" in w.lower() or "dropped" in w.lower()
        ]

        return {
            "status": telemetry.get("status", "success"),
            "step_name": target_step.get("name", "Transformation Step"),
            "step_type": target_step.get("type"),
            "step_telemetry": telemetry,
            "duration_ms": telemetry.get("duration_ms", 0),
            "rows_before": len(df_in),
            "rows_after": len(df_out),
            "row_delta": len(df_out) - len(df_in),
            "cols_before_count": len(cols_before),
            "cols_after_count": len(cols_after),
            "before": {
                "rows": len(df_in),
                "columns": cols_before,
                "schema": schema_before,
                "sample": sample_before,
            },
            "after": {
                "rows": len(df_out),
                "columns": cols_after,
                "schema": schema_after,
                "sample": sample_after,
            },
            "changes": {
                "rows_removed": max(0, len(df_in) - len(df_out)),
                "rows_added": max(0, len(df_out) - len(df_in)),
                "added_columns": added_columns,
                "dropped_columns": dropped_columns,
                "type_changes": type_changes,
                "warnings": telemetry.get("warnings", []),
                "conversion_failures": conversion_failures,
                "error": telemetry.get("error"),
            },
        }
    except Exception as e:
        return {
            "status": "failed",
            "error": str(e),
            "step_telemetry": {
                "status": "failed",
                "error": str(e),
                "duration_ms": 0,
                "warnings": [],
            },
            "changes": {"error": str(e), "warnings": []},
            "before": {"rows": 0, "columns": [], "sample": []},
            "after": {"rows": 0, "columns": [], "sample": []},
        }


@app.post("/pipelines/preview-pipeline")
def preview_full_pipeline(payload: PipelinePreviewPayload):
    """
    Sequentially preview each step in a pipeline, capturing intermediate
    row counts and schema changes at every stage of the ETL workflow.
    """
    try:
        df = _get_base_dataframe(payload.records)
        intermediate_snapshots = []
        current_df = df.copy()

        for idx, step in enumerate(payload.steps):
            before_cols = list(current_df.columns)
            before_rows = len(current_df)

            current_df, telemetry = execute_step(
                current_df, step, error_policy=payload.error_policy or "continue_on_warning"
            )

            intermediate_snapshots.append({
                "step_index": idx,
                "step_id": step.get("id") or f"step_{idx+1}",
                "step_name": step.get("name") or f"Step {idx+1}",
                "step_type": step.get("type"),
                "telemetry": telemetry,
                "rows_after": len(current_df),
                "columns_after": list(current_df.columns),
                "sample": dataframe_to_records(current_df.head(10)),
            })

        return {
            "status": "success",
            "initial_rows": len(df),
            "final_rows": len(current_df),
            "initial_columns": list(df.columns),
            "final_columns": list(current_df.columns),
            "snapshots": intermediate_snapshots,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline preview failed: {e}")


@app.post("/pipelines/execute")
def execute_pipeline_workflow(payload: PipelineExecutionPayload):
    """
    Execute a full pipeline workflow, persist output to PostgreSQL destination,
    and record execution run telemetry.
    """
    # 1. Resolve pipeline definition
    pipeline_def = None
    if payload.pipeline:
        pipeline_def = payload.pipeline.dict()
    elif payload.pipeline_id:
        pipeline_def = get_pipeline(payload.pipeline_id)

    if not pipeline_def:
        raise HTTPException(status_code=400, detail="Must provide either a valid 'pipeline_id' or 'pipeline' payload.")

    pipeline_id = pipeline_def.get("id")
    pipeline_name = pipeline_def.get("name", "Unnamed Pipeline")
    steps = pipeline_def.get("steps") or []
    destination = pipeline_def.get("destination") or {"type": "postgres", "table": "customers"}
    error_policy = pipeline_def.get("error_policy") or "stop_on_error"

    # 2. Prepare base dataset
    df = _get_base_dataframe(payload.records)
    input_rows = len(df)

    # 3. Execute transformations
    try:
        final_df, step_telemetry, summary = execute_pipeline_transformations(
            df, steps, error_policy=error_policy
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline execution engine failed: {e}")

    # 4. Handle destination persistence
    destination_status = "skipped"
    destination_table = destination.get("table", "customers")
    records_loaded = 0
    dest_error = None

    if destination.get("type") == "postgres" and not final_df.empty:
        try:
            conn = get_connection()
            cursor = conn.cursor()

            # If writing to customers table
            if destination_table == "customers":
                records = dataframe_to_records(final_df)
                for r in records:
                    cursor.execute("""
                        INSERT INTO customers (id, name, email, age, city, updated_at)
                        VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
                        ON CONFLICT (id) DO UPDATE SET
                            name = EXCLUDED.name,
                            email = EXCLUDED.email,
                            age = EXCLUDED.age,
                            city = EXCLUDED.city,
                            updated_at = CURRENT_TIMESTAMP;
                    """, (
                        r.get("id"),
                        r.get("name"),
                        r.get("email"),
                        r.get("age"),
                        r.get("city"),
                    ))
                conn.commit()
                records_loaded = len(records)
                destination_status = f"Successfully loaded {records_loaded} records to 'customers'."

            cursor.close()
            conn.close()
        except Exception as dest_err:
            dest_error = str(dest_err)
            destination_status = f"PostgreSQL load failed: {dest_error}"

    # 5. Persist run telemetry in PostgreSQL
    completed_steps = sum(1 for s in step_telemetry if s.get("status") in ("success", "warning"))
    failed_steps = sum(1 for s in step_telemetry if s.get("status") == "failed")
    run_status = "success" if (summary["status"] == "success" and not dest_error) else "failed"

    run_record = {
        "pipeline_id": pipeline_id,
        "pipeline_name": pipeline_name,
        "status": run_status,
        "duration_ms": int(summary.get("total_duration_ms", 0)),
        "input_filename": "dataset_input",
        "input_rows": input_rows,
        "output_rows": len(final_df),
        "completed_steps": completed_steps,
        "failed_steps": failed_steps,
        "destination_status": destination_status,
        "destination_table": destination_table,
        "error_message": dest_error,
    }

    try:
        run_id = record_pipeline_run(run_record, step_telemetry)
    except Exception as run_err:
        print(f"Failed to record run telemetry: {run_err}")
        run_id = "unknown"

    return {
        "status": run_status,
        "run_id": run_id,
        "summary": summary,
        "step_telemetry": step_telemetry,
        "destination_status": destination_status,
        "records_loaded": records_loaded,
        "records": dataframe_to_records(final_df.head(100)),
        "columns": list(final_df.columns),
    }


