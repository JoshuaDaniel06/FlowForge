import os
import pandas as pd
import psycopg2
from dotenv import load_dotenv

load_dotenv()

df = pd.read_csv("customers.csv")
print("CSV file loaded successfully!")

# Clean duplicates
df = df[df["email"].isna() | ~df.duplicated(subset=["email"], keep="first")]

# Standardize city names
df["city"] = df["city"].str.strip().str.title()

# Fix invalid age
invalid_age_mask = (df["age"] < 0) | (df["age"] > 120)
df.loc[invalid_age_mask, "age"] = None

# Fix invalid email
invalid_email_mask = (
    df["email"].notna()
    & (
        ~df["email"].str.contains("@", na=False)
        | ~df["email"].str.contains(r"\.", na=False)
    )
)
df.loc[invalid_email_mask, "email"] = None

print("\nData transformed successfully!")

connection = psycopg2.connect(
    host=os.getenv("POSTGRES_HOST", "localhost"),
    port=int(os.getenv("POSTGRES_PORT", 5432)),
    user=os.getenv("POSTGRES_USER", "postgres"),
    password=os.getenv("POSTGRES_PASSWORD", ""),
    dbname=os.getenv("POSTGRES_DB", "flowforge"),
)

cursor = connection.cursor()

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

cursor.execute("TRUNCATE TABLE customers;")

for _, row in df.iterrows():
    cursor.execute("""
        INSERT INTO customers (id, name, email, age, city)
        VALUES (%s, %s, %s, %s, %s);
    """, (
        int(row["id"]),
        row["name"],
        row["email"] if pd.notna(row["email"]) else None,
        int(row["age"]) if pd.notna(row["age"]) else None,
        row["city"]
    ))

connection.commit()
cursor.close()
connection.close()

print("\nCleaned data successfully loaded into PostgreSQL!")
