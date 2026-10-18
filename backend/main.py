import json
import os
import time
from io import BytesIO, StringIO
from typing import Any, Dict, List, Optional

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from psycopg2 import sql
from pydantic import BaseModel

from backend.data_quality import analyze_data
from backend.data_contracts import validate_data_contract
from backend.schema_detection import detect_schema_changes
from backend.database import (
    accept_pipeline_schema,
    check_connection,
    compare_pipeline_runs,
    create_data_contract,
    create_pipeline_run,
    delete_data_contract,
    delete_pipeline,
    delete_pipeline_run,
    duplicate_pipeline,
    finish_pipeline_run,
    generate_execution_report,
    generate_report_csv_string,
    get_app_settings,
    get_connection,
    get_dashboard_summary,
    get_data_contract,
    get_pipeline,
    get_pipeline_run_details,
    get_pipeline_version,
    get_public_tables,
    init_db,
    list_data_contracts,
    list_pipeline_runs,
    list_pipeline_versions,
    list_pipelines,
    preview_table,
    record_pipeline_run,
    rename_pipeline,
    restore_pipeline_version,
    save_pipeline,
    save_pipeline_contracts,
    save_pipeline_version,
    test_db_connection,
    update_app_settings,
    update_data_contract,
    validate_destination_mapping,
    write_dataframe_to_postgres,
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
    error_policy: Optional[str] = None
    version: Optional[int] = 1
    status: Optional[str] = "saved"
    data_contract: Optional[List[Dict[str, Any]]] = None


class DataContractRulePayload(BaseModel):
    rule_name: Optional[str] = None
    column_name: str
    is_required: Optional[bool] = True
    expected_type: Optional[str] = "string"
    allow_null: Optional[bool] = True
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    is_unique: Optional[bool] = False
    permitted_values: Optional[List[Any]] = []


class ContractValidationPayload(BaseModel):
    rules: Optional[List[Dict[str, Any]]] = None
    records: Optional[List[Dict[str, Any]]] = None
    error_policy: Optional[str] = "stop_on_error"


class SchemaCheckPayload(BaseModel):
    records: Optional[List[Dict[str, Any]]] = None
    expected_columns: Optional[List[Dict[str, Any]]] = None
    contract_rules: Optional[List[Dict[str, Any]]] = None


class AcceptSchemaPayload(BaseModel):
    new_schema: Optional[List[Dict[str, Any]]] = None
    records: Optional[List[Dict[str, Any]]] = None


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
    data_contract: Optional[List[Dict[str, Any]]] = None
    error_policy: Optional[str] = None
    destination: Optional[Dict[str, Any]] = None


class ValidateMappingPayload(BaseModel):
    target_table: str
    source_columns: List[str]
    schema_name: Optional[str] = "public"


class LoadOutputPayload(BaseModel):
    records: Optional[List[Dict[str, Any]]] = None
    table_name: str
    schema_name: Optional[str] = "public"
    mode: Optional[str] = "append"
    column_mapping: Optional[Dict[str, str]] = None


class DuplicatePipelinePayload(BaseModel):
    new_name: Optional[str] = None


class RenamePipelinePayload(BaseModel):
    name: str
    description: Optional[str] = None


class SaveVersionPayload(BaseModel):
    definition: Optional[Dict[str, Any]] = None



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
def preview_table_data(table_name: str, limit: Optional[int] = None):
    """Safely preview records from a PostgreSQL table."""
    try:
        if limit is None:
            try:
                limit = get_app_settings().get("preview_row_limit", 50)
            except Exception:
                limit = 50
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
# POSTGRESQL INTEGRATION ENDPOINTS (STAGE 6 - FEATURE 5)
# ==========================================

@app.get("/db/status")
@app.post("/db/test-connection")
def get_db_status():
    """
    Test and return safe PostgreSQL connection metadata.
    Zero passwords or credentials returned.
    """
    return check_connection()


@app.get("/db/tables")
def list_db_tables():
    """
    Retrieve all user tables in public schema with row counts and column schemas.
    """
    try:
        tables = get_public_tables()
        return {"status": "success", "tables": tables}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch PostgreSQL tables: {e}")


@app.get("/db/tables/{table_name}/preview")
def preview_db_table(table_name: str, schema: str = "public", limit: Optional[int] = None):
    """
    Safely preview records and schema from a user table in PostgreSQL.
    """
    try:
        if limit is None:
            try:
                limit = get_app_settings().get("preview_row_limit", 50)
            except Exception:
                limit = 25
        preview = preview_table(table_name=table_name, schema=schema, limit=limit)
        return {"status": "success", "preview": preview}
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview table '{table_name}': {e}")


@app.post("/db/validate-mapping")
def validate_mapping(payload: ValidateMappingPayload):
    """
    Validate source columns and type compatibility against a target PostgreSQL table.
    """
    try:
        result = validate_destination_mapping(
            target_table=payload.target_table,
            source_columns=payload.source_columns,
            schema=payload.schema_name or "public",
        )
        return {"status": "success", "validation": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Validation failed: {e}")


@app.post("/db/load-output")
def load_output_destination(payload: LoadOutputPayload):
    """
    Directly load dataset or pipeline output into a target PostgreSQL table.
    Supports append or replace modes with atomic transaction handling.
    """
    df = _get_base_dataframe(payload.records)
    if df.empty:
        raise HTTPException(status_code=400, detail="Cannot load empty dataset to PostgreSQL destination.")

    try:
        res = write_dataframe_to_postgres(
            df=df,
            table_name=payload.table_name,
            schema=payload.schema_name or "public",
            mode=payload.mode or "append",
            column_mapping=payload.column_mapping,
        )
        return res
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PostgreSQL load failed: {e}")


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
def get_pipeline_runs(
    pipeline_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: Optional[str] = "desc",
    limit: int = 100,
):
    """Retrieve execution run history and telemetry from PostgreSQL with search and filters."""
    try:
        runs = list_pipeline_runs(
            pipeline_id=pipeline_id,
            status=status,
            search=search,
            date_from=date_from,
            date_to=date_to,
            sort=sort or "desc",
            limit=limit,
        )
        return {"status": "success", "runs": runs, "count": len(runs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load run history: {e}")


@app.get("/pipelines/runs/compare")
def compare_runs_endpoint(run_id_1: str, run_id_2: str):
    """Compare two execution runs side-by-side."""
    try:
        res = compare_pipeline_runs(run_id_1, run_id_2)
        if not res:
            raise HTTPException(status_code=404, detail="One or both runs not found for comparison.")
        return {"status": "success", "comparison": res}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare runs: {e}")


@app.get("/pipelines/runs/{run_id}")
def get_single_run(run_id: str):
    """Retrieve full execution metadata and step-by-step metrics for a run."""
    run = get_pipeline_run_details(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found.")
    return {"status": "success", "run": run}


@app.get("/pipelines/runs/{run_id}/logs")
def get_run_logs(run_id: str):
    """Generate structured execution logs for a run."""
    run = get_pipeline_run_details(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found.")

    logs = []
    logs.append(f"[{run['started_at'] or 'START'}] INFO: Pipeline '{run['pipeline_name']}' execution initialized (Run ID: {run['run_id']})")
    logs.append(f"[{run['started_at'] or 'START'}] INFO: Input source dataset verified with {run['input_rows']} records")

    for s in run.get("steps", []):
        status_tag = "ERROR" if s["status"] == "failed" else "WARN" if s["status"] == "warning" else "INFO"
        logs.append(
            f"[{run['started_at'] or 'EXEC'}] {status_tag}: Step {s['step_order']} '{s['step_name']}' ({s['type']}) "
            f"[{s['status'].upper()}] - Duration: {s['duration_ms']}ms, In: {s['rows_before']}, Out: {s['rows_after']} (Delta: {s['row_delta']})"
        )
        for w in s.get("warnings", []):
            logs.append(f"[{run['started_at'] or 'EXEC'}] WARN: Step {s['step_order']} warning: {w}")
        if s.get("error"):
            logs.append(f"[{run['started_at'] or 'EXEC'}] ERROR: Step {s['step_order']} failed with error: {s['error']}")

    if run.get("destination_status"):
        logs.append(f"[{run['completed_at'] or 'END'}] INFO: Destination write status: {run['destination_status']}")
    if run.get("error_message"):
        logs.append(f"[{run['completed_at'] or 'END'}] ERROR: Destination error: {run['error_message']}")

    logs.append(f"[{run['completed_at'] or 'END'}] INFO: Overall run finished with status '{run['status'].upper()}' in {run['duration_ms']}ms")

    return {
        "status": "success",
        "run_id": run_id,
        "logs": logs,
        "text": "\n".join(logs),
    }


@app.get("/pipelines/runs/{run_id}/output")
def get_run_output(run_id: str, limit: int = 100):
    """Retrieve output records from destination table for a given run."""
    run = get_pipeline_run_details(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found.")

    table_name = run.get("destination_table") or "customers"
    try:
        prev = preview_table(table_name, limit=limit)
        return {
            "status": "success",
            "run_id": run_id,
            "destination_table": table_name,
            "output_rows": run.get("output_rows", 0),
            "columns": prev.get("columns", []),
            "records": prev.get("records") or prev.get("data") or [],
        }
    except Exception as e:
        return {
            "status": "partial",
            "run_id": run_id,
            "destination_table": table_name,
            "output_rows": run.get("output_rows", 0),
            "columns": [],
            "records": [],
            "message": f"Output records preview unavailable: {e}",
        }


@app.post("/pipelines/runs/{run_id}/retry")
def retry_pipeline_run(run_id: str, payload: Optional[PipelineExecutionPayload] = None):
    """Retry a pipeline run by creating a new execution record."""
    return replay_pipeline_execution(run_id, payload)


@app.post("/pipelines/runs/{run_id}/replay")
def replay_pipeline_execution(run_id: str, payload: Optional[PipelineExecutionPayload] = None):
    """
    Replay an execution run creating a fresh execution record.
    Preserves pipeline configuration and creates a new execution lifecycle.
    """
    run = get_pipeline_run_details(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Execution run not found.")

    pipeline_id = run.get("pipeline_id")
    pipeline_def = None
    if payload and payload.pipeline:
        pipeline_def = payload.pipeline.dict()
    elif pipeline_id:
        pipeline_def = get_pipeline(pipeline_id)

    if not pipeline_def:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot replay: original pipeline configuration for run '{run_id}' was not retained.",
        )

    records = payload.records if payload and payload.records is not None else None
    exec_payload = PipelineExecutionPayload(
        pipeline_id=pipeline_id,
        pipeline=PipelinePayload(**pipeline_def),
        records=records,
    )
    result = execute_pipeline_workflow(exec_payload)
    result["replayed_from_run_id"] = run_id
    result["input_file_used"] = run.get("input_filename", "dataset_input")
    return result


@app.delete("/pipelines/runs/{run_id}")
def delete_run_endpoint(run_id: str):
    """Delete an execution run record from PostgreSQL."""
    deleted = delete_pipeline_run(run_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Execution run not found.")
    return {"status": "success", "message": f"Run '{run_id}' deleted."}


# =========================================================
# STAGE 11 - FEATURE 10: EXECUTION REPORTS ENDPOINTS
# =========================================================

@app.get("/pipelines/reports")
def get_execution_reports(
    pipeline_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: Optional[str] = "desc",
    limit: int = 100,
):
    """Retrieve execution reports list from PostgreSQL execution history."""
    try:
        runs = list_pipeline_runs(
            pipeline_id=pipeline_id,
            status=status,
            search=search,
            date_from=date_from,
            date_to=date_to,
            sort=sort or "desc",
            limit=limit,
        )
        reports = []
        for r in runs:
            in_rows = r.get("input_rows") or 0
            out_rows = r.get("output_rows") or 0
            retention = round((out_rows / in_rows) * 100, 2) if in_rows > 0 else 0.0
            reports.append({
                "report_id": f"rep_{r['run_id']}",
                "run_id": r["run_id"],
                "pipeline_id": r.get("pipeline_id"),
                "pipeline_name": r.get("pipeline_name"),
                "status": r.get("status"),
                "started_at": r.get("started_at"),
                "completed_at": r.get("completed_at"),
                "duration_ms": r.get("duration_ms"),
                "input_filename": r.get("input_filename") or "dataset_input",
                "input_rows": in_rows,
                "output_rows": out_rows,
                "row_retention_pct": retention,
                "completed_steps": r.get("completed_steps") or 0,
                "failed_steps": r.get("failed_steps") or 0,
                "destination_table": r.get("destination_table"),
                "destination_status": r.get("destination_status"),
                "error_message": r.get("error_message"),
            })
        return {"status": "success", "reports": reports, "count": len(reports)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load reports: {e}")


@app.get("/pipelines/runs/{run_id}/report")
def get_single_run_report(run_id: str):
    """Retrieve full structured execution report for a run."""
    report = generate_execution_report(run_id)
    if not report:
        raise HTTPException(status_code=404, detail="Execution report not found.")
    return {"status": "success", "report": report}


@app.get("/pipelines/runs/{run_id}/report/json")
@app.get("/pipelines/runs/{run_id}/report/export/json")
def export_run_report_json(run_id: str):
    """Download the complete execution report as formatted JSON file."""
    report = generate_execution_report(run_id)
    if not report:
        raise HTTPException(status_code=404, detail="Execution report not found.")

    json_str = json.dumps(report, indent=2, default=str)
    return Response(
        content=json_str,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=flowforge_report_{run_id}.json"
        },
    )


@app.get("/pipelines/runs/{run_id}/report/csv")
@app.get("/pipelines/runs/{run_id}/report/export/csv")
def export_run_report_csv(run_id: str):
    """Download the complete execution report as structured CSV file."""
    report = generate_execution_report(run_id)
    if not report:
        raise HTTPException(status_code=404, detail="Execution report not found.")

    csv_str = generate_report_csv_string(report)
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=flowforge_report_{run_id}.csv"
        },
    )


# =========================================================
# STAGE 12 - DASHBOARD AND SETTINGS ENDPOINTS
# =========================================================

class SettingsPayload(BaseModel):
    default_output_format: Optional[str] = None
    preview_row_limit: Optional[int] = None
    default_error_policy: Optional[str] = None


@app.get("/dashboard/summary")
def get_dashboard_metrics():
    """Retrieve live dashboard overview metrics, counts, and recent failure diagnosis."""
    try:
        return get_dashboard_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load dashboard summary: {e}")


@app.get("/settings")
def get_settings_endpoint():
    """Retrieve persistent platform settings and PostgreSQL connection status."""
    try:
        settings = get_app_settings()
        db_status = check_connection()
        return {
            "status": "success",
            "settings": settings,
            "database": db_status,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load settings: {e}")


@app.post("/settings")
@app.put("/settings")
def update_settings_endpoint(payload: SettingsPayload):
    """Update persistent platform execution settings in PostgreSQL."""
    try:
        data = {k: v for k, v in payload.dict().items() if v is not None}
        updated = update_app_settings(data)
        return {
            "status": "success",
            "message": "Settings updated successfully.",
            "settings": updated,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update settings: {e}")


@app.get("/settings/test-connection")
@app.post("/settings/test-connection")
def test_connection_endpoint():
    """Execute live PostgreSQL roundtrip ping and return latency without exposing credentials."""
    try:
        res = test_db_connection()
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Test connection failed: {e}")


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


@app.post("/pipelines/{pipeline_id}/duplicate")
def duplicate_pipeline_endpoint(pipeline_id: str, payload: Optional[DuplicatePipelinePayload] = None):
    """
    Duplicate an existing pipeline with a new unique ID, copy of steps,
    initial version 1, and 'saved' status in PostgreSQL.
    """
    try:
        new_name = payload.new_name if payload else None
        duplicated = duplicate_pipeline(pipeline_id=pipeline_id, new_name=new_name)
        return {
            "status": "success",
            "message": f"Pipeline duplicated as '{duplicated['name']}'.",
            "pipeline": duplicated,
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to duplicate pipeline: {e}")


@app.post("/pipelines/{pipeline_id}/rename")
def rename_pipeline_endpoint(pipeline_id: str, payload: RenamePipelinePayload):
    """
    Rename an existing pipeline's name and/or description in PostgreSQL.
    """
    try:
        updated = rename_pipeline(
            pipeline_id=pipeline_id,
            new_name=payload.name,
            new_description=payload.description,
        )
        return {
            "status": "success",
            "message": f"Pipeline renamed to '{updated['name']}'.",
            "pipeline": updated,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename pipeline: {e}")


@app.get("/pipelines/{pipeline_id}/versions")
def get_pipeline_version_history(pipeline_id: str):
    """
    Retrieve full version history for a pipeline from PostgreSQL.
    """
    try:
        versions = list_pipeline_versions(pipeline_id)
        return {
            "status": "success",
            "pipeline_id": pipeline_id,
            "total_versions": len(versions),
            "versions": versions,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve version history: {e}")


@app.get("/pipelines/{pipeline_id}/versions/{version}")
def get_pipeline_version_snapshot(pipeline_id: str, version: int):
    """
    Retrieve a specific historical version snapshot for a pipeline.
    """
    snapshot = get_pipeline_version(pipeline_id, version)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"Version {version} not found for pipeline '{pipeline_id}'.")
    return {"status": "success", "version": snapshot, "version_snapshot": snapshot}


@app.post("/pipelines/{pipeline_id}/versions")
def save_as_new_version(pipeline_id: str, payload: Optional[SaveVersionPayload] = None):
    """
    Save pipeline definition as a new incremented version (Version N+1) in PostgreSQL.
    """
    try:
        defn = payload.definition if payload else None
        res = save_pipeline_version(pipeline_id, definition_update=defn)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save as new version: {e}")


@app.post("/pipelines/{pipeline_id}/versions/{version}/restore")
def restore_version_endpoint(pipeline_id: str, version: int):
    """
    Restore an old version snapshot without erasing history.
    Saves snapshot definition as Version N+1.
    """
    try:
        res = restore_pipeline_version(pipeline_id, version_to_restore=version)
        return res
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
# ==========================================
# DATA CONTRACTS ENDPOINTS (STAGE 8 - FEATURE 7)
# ==========================================

@app.get("/pipelines/{pipeline_id}/contracts")
def get_pipeline_data_contracts(pipeline_id: str):
    """
    Retrieve all data contract rules configured for a pipeline.
    """
    try:
        rules = list_data_contracts(pipeline_id)
        return {
            "status": "success",
            "pipeline_id": pipeline_id,
            "total_rules": len(rules),
            "contracts": rules,
            "rules": rules,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve data contracts: {e}")


@app.post("/pipelines/{pipeline_id}/contracts")
def add_pipeline_data_contract(pipeline_id: str, rule: DataContractRulePayload):
    """
    Add a new contract rule for a pipeline in PostgreSQL.
    """
    try:
        created = create_data_contract(pipeline_id, rule.dict())
        return {
            "status": "success",
            "message": f"Contract rule '{created['rule_name']}' created successfully.",
            "rule": created,
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create contract rule: {e}")


@app.put("/pipelines/{pipeline_id}/contracts/{rule_id}")
def update_pipeline_data_contract(pipeline_id: str, rule_id: int, rule: DataContractRulePayload):
    """
    Update an existing contract rule in PostgreSQL.
    """
    try:
        updated = update_data_contract(rule_id, rule.dict())
        return {
            "status": "success",
            "message": f"Contract rule '{updated['rule_name']}' updated successfully.",
            "rule": updated,
        }
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update contract rule: {e}")


@app.delete("/pipelines/{pipeline_id}/contracts/{rule_id}")
def delete_pipeline_data_contract(pipeline_id: str, rule_id: int):
    """
    Delete a contract rule from PostgreSQL.
    """
    try:
        deleted = delete_data_contract(rule_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Contract rule not found.")
        return {"status": "success", "message": "Contract rule removed successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete contract rule: {e}")


@app.post("/pipelines/{pipeline_id}/contracts/validate")
def validate_pipeline_contract_endpoint(pipeline_id: str, payload: Optional[ContractValidationPayload] = None):
    """
    Validate the input dataset against a pipeline's data contract rules.
    """
    try:
        rules = payload.rules if payload and payload.rules is not None else list_data_contracts(pipeline_id)
        records = payload.records if payload else None
        error_policy = payload.error_policy if payload and payload.error_policy else "stop_on_error"

        df = _get_base_dataframe(records)
        result = validate_data_contract(df, rules, error_policy=error_policy)
        return {"status": "success", "pipeline_id": pipeline_id, "validation": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract validation failed: {e}")


@app.post("/contracts/validate")
def validate_standalone_contract(payload: ContractValidationPayload):
    """
    Standalone validation of dataset records against arbitrary contract rules.
    """
    try:
        df = _get_base_dataframe(payload.records)
        rules = payload.rules or []
        result = validate_data_contract(df, rules, error_policy=payload.error_policy or "stop_on_error")
        return {"status": "success", "validation": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract validation failed: {e}")


# ==========================================
# SCHEMA CHANGE DETECTION ENDPOINTS (STAGE 9 - FEATURE 8)
# ==========================================

@app.post("/pipelines/{pipeline_id}/schema-check")
def check_pipeline_schema_changes(pipeline_id: str, payload: Optional[SchemaCheckPayload] = None):
    """
    Compare current input dataset schema with pipeline's expected schema and contract rules.
    Detects missing columns, unexpected columns, type changes, and required violations.
    """
    try:
        p = get_pipeline(pipeline_id)
        records = payload.records if payload else None
        df = _get_base_dataframe(records)

        if not p:
            contract_rules = payload.contract_rules if payload and payload.contract_rules is not None else []
            expected_cols = payload.expected_columns if payload else None
            changes = detect_schema_changes(
                current_df=df,
                expected_columns=expected_cols,
                contract_rules=contract_rules,
                pipeline=None,
            )
            return {
                "status": "success",
                "pipeline_id": pipeline_id,
                "pipeline_name": "Current Workbench Dataset",
                "schema_check": changes,
            }

        contract_rules = payload.contract_rules if payload and payload.contract_rules is not None else list_data_contracts(pipeline_id)
        expected_cols = payload.expected_columns if payload else None

        changes = detect_schema_changes(
            current_df=df,
            expected_columns=expected_cols,
            contract_rules=contract_rules,
            pipeline=p,
        )
        return {
            "status": "success",
            "pipeline_id": pipeline_id,
            "pipeline_name": p.get("name"),
            "schema_check": changes,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema change detection failed: {e}")


@app.post("/schema/detect-changes")
def detect_schema_changes_standalone(payload: SchemaCheckPayload):
    """
    Standalone schema change detection between provided records and expected schema/contracts.
    """
    try:
        df = _get_base_dataframe(payload.records)
        changes = detect_schema_changes(
            current_df=df,
            expected_columns=payload.expected_columns,
            contract_rules=payload.contract_rules,
        )
        return {"status": "success", "schema_check": changes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Standalone schema check failed: {e}")


@app.post("/pipelines/{pipeline_id}/accept-schema")
def accept_new_pipeline_schema(pipeline_id: str, payload: Optional[AcceptSchemaPayload] = None):
    """
    Accept new schema for a pipeline by synchronizing PostgreSQL data_contracts with new columns and types.
    Requires explicit user confirmation on the frontend.
    """
    try:
        p = get_pipeline(pipeline_id)
        if not p:
            raise HTTPException(status_code=404, detail=f"Pipeline '{pipeline_id}' not found.")

        new_schema = payload.new_schema if payload and payload.new_schema else None
        if not new_schema:
            df = _get_base_dataframe(payload.records if payload else None)
            changes = detect_schema_changes(df, contract_rules=list_data_contracts(pipeline_id))
            new_schema = changes.get("current_schema", [])

        updated_contracts = accept_pipeline_schema(pipeline_id, new_schema)
        return {
            "status": "success",
            "message": f"Successfully accepted new schema for pipeline '{p.get('name')}'. Updated {len(updated_contracts)} contract rules.",
            "pipeline_id": pipeline_id,
            "updated_contracts": updated_contracts,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to accept new schema: {e}")


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
        try:
            default_row_lim = get_app_settings().get("preview_row_limit", 50)
        except Exception:
            default_row_lim = 25
        row_limit = payload.row_limit or default_row_lim

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
    app_settings = get_app_settings()
    default_fmt = app_settings.get("default_output_format", "postgres")
    default_policy = app_settings.get("default_error_policy", "stop_on_error")

    destination = payload.destination or pipeline_def.get("destination") or {"type": default_fmt, "table": "customers"}
    if isinstance(destination, dict) and not destination.get("type"):
        destination["type"] = default_fmt
    error_policy = payload.error_policy or pipeline_def.get("error_policy") or default_policy

    # 2. Prepare base dataset
    df = _get_base_dataframe(payload.records)
    input_rows = len(df)

    # 3. Create persistent initial run record with status 'running'
    try:
        run_id = create_pipeline_run(
            pipeline_id=pipeline_id,
            pipeline_name=pipeline_name,
            input_filename="dataset_input",
            input_rows=input_rows,
        )
    except Exception as run_init_err:
        print(f"Warning: Failed to create initial run record: {run_init_err}")
        run_id = f"run_{int(time.time() * 1000)}"

    # 3.5. STAGE 8: Data contract pre-transformation validation
    contract_rules = payload.data_contract or pipeline_def.get("data_contract")
    if not contract_rules and pipeline_id:
        try:
            contract_rules = list_data_contracts(pipeline_id)
        except Exception:
            contract_rules = []

    contract_validation = None
    if contract_rules:
        contract_validation = validate_data_contract(df, contract_rules, error_policy=error_policy)
        if not contract_validation["can_continue"]:
            err_msg = f"Data contract validation failed: {contract_validation['summary']}"
            try:
                finish_pipeline_run(run_id, {
                    "status": "failed",
                    "duration_ms": 0,
                    "output_rows": 0,
                    "completed_steps": 0,
                    "failed_steps": 0,
                    "destination_status": "Blocked by data contract violation",
                    "destination_table": destination.get("table", "customers"),
                    "error_message": err_msg,
                }, [])
            except Exception as fin_err:
                print(f"Warning: Failed to finish run record: {fin_err}")

            run_details = None
            try:
                run_details = get_pipeline_run_details(run_id)
            except Exception:
                pass

            return {
                "status": "failed",
                "run_id": run_id,
                "run": run_details,
                "started_at": None,
                "completed_at": None,
                "duration_ms": 0,
                "input_rows": input_rows,
                "output_rows": 0,
                "completed_steps": 0,
                "failed_steps": 0,
                "destination_status": "Blocked by data contract violation",
                "destination_table": destination.get("table", "customers"),
                "records_loaded": 0,
                "failing_step": None,
                "error_message": err_msg,
                "summary": {"total_steps": len(steps), "completed": 0, "failed": 0},
                "step_telemetry": [],
                "contract_validation": contract_validation,
                "records": [],
                "columns": list(df.columns),
            }

    # 4. Execute transformations
    try:
        final_df, step_telemetry, summary = execute_pipeline_transformations(
            df, steps, error_policy=error_policy
        )
    except Exception as e:
        # Mark run failed in PostgreSQL
        finish_pipeline_run(run_id, {
            "status": "failed",
            "duration_ms": 0,
            "output_rows": 0,
            "completed_steps": 0,
            "failed_steps": len(steps),
            "destination_status": "Execution failed before destination write",
            "destination_table": destination.get("table", "customers"),
            "error_message": str(e),
        }, [])
        raise HTTPException(status_code=500, detail=f"Pipeline execution engine failed: {e}")

    # 5. Handle destination persistence
    destination_status = "skipped"
    destination_table = destination.get("table", "customers")
    destination_schema = destination.get("schema", "public")
    destination_mode = destination.get("mode", "append")
    records_loaded = 0
    dest_error = None

    has_failed = any(s.get("status") == "failed" for s in step_telemetry) or summary.get("status") == "failed"
    if has_failed:
        destination_status = "Skipped due to pipeline transformation failure"
    elif destination.get("type") == "postgres" and not final_df.empty:
        try:
            write_res = write_dataframe_to_postgres(
                df=final_df,
                table_name=destination_table,
                schema=destination_schema,
                mode=destination_mode,
                column_mapping=destination.get("column_mapping"),
            )
            records_loaded = write_res.get("rows_written", len(final_df))
            destination_status = write_res.get("message") or f"Successfully loaded {records_loaded} records to '{destination_table}'."
        except Exception as dest_err:
            dest_error = str(dest_err)
            destination_status = f"PostgreSQL load failed: {dest_error}"
    elif destination.get("type") == "csv":
        destination_status = f"CSV stream ready ({len(final_df)} records)."

    # 6. Finalize execution run lifecycle status
    completed_steps = sum(1 for s in step_telemetry if s.get("status") in ("success", "warning"))
    failed_steps = sum(1 for s in step_telemetry if s.get("status") == "failed")
    run_status = "completed" if (summary["status"] == "success" and not dest_error and failed_steps == 0) else "failed"

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
        "error_message": dest_error or next((s.get("error") for s in step_telemetry if s.get("error")), None),
    }

    try:
        finish_pipeline_run(run_id, run_record, step_telemetry)
    except Exception as run_err:
        print(f"Failed to record run telemetry: {run_err}")

    # Identify failing step if any
    failing_step = None
    for idx, s in enumerate(step_telemetry):
        if s.get("status") == "failed":
            failing_step = {
                "step_index": idx,
                "step_order": idx + 1,
                "step_id": s.get("step_id") or f"step_{idx+1}",
                "step_name": s.get("step_name") or f"Step {idx+1}",
                "step_type": s.get("type"),
                "error": s.get("error"),
            }
            break

    run_details = None
    try:
        run_details = get_pipeline_run_details(run_id)
    except Exception as fetch_err:
        print(f"Failed to fetch run details: {fetch_err}")

    return {
        "status": run_status,
        "run_id": run_id,
        "run": run_details or run_record,
        "started_at": run_details.get("started_at") if run_details else None,
        "completed_at": run_details.get("completed_at") if run_details else None,
        "duration_ms": run_record["duration_ms"],
        "input_rows": input_rows,
        "output_rows": len(final_df),
        "completed_steps": completed_steps,
        "failed_steps": failed_steps,
        "destination_status": destination_status,
        "destination_table": destination_table,
        "records_loaded": records_loaded,
        "failing_step": failing_step,
        "error_message": run_record["error_message"],
        "summary": summary,
        "step_telemetry": step_telemetry,
        "records": dataframe_to_records(final_df.head(int(app_settings.get("preview_row_limit", 50)))),
        "columns": list(final_df.columns),
        "contract_validation": contract_validation,
    }


