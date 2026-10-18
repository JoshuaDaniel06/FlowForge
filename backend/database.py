import os
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
            destination_status VARCHAR(64),
            destination_table VARCHAR(128),
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
    conn.commit()
    cursor.close()
    conn.close()

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
    """Delete a pipeline by ID."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM pipelines WHERE id = %s RETURNING id;", (pipeline_id,))
    deleted = cursor.fetchone() is not None
    conn.commit()
    cursor.close()
    conn.close()
    return deleted