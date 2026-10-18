import pandas as pd
import json
df = pd.read_csv("customers.csv")
print("CSV file loaded successfully!\n")
print("Missing values:")
print(df.isnull().sum())
duplicate_customers = df[
    df["email"].notna() &
    df.duplicated(subset=["email"], keep=False)
]
print("\nDuplicate customers:")
print(duplicate_customers)
invalid_age = df[
    (df["age"] < 0) |
    (df["age"] > 120)
]
print("\nInvalid ages:")
print(invalid_age)
invalid_email = df[
    df["email"].notna() &
    (
        ~df["email"].str.contains("@", na=False) |
        ~df["email"].str.contains(r"\.", na=False)
    )
]
print("\nInvalid emails:")
print(invalid_email)




print("\nInconsistent city data:")

df["city"] = df["city"].str.strip().str.title()

print("\nStandardized cities:")
print(df["city"])




missing_values = df.isnull().sum().sum()

duplicate_records = duplicate_customers.shape[0]

invalid_age_records = (
    (df["age"] < 0) |
    (df["age"] > 120)
).sum()

invalid_email_records = (
    df["email"].notna() &
    (
        ~df["email"].str.contains("@", na=False) |
        ~df["email"].str.contains(r"\.", na=False)
    )
).sum()




print("\n")
print("DATA QUALITY REPORT")
print("---------------------------")

print("Total records:", len(df))
print("Missing values:", missing_values)
print("Duplicate records:", duplicate_records)
print("Invalid ages:", invalid_age_records)
print("Invalid emails:", invalid_email_records)

total_records = len(df)

total_issues = (
    missing_values
    + duplicate_records
    + invalid_age_records
    + invalid_email_records
)

if total_records > 0:
    quality_score = max(
        0,
        100 - (total_issues / total_records * 100)
    )
else:
    quality_score = 0
    

print("Quality Score:", round(quality_score, 2), "%")

quality_report = {
    "total_records": int(total_records),
    "missing_values": int(missing_values),
    "duplicate_records": int(duplicate_records),
    "invalid_age_records": int(invalid_age_records),
    "invalid_email_records": int(invalid_email_records),
    "quality_score": round(quality_score, 2)
}

with open("quality_report.json", "w") as file:
    json.dump(quality_report, file, indent=4)

print("\nQuality report saved!")