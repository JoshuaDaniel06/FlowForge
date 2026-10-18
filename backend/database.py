import os
import json
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import psycopg2
from psycopg2 import sql
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

load_dotenv()

def get_db_config():
    return {
        "host": os.getenv("POSTGRES_HOST", "localhost"),
        "port": int(os.getenv("POSTGRES_PORT", 5432)),
        "dbname": os.getenv("POSTGRES_DB", "flowforge"),
        "user": os.getenv("POSTGRES_USER", "postgres"),
        "password": os.getenv("POSTGRES_PASSWORD", ""),
        "connect_timeout": 5,
    }

def get_connection(dbname=None):
    config = get_db_config()
    if dbname:
        config["dbname"] = dbname
    return psycopg2.connect(**config)

def ensure_database_exists():
    """Ensure the target database exists; if not, create it using postgres default db."""
    target_db = os.getenv("POSTGRES_DB", "flowforge")
    try:
        # Try connecting directly
        conn = get_connection(dbname=target_db)
        conn.close()
        return True
    except psycopg2.OperationalError as e:
        # If database doesn't exist, connect to postgres and create it
        if f'database "{target_db}" does not exist' in str(e).lower() or 'does not exist' in str(e).lower():
            try:
                root_conn = get_connection(dbname="postgres")
                root_conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
                cursor = root_conn.cursor()
                cursor.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(target_db)))
                cursor.close()
                root_conn.close()
                return True
            except Exception as create_err:
                print(f"Could not automatically create database '{target_db}': {create_err}")
                return False
        return False

def init_db():
    """Idempotently initialize required FlowForge tables in PostgreSQL."""
    ensure_database_exists()
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Customers destination table
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

    # 2. Pipeline definitions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pipelines (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            input_source JSONB NOT NULL DEFAULT '{}'::jsonb,
            steps JSONB NOT NULL DEFAULT '[]'::jsonb,
            destination JSONB NOT NULL DEFAULT '{}'::jsonb,
            error_policy VARCHAR(64) NOT NULL DEFAULT 'stop_on_error',
            version INT NOT NULL DEFAULT 1,
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. Pipeline versions
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_versions (
            id SERIAL PRIMARY KEY,
            pipeline_id VARCHAR(64) REFERENCES pipelines(id) ON DELETE CASCADE,
            version INT NOT NULL,
            definition JSONB NOT NULL,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 4. Pipeline runs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_runs (
            run_id VARCHAR(64) PRIMARY KEY,
            pipeline_id VARCHAR(64),
            pipeline_name VARCHAR(255),
            status VARCHAR(32) NOT NULL,
            started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
            completed_at TIMESTAMPTZ,
            duration_ms INT DEFAULT 0,
            input_filename VARCHAR(255),
            input_rows INT DEFAULT 0,
            output_rows INT DEFAULT 0,
            completed_steps INT DEFAULT 0,
            failed_steps INT DEFAULT 0,
            destination_status TEXT,
            destination_table TEXT,
            error_message TEXT
        );
    """)

    # 5. Pipeline step runs
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS pipeline_step_runs (
            id SERIAL PRIMARY KEY,
            run_id VARCHAR(64) REFERENCES pipeline_runs(run_id) ON DELETE CASCADE,
            step_id VARCHAR(64),
            step_name VARCHAR(255),
            step_type VARCHAR(64),
            step_order INT,
            status VARCHAR(32),
            duration_ms INT DEFAULT 0,
            rows_in INT DEFAULT 0,
            rows_out INT DEFAULT 0,
            warnings JSONB DEFAULT '[]'::jsonb,
            error_details TEXT
        );
    """)

    # 6. Data contracts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS data_contracts (
            id SERIAL PRIMARY KEY,
            pipeline_id VARCHAR(64),
            rule_name VARCHAR(128) NOT NULL,
            column_name VARCHAR(128) NOT NULL,
            is_required BOOLEAN DEFAULT TRUE,
            expected_type VARCHAR(64) NOT NULL,
            allow_null BOOLEAN DEFAULT TRUE,
            min_value NUMERIC,
            max_value NUMERIC,
            is_unique BOOLEAN DEFAULT FALSE,
            permitted_values JSONB DEFAULT '[]'::jsonb,
            created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 7. Ensure unique index on pipeline versions
    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_versions_uniq
        ON pipeline_versions (pipeline_id, version);
    """)

    # Backfill initial version for any pipelines that have none
    cursor.execute("""
        INSERT INTO pipeline_versions (pipeline_id, version, definition, created_at)
        SELECT p.id, p.version, to_jsonb(p), p.created_at
        FROM pipelines p
        WHERE NOT EXISTS (
            SELECT 1 FROM pipeline_versions pv
            WHERE pv.pipeline_id = p.id AND pv.version = p.version
        );
    """)

    # Seed default data contract rules for initial customer pipelines if none exist
    cursor.execute("SELECT COUNT(*) FROM data_contracts;")
    if cursor.fetchone()[0] == 0:
        cursor.execute("""
            INSERT INTO data_contracts (
                pipeline_id, rule_name, column_name, is_required,
                expected_type, allow_null, min_value, max_value, is_unique, permitted_values
            ) VALUES
            ('pl_default_customers', 'Required & Unique Email', 'email', TRUE, 'string', FALSE, NULL, NULL, TRUE, '[]'::jsonb),
            ('pl_default_customers', 'Valid Age Range', 'age', TRUE, 'integer', TRUE, 18, 120, FALSE, '[]'::jsonb),
            ('pl_default_customers', 'Permitted Cities', 'city', FALSE, 'string', TRUE, NULL, NULL, FALSE, '[\"Chennai\", \"Madurai\", \"Coimbatore\", \"Bangalore\", \"Mumbai\"]'::jsonb);
        """)

    # 8. Application settings
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(64) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Seed default settings if missing
    default_settings = {
        "default_output_format": "postgres",
        "preview_row_limit": 50,
        "default_error_policy": "stop_on_error",
    }
    for k, v in default_settings.items():
        cursor.execute("""
            INSERT INTO app_settings (key, value)
            VALUES (%s, %s::jsonb)
            ON CONFLICT (key) DO NOTHING;
        """, (k, json.dumps(v)))

    conn.commit()
    cursor.close()
    conn.close()

def check_connection():
    """Test PostgreSQL connection and return safe metadata (no credentials)."""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version_info = cursor.fetchone()[0]
        cursor.execute("SELECT current_database(), current_user;")
        db_name, db_user = cursor.fetchone()
        cursor.close()
        conn.close()
        return {
            "status": "connected",
            "database": db_name,
            "user": db_user,
            "version": version_info.split(",")[0],
            "host": os.getenv("POSTGRES_HOST", "localhost"),
            "port": int(os.getenv("POSTGRES_PORT", 5432)),
        }
    except Exception as e:
        return {
            "status": "disconnected",
            "error": str(e),
            "host": os.getenv("POSTGRES_HOST", "localhost"),
            "port": int(os.getenv("POSTGRES_PORT", 5432)),
            "database": os.getenv("POSTGRES_DB", "flowforge"),
        }

def get_public_tables():
    """Retrieve all user tables in the public schema with row count estimates."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name;
    """)
    table_names = [row[0] for row in cursor.fetchall()]
    
    tables_meta = []
    for tname in table_names:
        cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(tname)))
        count = cursor.fetchone()[0]
        cursor.execute("""
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position;
        """, (tname,))
        cols = [{"name": c[0], "type": c[1], "nullable": c[2] == "YES"} for c in cursor.fetchall()]
        tables_meta.append({
            "name": tname,
            "row_count": count,
            "columns": cols
        })
    cursor.close()
    conn.close()
    return tables_meta


def preview_table(table_name: str, schema: str = "public", limit: int = 25) -> dict:
    """Safely preview records and schema from a user table in PostgreSQL."""
    if not table_name or not table_name.isidentifier():
        raise ValueError(f"Invalid table identifier '{table_name}'.")
    if not schema or not schema.isidentifier():
        raise ValueError(f"Invalid schema identifier '{schema}'.")

    conn = get_connection()
    cursor = conn.cursor()

    # Verify table exists in schema
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = %s AND table_name = %s
        );
    """, (schema, table_name))
    if not cursor.fetchone()[0]:
        cursor.close()
        conn.close()
        raise ValueError(f"Table '{schema}.{table_name}' does not exist.")

    # Get column metadata
    cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position;
    """, (schema, table_name))
    columns_meta = [{"name": r[0], "type": r[1], "nullable": r[2] == "YES"} for r in cursor.fetchall()]
    col_names = [c["name"] for c in columns_meta]

    # Count total rows
    cursor.execute(sql.SQL("SELECT COUNT(*) FROM {}.{}").format(sql.Identifier(schema), sql.Identifier(table_name)))
    total_rows = cursor.fetchone()[0]

    # Preview sample rows
    query = sql.SQL("SELECT * FROM {}.{} LIMIT %s").format(sql.Identifier(schema), sql.Identifier(table_name))
    cursor.execute(query, (limit,))
    rows = cursor.fetchall()
    records = []
    for r in rows:
        rec = {}
        for idx, col in enumerate(col_names):
            val = r[idx]
            rec[col] = val.isoformat() if hasattr(val, "isoformat") else val
        records.append(rec)

    cursor.close()
    conn.close()
    return {
        "table_name": table_name,
        "schema": schema,
        "total_rows": total_rows,
        "columns": columns_meta,
        "records": records,
        "limit": limit,
    }


def validate_destination_mapping(target_table: str, source_columns: list, schema: str = "public") -> dict:
    """
    Validate source columns and type compatibility against a target PostgreSQL table.
    """
    if not target_table or not target_table.isidentifier():
        return {
            "valid": False,
            "table_exists": False,
            "errors": [f"Invalid table identifier '{target_table}'."],
            "warnings": [],
            "mappings": [],
        }

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position;
    """, (schema, target_table))
    target_cols_meta = [{"name": r[0], "type": r[1], "nullable": r[2] == "YES"} for r in cursor.fetchall()]
    cursor.close()
    conn.close()

    if not target_cols_meta:
        return {
            "valid": True,
            "table_exists": False,
            "notice": f"Table '{target_table}' does not exist yet. FlowForge will automatically create it with appropriate column types upon write.",
            "errors": [],
            "warnings": [f"Table '{target_table}' will be dynamically created on first run."],
            "mappings": [{"source": c, "target": c, "status": "new_column"} for c in source_columns],
        }

    target_col_names = {c["name"]: c for c in target_cols_meta}
    mappings = []
    errors = []
    warnings = []

    for scol in source_columns:
        if scol in target_col_names:
            mappings.append({
                "source": scol,
                "target": scol,
                "type": target_col_names[scol]["type"],
                "status": "matched",
            })
        else:
            warnings.append(f"Source column '{scol}' does not exist in target table '{target_table}' and will be ignored or added.")
            mappings.append({
                "source": scol,
                "target": None,
                "status": "unmatched_source",
            })

    # Check for non-nullable required target columns missing from source
    for tname, tmeta in target_col_names.items():
        if not tmeta["nullable"] and tname not in source_columns and tname != "id":
            errors.append(f"Target table non-nullable column '{tname}' ({tmeta['type']}) is missing from source dataset.")

    return {
        "valid": len(errors) == 0,
        "table_exists": True,
        "target_columns": target_cols_meta,
        "mappings": mappings,
        "errors": errors,
        "warnings": warnings,
    }


def write_dataframe_to_postgres(df, table_name: str, schema: str = "public", mode: str = "append", column_mapping: dict = None) -> dict:
    """
    Safely write a pandas DataFrame to PostgreSQL table with atomic transaction handling.
    Supports mode='append' or mode='replace'. Auto-creates table if missing.
    Rolls back cleanly on any failure.
    """
    import numpy as np
    import pandas as pd

    if not table_name or not table_name.isidentifier():
        raise ValueError(f"Invalid table identifier '{table_name}'.")
    if not schema or not schema.isidentifier():
        raise ValueError(f"Invalid schema identifier '{schema}'.")

    write_df = df.copy()
    if column_mapping:
        write_df = write_df.rename(columns=column_mapping)

    conn = get_connection()
    conn.autocommit = False
    cursor = conn.cursor()

    try:
        # 1. Check if table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = %s AND table_name = %s
            );
        """, (schema, table_name))
        table_exists = cursor.fetchone()[0]

        # Special optimization for customers table
        if table_name == "customers" and schema == "public":
            if mode == "replace":
                cursor.execute("TRUNCATE TABLE customers;")

            records = write_df.to_dict(orient="records")
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
            cursor.close()
            conn.close()
            return {
                "status": "success",
                "table": "customers",
                "schema": schema,
                "mode": mode,
                "rows_written": len(records),
                "rows_loaded": len(records),
                "message": f"Successfully loaded {len(records)} records into 'customers' ({mode} mode)."
            }

        # 2. Dynamic table handling for other tables
        if not table_exists:
            col_defs = []
            for col in write_df.columns:
                if not str(col).isidentifier():
                    raise ValueError(f"Invalid column identifier '{col}'.")
                dtype = write_df[col].dtype
                if pd.api.types.is_integer_dtype(dtype):
                    pg_type = "BIGINT"
                elif pd.api.types.is_float_dtype(dtype):
                    pg_type = "DOUBLE PRECISION"
                elif pd.api.types.is_bool_dtype(dtype):
                    pg_type = "BOOLEAN"
                elif pd.api.types.is_datetime64_any_dtype(dtype):
                    pg_type = "TIMESTAMPTZ"
                else:
                    pg_type = "TEXT"
                col_defs.append(sql.SQL("{} {}").format(sql.Identifier(str(col)), sql.SQL(pg_type)))

            create_query = sql.SQL("CREATE TABLE {}.{} ({}, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);").format(
                sql.Identifier(schema),
                sql.Identifier(table_name),
                sql.SQL(", ").join(col_defs)
            )
            cursor.execute(create_query)

        elif mode == "replace":
            cursor.execute(sql.SQL("TRUNCATE TABLE {}.{};").format(sql.Identifier(schema), sql.Identifier(table_name)))

        # 3. Insert records
        cursor.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = %s AND table_name = %s;
        """, (schema, table_name))
        dest_columns = {r[0] for r in cursor.fetchall()}

        valid_cols = [c for c in write_df.columns if str(c) in dest_columns]
        if not valid_cols:
            raise ValueError(f"No source columns match destination table '{table_name}'.")

        cols_sql = sql.SQL(", ").join(map(sql.Identifier, [str(c) for c in valid_cols]))
        placeholders = sql.SQL(", ").join([sql.SQL("%s")] * len(valid_cols))
        insert_sql = sql.SQL("INSERT INTO {}.{} ({}) VALUES ({});").format(
            sql.Identifier(schema),
            sql.Identifier(table_name),
            cols_sql,
            placeholders
        )

        records = []
        for _, row in write_df[valid_cols].iterrows():
            vals = []
            for val in row:
                if pd.isna(val) or val is None or val is np.nan:
                    vals.append(None)
                elif isinstance(val, (int, float, bool, str)):
                    vals.append(val)
                else:
                    vals.append(str(val))
            records.append(tuple(vals))

        for rec in records:
            cursor.execute(insert_sql, rec)

        conn.commit()
        cursor.close()
        conn.close()
        return {
            "status": "success",
            "table": table_name,
            "schema": schema,
            "mode": mode,
            "rows_written": len(records),
            "rows_loaded": len(records),
            "message": f"Successfully loaded {len(records)} records into '{schema}.{table_name}' ({mode} mode)."
        }

    except Exception as e:
        conn.rollback()
        cursor.close()
        conn.close()
        raise e


def save_pipeline(p: dict) -> dict:
    """Save or update a pipeline definition in PostgreSQL."""
    import json
    import time
    conn = get_connection()
    cursor = conn.cursor()

    pipeline_id = p.get("id") or f"pl_{int(time.time() * 1000)}"
    name = (p.get("name") or "Untitled Pipeline").strip()
    description = (p.get("description") or "").strip()
    input_source = json.dumps(p.get("input_source") or {"type": "current_dataset"})
    steps = json.dumps(p.get("steps") or [])
    destination = json.dumps(p.get("destination") or {"type": "postgres", "table": "customers"})
    error_policy = p.get("error_policy") or "stop_on_error"
    version = int(p.get("version") or 1)
    status = p.get("status") or "saved"

    cursor.execute("""
        INSERT INTO pipelines (id, name, description, input_source, steps, destination, error_policy, version, status, updated_at)
        VALUES (%s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            input_source = EXCLUDED.input_source,
            steps = EXCLUDED.steps,
            destination = EXCLUDED.destination,
            error_policy = EXCLUDED.error_policy,
            version = EXCLUDED.version,
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, name, description, input_source, steps, destination, error_policy, version, status, created_at, updated_at;
    """, (pipeline_id, name, description, input_source, steps, destination, error_policy, version, status))

    row = cursor.fetchone()

    # Automatically archive version snapshot in pipeline_versions
    pipeline_dict = {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "input_source": row[3],
        "steps": row[4],
        "destination": row[5],
        "error_policy": row[6],
        "version": row[7],
        "status": row[8],
    }
    cursor.execute("""
        INSERT INTO pipeline_versions (pipeline_id, version, definition, created_at)
        VALUES (%s, %s, %s::jsonb, CURRENT_TIMESTAMP)
        ON CONFLICT (pipeline_id, version) DO UPDATE SET
            definition = EXCLUDED.definition;
    """, (pipeline_id, version, json.dumps(pipeline_dict)))

    conn.commit()
    cursor.close()
    conn.close()

    return {
        **pipeline_dict,
        "created_at": row[9].isoformat() if row[9] else None,
        "updated_at": row[10].isoformat() if row[10] else None,
    }


def duplicate_pipeline(pipeline_id: str, new_name: str = None) -> dict:
    """Duplicate an existing pipeline as a new saved pipeline with version 1."""
    import time
    orig = get_pipeline(pipeline_id)
    if not orig:
        raise ValueError(f"Pipeline with ID '{pipeline_id}' not found.")

    new_id = f"pl_{int(time.time() * 1000)}"
    target_name = (new_name or f"{orig['name']} (Copy)").strip()

    copy_payload = {
        "id": new_id,
        "name": target_name,
        "description": orig.get("description", ""),
        "input_source": orig.get("input_source") or {"type": "current_dataset"},
        "steps": orig.get("steps") or [],
        "destination": orig.get("destination") or {"type": "postgres", "table": "customers"},
        "error_policy": orig.get("error_policy", "stop_on_error"),
        "version": 1,
        "status": "saved",
    }
    return save_pipeline(copy_payload)


def rename_pipeline(pipeline_id: str, new_name: str, new_description: str = None) -> dict:
    """Update pipeline name and optionally description."""
    if not new_name or not new_name.strip():
        raise ValueError("Pipeline name cannot be empty.")

    conn = get_connection()
    cursor = conn.cursor()
    if new_description is not None:
        cursor.execute("""
            UPDATE pipelines SET
                name = %s,
                description = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id;
        """, (new_name.strip(), new_description.strip(), pipeline_id))
    else:
        cursor.execute("""
            UPDATE pipelines SET
                name = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING id;
        """, (new_name.strip(), pipeline_id))

    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        raise ValueError(f"Pipeline with ID '{pipeline_id}' not found.")

    conn.commit()
    cursor.close()
    conn.close()
    return get_pipeline(pipeline_id)


def save_pipeline_version(pipeline_id: str, definition_update: dict = None) -> dict:
    """
    Increment pipeline version by 1, update current pipeline,
    and archive immutable snapshot into pipeline_versions.
    """
    import json
    p = get_pipeline(pipeline_id)
    if not p:
        raise ValueError(f"Pipeline with ID '{pipeline_id}' not found.")

    new_version = int(p.get("version", 1)) + 1

    merged = {**p}
    if definition_update:
        if "name" in definition_update and definition_update["name"]:
            merged["name"] = definition_update["name"].strip()
        if "description" in definition_update:
            merged["description"] = definition_update["description"].strip()
        if "steps" in definition_update and isinstance(definition_update["steps"], list):
            merged["steps"] = definition_update["steps"]
        if "input_source" in definition_update and isinstance(definition_update["input_source"], dict):
            merged["input_source"] = definition_update["input_source"]
        if "destination" in definition_update and isinstance(definition_update["destination"], dict):
            merged["destination"] = definition_update["destination"]
        if "error_policy" in definition_update and definition_update["error_policy"]:
            merged["error_policy"] = definition_update["error_policy"]

    merged["version"] = new_version
    merged["status"] = "saved"

    # Save to pipelines and archive in pipeline_versions
    saved = save_pipeline(merged)

    return {
        "status": "success",
        "pipeline": saved,
        "version": new_version,
        "message": f"Saved pipeline '{saved['name']}' as new Version {new_version}."
    }


def list_pipeline_versions(pipeline_id: str) -> list:
    """Retrieve full version history for a pipeline ordered from newest to oldest."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, pipeline_id, version, definition, created_at
        FROM pipeline_versions
        WHERE pipeline_id = %s
        ORDER BY version DESC;
    """, (pipeline_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    versions = []
    for r in rows:
        defn = r[3] if isinstance(r[3], dict) else {}
        steps = defn.get("steps") or []
        versions.append({
            "id": r[0],
            "pipeline_id": r[1],
            "version": r[2],
            "created_at": r[4].isoformat() if r[4] else None,
            "steps_count": len(steps) if isinstance(steps, list) else 0,
            "name": defn.get("name", "Untitled Pipeline"),
            "description": defn.get("description", ""),
            "status": defn.get("status", "saved"),
            "definition": defn,
        })
    return versions


def get_pipeline_version(pipeline_id: str, version: int):
    """Retrieve a specific version snapshot."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, pipeline_id, version, definition, created_at
        FROM pipeline_versions
        WHERE pipeline_id = %s AND version = %s;
    """, (pipeline_id, version))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return None

    defn = row[3] if isinstance(row[3], dict) else {}
    return {
        "id": row[0],
        "pipeline_id": row[1],
        "version": row[2],
        "created_at": row[4].isoformat() if row[4] else None,
        "definition": defn,
    }


def restore_pipeline_version(pipeline_id: str, version_to_restore: int) -> dict:
    """
    Restore an old version snapshot without erasing history.
    Fetches snapshot of version_to_restore and saves it as version (current_version + 1).
    """
    snap = get_pipeline_version(pipeline_id, version_to_restore)
    if not snap:
        raise ValueError(f"Version {version_to_restore} of pipeline '{pipeline_id}' not found.")

    current = get_pipeline(pipeline_id)
    if not current:
        raise ValueError(f"Pipeline '{pipeline_id}' not found.")

    new_version = int(current.get("version", 1)) + 1

    restored_defn = snap.get("definition") or {}
    payload = {
        "id": pipeline_id,
        "name": current.get("name"),
        "description": restored_defn.get("description", current.get("description")),
        "input_source": restored_defn.get("input_source") or current.get("input_source"),
        "steps": restored_defn.get("steps") or [],
        "destination": restored_defn.get("destination") or current.get("destination"),
        "error_policy": restored_defn.get("error_policy") or current.get("error_policy"),
        "version": new_version,
        "status": "saved",
    }

    # Save as new version
    saved = save_pipeline(payload)

    return {
        "status": "success",
        "restored_from_version": version_to_restore,
        "new_version": new_version,
        "pipeline": saved,
        "message": f"Successfully restored Version {version_to_restore} as new Version {new_version}."
    }


def get_pipeline(pipeline_id: str):
    """Retrieve a single pipeline by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, description, input_source, steps, destination, error_policy, version, status, created_at, updated_at
        FROM pipelines
        WHERE id = %s;
    """, (pipeline_id,))
    row = cursor.fetchone()
    cursor.close()
    conn.close()

    if not row:
        return None

    return {
        "id": row[0],
        "name": row[1],
        "description": row[2],
        "input_source": row[3],
        "steps": row[4],
        "destination": row[5],
        "error_policy": row[6],
        "version": row[7],
        "status": row[8],
        "created_at": row[9].isoformat() if row[9] else None,
        "updated_at": row[10].isoformat() if row[10] else None,
    }


def list_pipelines():
    """List all saved pipelines ordered by last updated timestamp."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, description, input_source, steps, destination, error_policy, version, status, created_at, updated_at
        FROM pipelines
        ORDER BY updated_at DESC;
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {
            "id": r[0],
            "name": r[1],
            "description": r[2],
            "input_source": r[3],
            "steps": r[4],
            "steps_count": len(r[4]) if isinstance(r[4], list) else 0,
            "destination": r[5],
            "error_policy": r[6],
            "version": r[7],
            "status": r[8],
            "created_at": r[9].isoformat() if r[9] else None,
            "updated_at": r[10].isoformat() if r[10] else None,
        }
        for r in rows
    ]


def delete_pipeline(pipeline_id: str) -> bool:
    """Delete a pipeline by ID and cascade delete associated contracts."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM data_contracts WHERE pipeline_id = %s;", (pipeline_id,))
    cursor.execute("DELETE FROM pipelines WHERE id = %s RETURNING id;", (pipeline_id,))
    deleted = cursor.fetchone() is not None
    conn.commit()
    cursor.close()
    conn.close()
    return deleted


def record_pipeline_run(run_data: dict, step_runs: list) -> str:
    """Persist pipeline execution run and per-step metrics into PostgreSQL."""
    import json
    import time
    conn = get_connection()
    cursor = conn.cursor()

    run_id = run_data.get("run_id") or f"run_{int(time.time() * 1000)}"

    cursor.execute("""
        INSERT INTO pipeline_runs (
            run_id, pipeline_id, pipeline_name, status, started_at, completed_at,
            duration_ms, input_filename, input_rows, output_rows, completed_steps,
            failed_steps, destination_status, destination_table, error_message
        ) VALUES (
            %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
            %s, %s, %s, %s, %s, %s, %s, %s, %s
        );
    """, (
        run_id,
        run_data.get("pipeline_id"),
        run_data.get("pipeline_name", "Unnamed Pipeline"),
        run_data.get("status", "success"),
        int(run_data.get("duration_ms", 0)),
        run_data.get("input_filename"),
        int(run_data.get("input_rows", 0)),
        int(run_data.get("output_rows", 0)),
        int(run_data.get("completed_steps", 0)),
        int(run_data.get("failed_steps", 0)),
        run_data.get("destination_status"),
        run_data.get("destination_table"),
        run_data.get("error_message"),
    ))

    for idx, s in enumerate(step_runs):
        cursor.execute("""
            INSERT INTO pipeline_step_runs (
                run_id, step_id, step_name, step_type, step_order,
                status, duration_ms, rows_in, rows_out, warnings, error_details
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s
            );
        """, (
            run_id,
            s.get("step_id") or f"step_{idx+1}",
            s.get("step_name") or f"Step {idx+1}",
            s.get("type"),
            idx + 1,
            s.get("status", "success"),
            int(s.get("duration_ms", 0)),
            int(s.get("rows_before", 0)),
            int(s.get("rows_after", 0)),
            json.dumps(s.get("warnings", [])),
            s.get("error"),
        ))

    conn.commit()
    cursor.close()
    conn.close()
    return run_id


def list_pipeline_runs(
    pipeline_id: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: str = "desc",
    limit: int = 100,
) -> list:
    """List execution run history from PostgreSQL with search, status, date filtering, and sorting."""
    conn = get_connection()
    cursor = conn.cursor()

    query = """
        SELECT run_id, pipeline_id, pipeline_name, status, started_at, completed_at,
               duration_ms, input_filename, input_rows, output_rows, completed_steps,
               failed_steps, destination_status, destination_table, error_message
        FROM pipeline_runs
        WHERE 1=1
    """
    params = []

    if pipeline_id:
        query += " AND pipeline_id = %s"
        params.append(pipeline_id)

    if status and status.lower() != "all":
        query += " AND LOWER(status) = %s"
        params.append(status.lower())

    if search and search.strip():
        query += " AND (pipeline_name ILIKE %s OR run_id ILIKE %s)"
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern])

    if date_from:
        query += " AND started_at >= %s"
        params.append(date_from)

    if date_to:
        query += " AND started_at <= %s"
        params.append(date_to)

    order_dir = "ASC" if sort.lower() == "asc" else "DESC"
    query += f" ORDER BY started_at {order_dir} LIMIT %s;"
    params.append(limit)

    cursor.execute(query, tuple(params))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    return [
        {
            "run_id": r[0],
            "pipeline_id": r[1],
            "pipeline_name": r[2],
            "status": r[3],
            "started_at": r[4].isoformat() if r[4] else None,
            "completed_at": r[5].isoformat() if r[5] else None,
            "duration_ms": r[6],
            "input_filename": r[7],
            "input_rows": r[8],
            "output_rows": r[9],
            "completed_steps": r[10],
            "failed_steps": r[11],
            "destination_status": r[12],
            "destination_table": r[13],
            "error_message": r[14],
        }
        for r in rows
    ]


def create_pipeline_run(pipeline_id: str, pipeline_name: str, input_filename: str = "dataset_input", input_rows: int = 0) -> str:
    """Create an initial pending/running pipeline execution run record in PostgreSQL."""
    import time
    conn = get_connection()
    cursor = conn.cursor()
    run_id = f"run_{int(time.time() * 1000)}"
    cursor.execute("""
        INSERT INTO pipeline_runs (
            run_id, pipeline_id, pipeline_name, status, started_at,
            input_filename, input_rows
        ) VALUES (
            %s, %s, %s, 'running', CURRENT_TIMESTAMP, %s, %s
        ) RETURNING run_id;
    """, (run_id, pipeline_id, pipeline_name, input_filename, input_rows))
    conn.commit()
    cursor.close()
    conn.close()
    return run_id


def finish_pipeline_run(run_id: str, run_data: dict, step_runs: list) -> str:
    """Update pipeline run to completed/failed and record all step metrics."""
    import json
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE pipeline_runs SET
            status = %s,
            completed_at = CURRENT_TIMESTAMP,
            duration_ms = %s,
            output_rows = %s,
            completed_steps = %s,
            failed_steps = %s,
            destination_status = %s,
            destination_table = %s,
            error_message = %s
        WHERE run_id = %s;
    """, (
        run_data.get("status", "completed"),
        int(run_data.get("duration_ms", 0)),
        int(run_data.get("output_rows", 0)),
        int(run_data.get("completed_steps", 0)),
        int(run_data.get("failed_steps", 0)),
        run_data.get("destination_status"),
        run_data.get("destination_table"),
        run_data.get("error_message"),
        run_id,
    ))

    # Clear any previous steps if retrying
    cursor.execute("DELETE FROM pipeline_step_runs WHERE run_id = %s;", (run_id,))

    for idx, s in enumerate(step_runs):
        cursor.execute("""
            INSERT INTO pipeline_step_runs (
                run_id, step_id, step_name, step_type, step_order,
                status, duration_ms, rows_in, rows_out, warnings, error_details
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s
            );
        """, (
            run_id,
            s.get("step_id") or f"step_{idx+1}",
            s.get("step_name") or f"Step {idx+1}",
            s.get("type"),
            idx + 1,
            s.get("status", "completed"),
            int(s.get("duration_ms", 0)),
            int(s.get("rows_before", 0)),
            int(s.get("rows_after", 0)),
            json.dumps(s.get("warnings", [])),
            s.get("error"),
        ))

    conn.commit()
    cursor.close()
    conn.close()
    return run_id


def get_pipeline_run_details(run_id: str) -> dict:
    """Retrieve full execution metadata and step-by-step metrics for a run."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT run_id, pipeline_id, pipeline_name, status, started_at, completed_at,
               duration_ms, input_filename, input_rows, output_rows, completed_steps,
               failed_steps, destination_status, destination_table, error_message
        FROM pipeline_runs
        WHERE run_id = %s;
    """, (run_id,))
    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        return None

    run_meta = {
        "run_id": row[0],
        "pipeline_id": row[1],
        "pipeline_name": row[2],
        "status": row[3],
        "started_at": row[4].isoformat() if row[4] else None,
        "completed_at": row[5].isoformat() if row[5] else None,
        "duration_ms": row[6],
        "input_filename": row[7],
        "input_rows": row[8],
        "output_rows": row[9],
        "completed_steps": row[10],
        "failed_steps": row[11],
        "destination_status": row[12],
        "destination_table": row[13],
        "error_message": row[14],
    }

    cursor.execute("""
        SELECT step_id, step_name, step_type, step_order, status, duration_ms,
               rows_in, rows_out, warnings, error_details
        FROM pipeline_step_runs
        WHERE run_id = %s
        ORDER BY step_order ASC;
    """, (run_id,))
    step_rows = cursor.fetchall()
    cursor.close()
    conn.close()

    run_meta["steps"] = [
        {
            "step_id": sr[0],
            "step_name": sr[1],
            "type": sr[2],
            "step_order": sr[3],
            "status": sr[4],
            "duration_ms": sr[5],
            "rows_before": sr[6],
            "rows_after": sr[7],
            "row_delta": sr[7] - sr[6],
            "warnings": sr[8] if isinstance(sr[8], list) else [],
            "error": sr[9],
        }
        for sr in step_rows
    ]

    return run_meta


def delete_pipeline_run(run_id: str) -> bool:
    """Delete a pipeline run and its step records from PostgreSQL."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pipeline_runs WHERE run_id = %s;", (run_id,))
    deleted = cursor.rowcount > 0
    conn.commit()
    cursor.close()
    conn.close()
    return deleted


def compare_pipeline_runs(run_id_1: str, run_id_2: str) -> dict:
    """Compare two execution runs side-by-side."""
    run1 = get_pipeline_run_details(run_id_1)
    run2 = get_pipeline_run_details(run_id_2)
    if not run1 or not run2:
        return None

    duration_delta = (run2.get("duration_ms") or 0) - (run1.get("duration_ms") or 0)
    output_rows_delta = (run2.get("output_rows") or 0) - (run1.get("output_rows") or 0)

    # Align steps by order and ID
    steps1 = {s["step_id"]: s for s in run1.get("steps", [])}
    steps2 = {s["step_id"]: s for s in run2.get("steps", [])}
    all_step_ids = list(dict.fromkeys(list(steps1.keys()) + list(steps2.keys())))

    step_comparisons = []
    for sid in all_step_ids:
        s1 = steps1.get(sid)
        s2 = steps2.get(sid)
        step_comparisons.append({
            "step_id": sid,
            "step_name": (s2 or s1).get("step_name"),
            "step_type": (s2 or s1).get("type"),
            "run1_status": s1.get("status") if s1 else "not_run",
            "run2_status": s2.get("status") if s2 else "not_run",
            "run1_duration_ms": s1.get("duration_ms") if s1 else 0,
            "run2_duration_ms": s2.get("duration_ms") if s2 else 0,
            "run1_rows_out": s1.get("rows_after") if s1 else 0,
            "run2_rows_out": s2.get("rows_after") if s2 else 0,
        })

    return {
        "run1": run1,
        "run2": run2,
        "deltas": {
            "duration_ms": duration_delta,
            "output_rows": output_rows_delta,
            "status_match": run1.get("status") == run2.get("status"),
        },
        "step_comparisons": step_comparisons,
    }


# =========================================================
# STAGE 11 - FEATURE 10: EXECUTION REPORTS
# =========================================================

def generate_execution_report(run_id: str) -> dict:
    """
    Generate a full structured execution report from saved PostgreSQL execution data.
    Sanitizes configuration to exclude secrets, passwords, and tokens.
    """
    run = get_pipeline_run_details(run_id)
    if not run:
        return None

    # Retrieve pipeline definition if saved to enrich step configurations
    step_configs = {}
    pipeline_def = None
    if run.get("pipeline_id"):
        try:
            pipeline_def = get_pipeline(run["pipeline_id"])
            if pipeline_def and pipeline_def.get("steps"):
                for s in pipeline_def["steps"]:
                    s_id = s.get("id")
                    if s_id:
                        raw_params = s.get("params") or s.get("config") or {}
                        # Sanitize parameters (exclude sensitive keys)
                        sanitized_params = {
                            k: ("***" if any(sec in str(k).lower() for sec in ["pass", "secret", "token", "key", "auth"]) else v)
                            for k, v in raw_params.items()
                        }
                        step_configs[s_id] = sanitized_params
        except Exception:
            pass

    # Enrich step telemetry
    enriched_steps = []
    for s in run.get("steps", []):
        cfg = step_configs.get(s["step_id"], {})
        enriched_steps.append({
            "step_order": s["step_order"],
            "step_id": s["step_id"],
            "step_name": s["step_name"],
            "step_type": s["type"],
            "configuration": cfg,
            "status": s["status"],
            "duration_ms": s["duration_ms"],
            "rows_before": s["rows_before"],
            "rows_after": s["rows_after"],
            "row_delta": s["row_delta"],
            "warnings": s.get("warnings") or [],
            "error_details": s.get("error"),
        })

    # Retrieve output schema from destination table if available
    dest_table = run.get("destination_table")
    output_schema = []
    if dest_table:
        try:
            conn = get_connection()
            cursor = conn.cursor()
            cursor.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = %s
                ORDER BY ordinal_position;
            """, (dest_table,))
            cols = cursor.fetchall()
            output_schema = [
                {"column_name": c[0], "data_type": c[1], "nullable": c[2] == "YES"}
                for c in cols
            ]
            cursor.close()
            conn.close()
        except Exception:
            pass

    input_count = run.get("input_rows") or 0
    output_count = run.get("output_rows") or 0
    retention_pct = round((output_count / input_count) * 100, 2) if input_count > 0 else 0.0

    report = {
        "report_id": f"rep_{run['run_id']}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "execution_summary": {
            "pipeline_id": run.get("pipeline_id"),
            "pipeline_name": run.get("pipeline_name") or "Unnamed Pipeline",
            "run_id": run["run_id"],
            "input_filename": run.get("input_filename") or "dataset_input",
            "execution_timestamp": run.get("started_at"),
            "completed_at": run.get("completed_at"),
            "overall_status": run.get("status"),
            "duration_ms": run.get("duration_ms") or 0,
            "input_rows": input_count,
            "output_rows": output_count,
            "row_retention_pct": retention_pct,
            "completed_steps": run.get("completed_steps") or 0,
            "failed_steps": run.get("failed_steps") or 0,
            "total_steps": len(enriched_steps),
            "error_message": run.get("error_message"),
        },
        "step_results": enriched_steps,
        "output_and_destination": {
            "output_schema": output_schema,
            "output_row_count": output_count,
            "destination_type": "postgres" if dest_table else "csv",
            "destination_table": dest_table,
            "database_write_status": run.get("destination_status") or "No write recorded",
            "database_error": run.get("error_message") if run.get("status") == "failed" and dest_table else None,
        },
        "security_audit": {
            "sanitized": True,
            "secrets_excluded": True,
            "database_credentials_exposed": False,
        }
    }
    return report


def generate_report_csv_string(report: dict) -> str:
    """
    Format execution report into a clean, well-structured CSV string.
    """
    import io
    import csv

    output = io.StringIO()
    writer = csv.writer(output)

    summary = report.get("execution_summary", {})
    output_dest = report.get("output_and_destination", {})
    steps = report.get("step_results", [])

    # Header / Meta
    writer.writerow(["# FlowForge Execution Audit Report"])
    writer.writerow(["# Report ID", report.get("report_id", "")])
    writer.writerow(["# Generated At", report.get("generated_at", "")])
    writer.writerow([])

    # Execution Summary Section
    writer.writerow(["=== EXECUTION SUMMARY ==="])
    writer.writerow(["Metric", "Value"])
    writer.writerow(["Pipeline Name", summary.get("pipeline_name", "")])
    writer.writerow(["Pipeline ID", summary.get("pipeline_id", "")])
    writer.writerow(["Run ID", summary.get("run_id", "")])
    writer.writerow(["Overall Status", summary.get("overall_status", "")])
    writer.writerow(["Started At", summary.get("execution_timestamp", "")])
    writer.writerow(["Completed At", summary.get("completed_at", "")])
    writer.writerow(["Duration (ms)", summary.get("duration_ms", 0)])
    writer.writerow(["Input Filename / Reference", summary.get("input_filename", "")])
    writer.writerow(["Input Rows", summary.get("input_rows", 0)])
    writer.writerow(["Output Rows", summary.get("output_rows", 0)])
    writer.writerow(["Row Retention Rate (%)", f"{summary.get('row_retention_pct', 0)}%"])
    writer.writerow(["Completed Steps", summary.get("completed_steps", 0)])
    writer.writerow(["Failed Steps", summary.get("failed_steps", 0)])
    if summary.get("error_message"):
        writer.writerow(["Error Message", summary.get("error_message")])
    writer.writerow([])

    # Output and Destination Section
    writer.writerow(["=== OUTPUT & DESTINATION ==="])
    writer.writerow(["Property", "Value"])
    writer.writerow(["Destination Type", output_dest.get("destination_type", "")])
    writer.writerow(["Destination Table", output_dest.get("destination_table", "")])
    writer.writerow(["Database Write Status", output_dest.get("database_write_status", "")])
    writer.writerow(["Output Row Count", output_dest.get("output_row_count", 0)])
    writer.writerow([])

    # Step Results Section
    writer.writerow(["=== STEP EXECUTION RESULTS ==="])
    writer.writerow([
        "Step Order",
        "Step Name",
        "Step Type",
        "Status",
        "Duration (ms)",
        "Rows Before",
        "Rows After",
        "Row Delta",
        "Warnings",
        "Error Details",
    ])
    for s in steps:
        warnings_str = "; ".join(s.get("warnings") or [])
        writer.writerow([
            s.get("step_order", ""),
            s.get("step_name", ""),
            s.get("step_type", ""),
            s.get("status", ""),
            s.get("duration_ms", 0),
            s.get("rows_before", 0),
            s.get("rows_after", 0),
            s.get("row_delta", 0),
            warnings_str,
            s.get("error_details") or "",
        ])

    return output.getvalue()


# =========================================================
# STAGE 8 - FEATURE 7: DATA CONTRACTS PERSISTENCE
# =========================================================

def list_data_contracts(pipeline_id: str) -> list:
    """Retrieve all data contract rules for a given pipeline."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, pipeline_id, rule_name, column_name, is_required,
               expected_type, allow_null, min_value, max_value, is_unique,
               permitted_values, created_at
        FROM data_contracts
        WHERE pipeline_id = %s
        ORDER BY id ASC;
    """, (pipeline_id,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    results = []
    for r in rows:
        results.append({
            "id": r[0],
            "pipeline_id": r[1],
            "rule_name": r[2],
            "column_name": r[3],
            "is_required": bool(r[4]),
            "expected_type": r[5],
            "allow_null": bool(r[6]),
            "min_value": float(r[7]) if r[7] is not None else None,
            "max_value": float(r[8]) if r[8] is not None else None,
            "is_unique": bool(r[9]),
            "permitted_values": r[10] if isinstance(r[10], list) else [],
            "created_at": r[11].isoformat() if r[11] else None,
        })
    return results


def get_data_contract(contract_id: int):
    """Retrieve a single contract rule by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, pipeline_id, rule_name, column_name, is_required,
               expected_type, allow_null, min_value, max_value, is_unique,
               permitted_values, created_at
        FROM data_contracts
        WHERE id = %s;
    """, (contract_id,))
    r = cursor.fetchone()
    cursor.close()
    conn.close()
    if not r:
        return None
    return {
        "id": r[0],
        "pipeline_id": r[1],
        "rule_name": r[2],
        "column_name": r[3],
        "is_required": bool(r[4]),
        "expected_type": r[5],
        "allow_null": bool(r[6]),
        "min_value": float(r[7]) if r[7] is not None else None,
        "max_value": float(r[8]) if r[8] is not None else None,
        "is_unique": bool(r[9]),
        "permitted_values": r[10] if isinstance(r[10], list) else [],
        "created_at": r[11].isoformat() if r[11] else None,
    }


def create_data_contract(pipeline_id: str, rule: dict) -> dict:
    """Create a new data contract rule for a pipeline."""
    import json
    conn = get_connection()
    cursor = conn.cursor()

    rule_name = (rule.get("rule_name") or f"Contract Rule ({rule.get('column_name', '')})").strip()
    column_name = (rule.get("column_name") or "").strip()
    if not column_name:
        cursor.close()
        conn.close()
        raise ValueError("Column name cannot be empty for a contract rule.")

    is_required = bool(rule.get("is_required", True))
    expected_type = (rule.get("expected_type") or "any").strip().lower()
    allow_null = bool(rule.get("allow_null", True))
    min_value = rule.get("min_value")
    max_value = rule.get("max_value")
    is_unique = bool(rule.get("is_unique", False))
    permitted_values = json.dumps(rule.get("permitted_values") or [])

    cursor.execute("""
        INSERT INTO data_contracts (
            pipeline_id, rule_name, column_name, is_required,
            expected_type, allow_null, min_value, max_value,
            is_unique, permitted_values, created_at
        ) VALUES (
            %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, CURRENT_TIMESTAMP
        )
        RETURNING id, pipeline_id, rule_name, column_name, is_required,
                  expected_type, allow_null, min_value, max_value, is_unique,
                  permitted_values, created_at;
    """, (
        pipeline_id, rule_name, column_name, is_required,
        expected_type, allow_null, min_value, max_value,
        is_unique, permitted_values
    ))
    r = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    return {
        "id": r[0],
        "pipeline_id": r[1],
        "rule_name": r[2],
        "column_name": r[3],
        "is_required": bool(r[4]),
        "expected_type": r[5],
        "allow_null": bool(r[6]),
        "min_value": float(r[7]) if r[7] is not None else None,
        "max_value": float(r[8]) if r[8] is not None else None,
        "is_unique": bool(r[9]),
        "permitted_values": r[10] if isinstance(r[10], list) else [],
        "created_at": r[11].isoformat() if r[11] else None,
    }


def update_data_contract(contract_id: int, rule: dict) -> dict:
    """Update an existing data contract rule."""
    import json
    conn = get_connection()
    cursor = conn.cursor()

    existing = get_data_contract(contract_id)
    if not existing:
        cursor.close()
        conn.close()
        raise ValueError(f"Data contract rule with ID {contract_id} not found.")

    rule_name = (rule.get("rule_name") or existing["rule_name"]).strip()
    column_name = (rule.get("column_name") or existing["column_name"]).strip()
    is_required = bool(rule.get("is_required", existing["is_required"]))
    expected_type = (rule.get("expected_type") or existing["expected_type"]).strip().lower()
    allow_null = bool(rule.get("allow_null", existing["allow_null"]))
    min_value = rule.get("min_value") if "min_value" in rule else existing["min_value"]
    max_value = rule.get("max_value") if "max_value" in rule else existing["max_value"]
    is_unique = bool(rule.get("is_unique", existing["is_unique"]))
    permitted_values = json.dumps(rule.get("permitted_values") if "permitted_values" in rule else existing["permitted_values"])

    cursor.execute("""
        UPDATE data_contracts SET
            rule_name = %s,
            column_name = %s,
            is_required = %s,
            expected_type = %s,
            allow_null = %s,
            min_value = %s,
            max_value = %s,
            is_unique = %s,
            permitted_values = %s::jsonb
        WHERE id = %s
        RETURNING id, pipeline_id, rule_name, column_name, is_required,
                  expected_type, allow_null, min_value, max_value, is_unique,
                  permitted_values, created_at;
    """, (
        rule_name, column_name, is_required, expected_type,
        allow_null, min_value, max_value, is_unique,
        permitted_values, contract_id
    ))
    r = cursor.fetchone()
    conn.commit()
    cursor.close()
    conn.close()

    return {
        "id": r[0],
        "pipeline_id": r[1],
        "rule_name": r[2],
        "column_name": r[3],
        "is_required": bool(r[4]),
        "expected_type": r[5],
        "allow_null": bool(r[6]),
        "min_value": float(r[7]) if r[7] is not None else None,
        "max_value": float(r[8]) if r[8] is not None else None,
        "is_unique": bool(r[9]),
        "permitted_values": r[10] if isinstance(r[10], list) else [],
        "created_at": r[11].isoformat() if r[11] else None,
    }


def delete_data_contract(contract_id: int) -> bool:
    """Delete a data contract rule by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM data_contracts WHERE id = %s RETURNING id;", (contract_id,))
    deleted = cursor.fetchone() is not None
    conn.commit()
    cursor.close()
    conn.close()
    return deleted


def save_pipeline_contracts(pipeline_id: str, rules: list) -> list:
    """Bulk save/sync data contract rules for a pipeline."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM data_contracts WHERE pipeline_id = %s;", (pipeline_id,))
    conn.commit()
    cursor.close()
    conn.close()

    saved_rules = []
    for r in rules:
        saved_rules.append(create_data_contract(pipeline_id, r))
    return saved_rules


# =========================================================
# STAGE 9 - FEATURE 8: SCHEMA DETECTION PERSISTENCE
# =========================================================

def accept_pipeline_schema(pipeline_id: str, current_schema: list) -> list:
    """
    Accept new schema for a pipeline by synchronizing data_contracts in PostgreSQL.
    Creates or updates contract rules to match the new incoming schema columns and types.
    """
    existing_rules = {r["column_name"]: r for r in list_data_contracts(pipeline_id)}

    updated_rules = []
    for col_info in current_schema:
        col_name = col_info.get("name") or col_info.get("column")
        if not col_name:
            continue
        col_type = col_info.get("type", "string")
        has_nulls = bool(col_info.get("has_nulls", True))

        if col_name in existing_rules:
            rule = existing_rules[col_name]
            updated = update_data_contract(rule["id"], {
                "expected_type": col_type,
                "allow_null": has_nulls or rule["allow_null"],
            })
            updated_rules.append(updated)
        else:
            created = create_data_contract(pipeline_id, {
                "rule_name": f"Schema Rule ({col_name})",
                "column_name": col_name,
                "expected_type": col_type,
                "is_required": True,
                "allow_null": has_nulls,
                "is_unique": False,
                "permitted_values": [],
            })
    # If any previous rule is absent in the new accepted schema, relax its requirement to optional
    current_col_names = {col_info.get("name") or col_info.get("column") for col_info in current_schema if (col_info.get("name") or col_info.get("column"))}
    for old_col, old_rule in existing_rules.items():
        if old_col not in current_col_names and old_rule.get("is_required"):
            updated_rules.append(update_data_contract(old_rule["id"], {"is_required": False}))

    return updated_rules


# =========================================================
# STAGE 12 - DASHBOARD AND SETTINGS INTEGRATION
# =========================================================

def get_app_settings() -> dict:
    """Retrieve persistent platform configuration settings from PostgreSQL."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(64) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)
    cursor.execute("SELECT key, value FROM app_settings;")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    settings = {
        "default_output_format": "postgres",
        "preview_row_limit": 50,
        "default_error_policy": "stop_on_error",
    }
    for k, v in rows:
        settings[k] = v
    return settings


def update_app_settings(updates: dict) -> dict:
    """Validate and update persistent platform settings in PostgreSQL."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS app_settings (
            key VARCHAR(64) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );
    """)
    for k, v in updates.items():
        if k == "default_output_format" and v in ["postgres", "csv"]:
            cursor.execute("""
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (%s, %s::jsonb, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
            """, (k, json.dumps(v)))
        elif k == "preview_row_limit":
            try:
                lim = int(v)
                if 5 <= lim <= 1000:
                    cursor.execute("""
                        INSERT INTO app_settings (key, value, updated_at)
                        VALUES (%s, %s::jsonb, CURRENT_TIMESTAMP)
                        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
                    """, (k, json.dumps(lim)))
            except (ValueError, TypeError):
                pass
        elif k == "default_error_policy" and v in ["stop_on_error", "continue_on_error"]:
            cursor.execute("""
                INSERT INTO app_settings (key, value, updated_at)
                VALUES (%s, %s::jsonb, CURRENT_TIMESTAMP)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;
            """, (k, json.dumps(v)))
    conn.commit()
    cursor.close()
    conn.close()
    return get_app_settings()


def test_db_connection() -> dict:
    """Perform a live roundtrip latency test against PostgreSQL without exposing secrets."""
    start = time.perf_counter()
    try:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT current_database(), current_user, version();")
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "status": "connected",
            "latency_ms": elapsed_ms,
            "database": row[0],
            "user": row[1],
            "host": os.getenv("POSTGRES_HOST", "localhost"),
            "port": int(os.getenv("POSTGRES_PORT", 5432)),
            "version": row[2].split(",")[0],
            "message": f"Successfully connected to PostgreSQL '{row[0]}' in {elapsed_ms}ms.",
        }
    except Exception as e:
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        return {
            "status": "disconnected",
            "latency_ms": elapsed_ms,
            "error": str(e),
            "host": os.getenv("POSTGRES_HOST", "localhost"),
            "port": int(os.getenv("POSTGRES_PORT", 5432)),
            "database": os.getenv("POSTGRES_DB", "flowforge"),
            "message": f"Connection failed after {elapsed_ms}ms: {e}",
        }


def get_dashboard_summary() -> dict:
    """
    Generate live dashboard overview metrics directly from PostgreSQL.
    Includes saved pipeline count, successful/failed run counts, connection status,
    recent runs, recently updated pipelines, and recent failure diagnosis.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Pipeline count
    cursor.execute("SELECT COUNT(*) FROM pipelines;")
    saved_pipelines_count = cursor.fetchone()[0]

    # 2. Run counts
    cursor.execute("""
        SELECT 
            COUNT(*) AS total_runs,
            COUNT(*) FILTER (WHERE status = 'completed') AS successful_runs,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed_runs
        FROM pipeline_runs;
    """)
    run_stats = cursor.fetchone()
    total_runs = run_stats[0]
    successful_runs = run_stats[1]
    failed_runs = run_stats[2]

    # 3. Recent runs (last 5)
    cursor.execute("""
        SELECT run_id, pipeline_id, pipeline_name, status, started_at, duration_ms, input_rows, output_rows, destination_status
        FROM pipeline_runs
        ORDER BY started_at DESC
        LIMIT 5;
    """)
    recent_runs_rows = cursor.fetchall()
    recent_runs = [
        {
            "run_id": r[0],
            "pipeline_id": r[1],
            "pipeline_name": r[2] or "Unnamed Pipeline",
            "status": r[3],
            "started_at": r[4].isoformat() if r[4] else None,
            "duration_ms": r[5],
            "input_rows": r[6],
            "output_rows": r[7],
            "destination_status": r[8],
        }
        for r in recent_runs_rows
    ]

    # 4. Recently updated pipelines (last 5)
    cursor.execute("""
        SELECT id, name, version, updated_at, jsonb_array_length(COALESCE(steps, '[]'::jsonb)) as step_count
        FROM pipelines
        ORDER BY updated_at DESC
        LIMIT 5;
    """)
    recent_pipelines_rows = cursor.fetchall()
    recent_pipelines = [
        {
            "id": p[0],
            "name": p[1],
            "version": p[2],
            "updated_at": p[3].isoformat() if p[3] else None,
            "step_count": p[4],
        }
        for p in recent_pipelines_rows
    ]

    # 5. Recent failure summary (latest failed run)
    cursor.execute("""
        SELECT run_id, pipeline_id, pipeline_name, started_at, error_message
        FROM pipeline_runs
        WHERE status = 'failed'
        ORDER BY started_at DESC
        LIMIT 1;
    """)
    fail_row = cursor.fetchone()
    recent_failure = None
    if fail_row:
        recent_failure = {
            "run_id": fail_row[0],
            "pipeline_id": fail_row[1],
            "pipeline_name": fail_row[2] or "Unnamed Pipeline",
            "started_at": fail_row[3].isoformat() if fail_row[3] else None,
            "error_message": fail_row[4] or "Unspecified pipeline error",
        }

    cursor.close()
    conn.close()

    db_status = check_connection()

    return {
        "status": "success",
        "metrics": {
            "saved_pipelines_count": saved_pipelines_count,
            "successful_runs_count": successful_runs,
            "failed_runs_count": failed_runs,
            "total_runs_count": total_runs,
            "postgres_status": db_status.get("status", "disconnected"),
        },
        "database": db_status,
        "recent_runs": recent_runs,
        "recent_pipelines": recent_pipelines,
        "recent_failure": recent_failure,
    }