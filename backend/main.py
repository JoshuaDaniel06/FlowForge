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
    list_pipelines,
    save_pipeline,
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

