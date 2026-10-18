import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Upload,
  BarChart3,
  Database,
  GitBranch,
  FileCheck2,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  UploadCloud,
  ArrowRight,
  CircleCheck,
  CircleAlert,
  Trash2,
  Copy,
  Menu,
  X,
  Search,
  Plus,
  ArrowUp,
  ArrowDown,
  Play,
  Check,
  Edit2,
  Sliders,
  Layers,
  Eye,
  Clock,
  PlayCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

/* =========================================================
   NAVIGATION
========================================================= */

const NAV_ITEMS = [
  {
    section: "MAIN",
    items: [
      {
        id: "overview",
        label: "Overview",
        icon: LayoutDashboard,
      },
      {
        id: "workbench",
        label: "Pipeline Workbench",
        icon: GitBranch,
      },
      {
        id: "upload",
        label: "Upload Dataset",
        icon: Upload,
      },
      {
        id: "quality",
        label: "Quality Analysis",
        icon: BarChart3,
      },
      {
        id: "cleaned",
        label: "Cleaned Data",
        icon: FileCheck2,
      },
      {
        id: "etl",
        label: "ETL Pipeline",
        icon: Layers,
      },
    ],
  },
  {
    section: "DATA",
    items: [
      {
        id: "records",
        label: "Dataset Records",
        icon: Database,
      },
      {
        id: "postgres",
        label: "PostgreSQL Database",
        icon: Server,
      },
    ],
  },
  {
    section: "SYSTEM",
    items: [
      {
        id: "api",
        label: "API Status",
        icon: Activity,
      },
    ],
  },
];

/* =========================================================
   APP
========================================================= */

function App() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dbLoadResult, setDbLoadResult] = useState(null);
  const [activePage, setActivePage] = useState("overview");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  /* =======================================================
     FILE SELECT
  ======================================================= */

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    setFile(selectedFile);
    setResult(null);
    setDbLoadResult(null);
    setMessage("");
  };

  /* =======================================================
     ANALYZE
  ======================================================= */

  const analyzeFile = async () => {
    if (!file) {
      setMessage("Please select a CSV file first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze dataset.");
      }

      const data = await response.json();

      setResult(data);
      setLastUpdated(new Date());
      setActivePage("overview");
      setMessage("Dataset analyzed successfully.");
    } catch (error) {
      console.error(error);
      setMessage(
        error.message ||
          "Unable to analyze the dataset. Please check the backend."
      );
    } finally {
      setLoading(false);
    }
  };

  /* =======================================================
     DOWNLOAD CLEANED CSV
  ======================================================= */

  const downloadCleanedCSV = async () => {
    if (!file) {
      setMessage("Please upload and analyze a CSV file first.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/clean`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to generate cleaned CSV.");
      }

      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = "cleaned_customers.csv";

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);

      setLastUpdated(new Date());
      setMessage("Cleaned CSV downloaded successfully.");
    } catch (error) {
      console.error(error);
      setMessage(
        error.message || "Unable to download cleaned CSV."
      );
    }
  };

  /* =======================================================
     LOAD POSTGRESQL
  ======================================================= */

  const loadToPostgres = async () => {
    if (!file) {
      setMessage("Please upload a CSV file first.");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${API_URL}/load`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to load data into PostgreSQL.");
      }

      const data = await response.json();

      setDbLoadResult(data);
      setLastUpdated(new Date());
      setMessage(
        data.message || "Data loaded into PostgreSQL successfully."
      );
    } catch (error) {
      console.error(error);
      setMessage(
        error.message ||
          "Unable to load data into PostgreSQL."
      );
    }
  };

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const navigate = (page) => {
    setActivePage(page);
    setMobileMenu(false);
    setMessage("");
  };

  /* =======================================================
     PAGE TITLE
  ======================================================= */

  const getPageInfo = () => {
    const pages = {
      overview: {
        title: "Overview",
        subtitle: "Data quality and ETL pipeline at a glance",
      },
      upload: {
        title: "Upload Dataset",
        subtitle: "Upload a CSV file for quality analysis",
      },
      quality: {
        title: "Quality Analysis",
        subtitle: "Inspect the quality of your dataset",
      },
      cleaned: {
        title: "Cleaned Data",
        subtitle: "Review and download the cleaned dataset",
      },
      etl: {
        title: "ETL Pipeline",
        subtitle: "Track the data ingestion and transformation flow",
      },
      records: {
        title: "Dataset Records",
        subtitle: "Explore the analyzed customer records",
      },
      workbench: {
        title: "Pipeline Workbench",
        subtitle: "Design, configure, and validate your data transformation workflows",
      },
      postgres: {
        title: "PostgreSQL Database",
        subtitle: "Load and manage cleaned data in PostgreSQL",
      },
      api: {
        title: "API Status",
        subtitle: "Monitor FlowForge backend availability",
      },
    };

    return pages[activePage] || pages.overview;
  };

  const pageInfo = getPageInfo();

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app-shell">
      {/* MOBILE MENU BUTTON */}
      <button
        className="mobile-menu-button"
        onClick={() => setMobileMenu(!mobileMenu)}
      >
        {mobileMenu ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            FF
          </div>

          <div className="brand-text">
            <h1>FlowForge</h1>
            <span>ETL PIPELINE PLATFORM</span>
          </div>
        </div>

        <div className="sidebar-scroll">
          {NAV_ITEMS.map((section) => (
            <div
              className="nav-section"
              key={section.section}
            >
              <div className="nav-section-title">
                {section.section}
              </div>

              <nav className="sidebar-nav">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      className={`nav-item ${
                        active ? "active" : ""
                      }`}
                      onClick={() => navigate(item.id)}
                    >
                      <Icon size={17} strokeWidth={1.9} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer">
          <div className="status-dot"></div>

          <div>
            <strong>FlowForge</strong>
            <span>ETL Pipeline Platform v2.0</span>
          </div>
        </div>
      </aside>

      {/* ===================================================
          MAIN
      =================================================== */}

      <main className="main">
        <header className="page-header">
          <div>
            <h2>{pageInfo.title}</h2>
            <p>{pageInfo.subtitle}</p>
          </div>

          <div className="header-actions">
            <span className="last-updated">
              Updated {lastUpdated.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true, 
              })
              .replace("am", "AM")
              .replace("pm", "PM")}
            </span>

            <button
              className="refresh-button"
              onClick={() => {
                setLastUpdated(new Date());
                window.location.reload();
              }}
            >
              <RefreshCw size={11} />
              Refresh
            </button>
          </div>
        </header>

        {message && (
          <div className="notification">
            <CircleCheck size={17} />
            <span>{message}</span>
          </div>
        )}

        {/* =================================================
            PAGE CONTENT
        ================================================= */}

        {activePage === "overview" && (
          <OverviewPage
            result={result}
            navigate={navigate}
            analyzeFile={analyzeFile}
            loading={loading}
            downloadCleanedCSV={downloadCleanedCSV}
            loadToPostgres={loadToPostgres}
          />
        )}

        {activePage === "workbench" && (
          <PipelineWorkbenchPage
            file={file}
            result={result}
            navigate={navigate}
          />
        )}

        {activePage === "upload" && (
          <UploadPage
            file={file}
            handleFileChange={handleFileChange}
            analyzeFile={analyzeFile}
            loading={loading}
            result={result}
          />
        )}

        {activePage === "quality" && (
          <QualityPage
            result={result}
            navigate={navigate}
          />
        )}

        {activePage === "cleaned" && (
          <CleanedDataPage
            result={result}
            downloadCleanedCSV={downloadCleanedCSV}
            navigate={navigate}
          />
        )}

        {activePage === "etl" && (
          <ETLPage
            file={file}
            result={result}
            dbLoadResult={dbLoadResult}
            loadToPostgres={loadToPostgres}
          />
        )}

        {activePage === "records" && (
          <DatasetRecordsPage result={result} />
        )}

        {activePage === "postgres" && (
          <PostgreSQLPage
            result={result}
            file={file}
            dbLoadResult={dbLoadResult}
            loadToPostgres={loadToPostgres}
          />
        )}

        {activePage === "api" && (
          <APIStatusPage
            dbConnected={dbLoadResult?.status === "success"}
          />
        )}
      </main>
    </div>
  );
}

function QualityBarChart({
  missingValues,
  duplicateRecords,
  invalidAges,
  invalidEmails,
}) {
  const data = [
    { name: "Missing", value: Number(missingValues) || 0 },
    { name: "Duplicates", value: Number(duplicateRecords) || 0 },
    { name: "Invalid Age", value: Number(invalidAges) || 0 },
    { name: "Invalid Email", value: Number(invalidEmails) || 0 },
  ];

  return (
    <div className="quality-chart">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -18, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="#e5e7eb"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#858a93", fontSize: 12 }}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#858a93", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: "#f4f5f7" }}
            contentStyle={{
              background: "#ffffff",
              border: "1px solid #e8e8e8",
              borderRadius: "10px",
              boxShadow: "0 8px 24px rgba(17, 24, 39, 0.08)",
              fontSize: "13px",
            }}
          />
          <Bar
            dataKey="value"
            name="Issues"
            fill="#1952ce"
            radius={[6, 6, 0, 0]}
            barSize={80}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* =========================================================
   STEP CONFIG MODAL (STAGE 2)
========================================================= */

const TRANSFORMATION_TYPES = [
  { id: "filter_rows", label: "Filter Rows", description: "Filter rows by column conditions" },
  { id: "sort_rows", label: "Sort Rows", description: "Sort records by column order" },
  { id: "select_columns", label: "Select Columns", description: "Retain specific columns" },
  { id: "rename_column", label: "Rename Column", description: "Rename a single column" },
  { id: "drop_columns", label: "Drop Columns", description: "Remove specified columns" },
  { id: "reorder_columns", label: "Reorder Columns", description: "Change output column ordering" },
  { id: "remove_duplicates", label: "Remove Duplicates", description: "Deduplicate by key columns" },
  { id: "type_conversion", label: "Type Conversion", description: "Cast data type with error policy" },
  { id: "derived_column", label: "Derived Column", description: "Compute new column with safe operations" },
  { id: "aggregation", label: "Aggregation", description: "Group-by and aggregate metrics" },
];

function StepConfigModal({
  isOpen,
  onClose,
  onSave,
  stepToEdit,
  availableColumns = [],
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("filter_rows");
  const [params, setParams] = useState({});
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (stepToEdit) {
      setName(stepToEdit.name || "");
      setType(stepToEdit.type || "filter_rows");
      setParams(stepToEdit.params || {});
    } else {
      setName("New Transformation");
      setType("filter_rows");
      setParams({
        column: availableColumns[0] || "age",
        operator: ">",
        value: "18",
      });
    }
    setErrorMsg("");
  }, [stepToEdit, isOpen, availableColumns]);

  if (!isOpen) return null;

  const handleTypeChange = (newType) => {
    setType(newType);
    if (newType === "filter_rows") {
      setParams({ column: availableColumns[0] || "", operator: "=", value: "" });
    } else if (newType === "sort_rows") {
      setParams({ column: availableColumns[0] || "", ascending: true, nulls: "last" });
    } else if (newType === "select_columns") {
      setParams({ columns: availableColumns.slice(0, 3) });
    } else if (newType === "rename_column") {
      setParams({ old_name: availableColumns[0] || "", new_name: "" });
    } else if (newType === "drop_columns") {
      setParams({ columns: [availableColumns[0] || ""] });
    } else if (newType === "reorder_columns") {
      setParams({ columns: [...availableColumns] });
    } else if (newType === "remove_duplicates") {
      setParams({ subset: [availableColumns[0] || "email"], keep: "first" });
    } else if (newType === "type_conversion") {
      setParams({ column: availableColumns[0] || "", target_type: "integer", policy: "set_null" });
    } else if (newType === "derived_column") {
      setParams({ new_column: "calculated_col", operation: "uppercase", column: availableColumns[0] || "" });
    } else if (newType === "aggregation") {
      setParams({ group_by: [availableColumns[0] || "city"], agg_func: "count", value_column: availableColumns[1] || "id", output_name: "total_count" });
    } else {
      setParams({});
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMsg("Step name is required.");
      return;
    }
    onSave({
      id: stepToEdit?.id || `step_${Date.now()}`,
      name: name.trim(),
      type,
      params,
    });
    onClose();
  };

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div className="cleaned-customer-modal" style={{ width: "min(680px, 95%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="cleaned-customer-modal-header">
          <div>
            <h3>{stepToEdit ? "Edit Transformation Step" : "Add Transformation Step"}</h3>
            <p>Define transformation parameters and validation logic</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body">
          {errorMsg && (
            <div className="notification" style={{ background: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" }}>
              <CircleAlert size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pipeline-form-group">
            <label>Step Name</label>
            <input
              type="text"
              className="pipeline-form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Filter Adults, Drop Unused Columns"
            />
          </div>

          <div className="pipeline-form-group">
            <label>Transformation Type</label>
            <select
              className="pipeline-form-select"
              value={type}
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              {TRANSFORMATION_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} — {t.description}
                </option>
              ))}
            </select>
          </div>

          {/* TYPE-SPECIFIC CONFIGURATION */}
          {type === "filter_rows" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>Target Column</label>
                <select
                  className="pipeline-form-select"
                  value={params.column || ""}
                  onChange={(e) => setParams({ ...params, column: e.target.value })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Operator</label>
                <select
                  className="pipeline-form-select"
                  value={params.operator || "="}
                  onChange={(e) => setParams({ ...params, operator: e.target.value })}
                >
                  <option value="=">Equals (=)</option>
                  <option value="!=">Not Equals (!=)</option>
                  <option value=">">Greater Than (&gt;)</option>
                  <option value="<">Less Than (&lt;)</option>
                  <option value=">=">Greater Than or Equal (&gt;=)</option>
                  <option value="<=">Less Than or Equal (&lt;=)</option>
                  <option value="contains">Contains (text)</option>
                  <option value="is_null">Is Null / Empty</option>
                  <option value="is_not_null">Is Not Null</option>
                </select>
              </div>

              {!["is_null", "is_not_null"].includes(params.operator) && (
                <div className="pipeline-form-group">
                  <label>Comparison Value</label>
                  <input
                    type="text"
                    className="pipeline-form-input"
                    value={params.value ?? ""}
                    onChange={(e) => setParams({ ...params, value: e.target.value })}
                    placeholder="Value to compare"
                  />
                </div>
              )}
            </div>
          )}

          {type === "sort_rows" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>Sort Column</label>
                <select
                  className="pipeline-form-select"
                  value={params.column || ""}
                  onChange={(e) => setParams({ ...params, column: e.target.value })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Order</label>
                <select
                  className="pipeline-form-select"
                  value={params.ascending ? "asc" : "desc"}
                  onChange={(e) => setParams({ ...params, ascending: e.target.value === "asc" })}
                >
                  <option value="asc">Ascending (A-Z, 0-9)</option>
                  <option value="desc">Descending (Z-A, 9-0)</option>
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Null Handling</label>
                <select
                  className="pipeline-form-select"
                  value={params.nulls || "last"}
                  onChange={(e) => setParams({ ...params, nulls: e.target.value })}
                >
                  <option value="last">Nulls Last</option>
                  <option value="first">Nulls First</option>
                </select>
              </div>
            </div>
          )}

          {type === "select_columns" && (
            <div className="pipeline-form-group">
              <label>Columns to Retain (comma-separated)</label>
              <input
                type="text"
                className="pipeline-form-input"
                value={Array.isArray(params.columns) ? params.columns.join(", ") : (params.columns || "")}
                onChange={(e) => setParams({
                  ...params,
                  columns: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="id, name, email"
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Available: {availableColumns.join(", ")}
              </p>
            </div>
          )}

          {type === "rename_column" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>Current Column Name</label>
                <select
                  className="pipeline-form-select"
                  value={params.old_name || ""}
                  onChange={(e) => setParams({ ...params, old_name: e.target.value })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>New Column Name</label>
                <input
                  type="text"
                  className="pipeline-form-input"
                  value={params.new_name || ""}
                  onChange={(e) => setParams({ ...params, new_name: e.target.value.trim() })}
                  placeholder="e.g. customer_name"
                />
              </div>
            </div>
          )}

          {type === "drop_columns" && (
            <div className="pipeline-form-group">
              <label>Columns to Drop (comma-separated)</label>
              <input
                type="text"
                className="pipeline-form-input"
                value={Array.isArray(params.columns) ? params.columns.join(", ") : (params.columns || "")}
                onChange={(e) => setParams({
                  ...params,
                  columns: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g. temp_col, unused_id"
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Available: {availableColumns.join(", ")}
              </p>
            </div>
          )}

          {type === "reorder_columns" && (
            <div className="pipeline-form-group">
              <label>Output Columns in Desired Order (comma-separated)</label>
              <input
                type="text"
                className="pipeline-form-input"
                value={Array.isArray(params.columns) ? params.columns.join(", ") : (params.columns || "")}
                onChange={(e) => setParams({
                  ...params,
                  columns: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                })}
                placeholder="e.g. id, city, name, email, age"
              />
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b" }}>
                Available: {availableColumns.join(", ")}
              </p>
            </div>
          )}

          {type === "remove_duplicates" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>Key Column for Duplicate Check</label>
                <select
                  className="pipeline-form-select"
                  value={Array.isArray(params.subset) ? params.subset[0] : (params.subset || "")}
                  onChange={(e) => setParams({ ...params, subset: [e.target.value] })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Keep Policy</label>
                <select
                  className="pipeline-form-select"
                  value={params.keep || "first"}
                  onChange={(e) => setParams({ ...params, keep: e.target.value })}
                >
                  <option value="first">Keep First Occurrence</option>
                  <option value="last">Keep Last Occurrence</option>
                </select>
              </div>
            </div>
          )}

          {type === "type_conversion" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>Column</label>
                <select
                  className="pipeline-form-select"
                  value={params.column || ""}
                  onChange={(e) => setParams({ ...params, column: e.target.value })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Target Type</label>
                <select
                  className="pipeline-form-select"
                  value={params.target_type || "integer"}
                  onChange={(e) => setParams({ ...params, target_type: e.target.value })}
                >
                  <option value="integer">Integer</option>
                  <option value="decimal">Decimal / Float</option>
                  <option value="string">String / Text</option>
                  <option value="date">Date</option>
                  <option value="boolean">Boolean</option>
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Invalid Value Policy</label>
                <select
                  className="pipeline-form-select"
                  value={params.policy || "set_null"}
                  onChange={(e) => setParams({ ...params, policy: e.target.value })}
                >
                  <option value="set_null">Set to Null</option>
                  <option value="fail">Fail Pipeline</option>
                  <option value="reject_row">Reject Affected Row</option>
                </select>
              </div>
            </div>
          )}

          {type === "derived_column" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>New Column Name</label>
                <input
                  type="text"
                  className="pipeline-form-input"
                  value={params.new_column || ""}
                  onChange={(e) => setParams({ ...params, new_column: e.target.value })}
                  placeholder="e.g. full_identifier"
                />
              </div>

              <div className="pipeline-form-group">
                <label>Source Column</label>
                <select
                  className="pipeline-form-select"
                  value={params.column || ""}
                  onChange={(e) => setParams({ ...params, column: e.target.value })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Operation</label>
                <select
                  className="pipeline-form-select"
                  value={params.operation || "uppercase"}
                  onChange={(e) => setParams({ ...params, operation: e.target.value })}
                >
                  <option value="uppercase">Uppercase Text</option>
                  <option value="lowercase">Lowercase Text</option>
                  <option value="strip">Trim Whitespace</option>
                  <option value="arithmetic_add">Add Constant (+)</option>
                  <option value="arithmetic_mul">Multiply Constant (*)</option>
                </select>
              </div>

              {["arithmetic_add", "arithmetic_mul"].includes(params.operation) && (
                <div className="pipeline-form-group">
                  <label>Operand Value</label>
                  <input
                    type="number"
                    className="pipeline-form-input"
                    value={params.operand ?? 1}
                    onChange={(e) => setParams({ ...params, operand: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>
          )}

          {type === "aggregation" && (
            <div className="pipeline-config-grid">
              <div className="pipeline-form-group">
                <label>Group By Column</label>
                <select
                  className="pipeline-form-select"
                  value={Array.isArray(params.group_by) ? params.group_by[0] : (params.group_by || "")}
                  onChange={(e) => setParams({ ...params, group_by: [e.target.value] })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Function</label>
                <select
                  className="pipeline-form-select"
                  value={params.agg_func || "count"}
                  onChange={(e) => setParams({ ...params, agg_func: e.target.value })}
                >
                  <option value="count">Count</option>
                  <option value="sum">Sum</option>
                  <option value="mean">Average (Mean)</option>
                  <option value="min">Minimum</option>
                  <option value="max">Maximum</option>
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Metric Column</label>
                <select
                  className="pipeline-form-select"
                  value={params.value_column || ""}
                  onChange={(e) => setParams({ ...params, value_column: e.target.value })}
                >
                  {availableColumns.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="pipeline-form-group">
                <label>Result Column Name</label>
                <input
                  type="text"
                  className="pipeline-form-input"
                  value={params.output_name || ""}
                  onChange={(e) => setParams({ ...params, output_name: e.target.value })}
                  placeholder="e.g. record_count"
                />
              </div>
            </div>
          )}
        </div>

        <div className="pipeline-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="primary-button" onClick={handleSave}>
            <Check size={16} /> Save Step
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   STEP PREVIEW MODAL (STAGE 3)
========================================================= */

function StepPreviewModal({
  isOpen,
  onClose,
  step,
  previewData,
  isLoading,
}) {
  const [activeTab, setActiveTab] = useState("after");

  if (!isOpen) return null;

  const telemetry = previewData?.step_telemetry;
  const beforeData = previewData?.before;
  const afterData = previewData?.after;
  const displayRecords = activeTab === "after" ? afterData?.sample : beforeData?.sample;
  const displayCols = activeTab === "after" ? afterData?.columns : beforeData?.columns;

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div className="cleaned-customer-modal" style={{ width: "min(850px, 95%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="cleaned-customer-modal-header">
          <div>
            <h3>Step Preview: {step?.name || "Transformation"}</h3>
            <p>Live execution telemetry and sample record inspection</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body">
          {isLoading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>
              <div className="loading-spinner" style={{ margin: "0 auto 12px" }}></div>
              <p>Executing step transformation on dataset...</p>
            </div>
          ) : previewData ? (
            <>
              {/* TELEMETRY STATS */}
              <div className="pipeline-telemetry-grid">
                <div className="pipeline-telemetry-badge">
                  <span>Status</span>
                  <strong style={{ color: telemetry?.status === "success" ? "#16a34a" : "#ca8a04" }}>
                    {telemetry?.status?.toUpperCase() || "SUCCESS"}
                  </strong>
                </div>
                <div className="pipeline-telemetry-badge">
                  <span>Duration</span>
                  <strong>{telemetry?.duration_ms || 0} ms</strong>
                </div>
                <div className="pipeline-telemetry-badge">
                  <span>Rows In</span>
                  <strong>{telemetry?.rows_before ?? beforeData?.rows ?? 0}</strong>
                </div>
                <div className="pipeline-telemetry-badge">
                  <span>Rows Out</span>
                  <strong>{telemetry?.rows_after ?? afterData?.rows ?? 0}</strong>
                </div>
                <div className="pipeline-telemetry-badge">
                  <span>Row Delta</span>
                  <strong className={(telemetry?.row_delta || 0) < 0 ? "pipeline-delta-negative" : "pipeline-delta-positive"}>
                    {(telemetry?.row_delta || 0) > 0 ? `+${telemetry?.row_delta}` : telemetry?.row_delta || 0}
                  </strong>
                </div>
              </div>

              {telemetry?.warnings?.length > 0 && (
                <div className="notification" style={{ background: "#fefce8", color: "#854d0e", border: "1px solid #fef08a" }}>
                  <AlertTriangle size={16} />
                  <span>{telemetry.warnings.join("; ")}</span>
                </div>
              )}

              {/* TABS */}
              <div className="pipeline-preview-tabs">
                <button
                  type="button"
                  className={`pipeline-tab-btn ${activeTab === "after" ? "active" : ""}`}
                  onClick={() => setActiveTab("after")}
                >
                  Output After Step ({afterData?.rows ?? 0} rows)
                </button>
                <button
                  type="button"
                  className={`pipeline-tab-btn ${activeTab === "before" ? "active" : ""}`}
                  onClick={() => setActiveTab("before")}
                >
                  Input Before Step ({beforeData?.rows ?? 0} rows)
                </button>
              </div>

              {/* TABLE */}
              <div className="pipeline-preview-table-wrapper">
                {displayRecords && displayRecords.length > 0 ? (
                  <table className="cleaned-customer-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        {displayCols?.map((col) => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayRecords.slice(0, 10).map((row, idx) => (
                        <tr key={idx}>
                          {displayCols?.map((col) => (
                            <td key={col}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : "—"}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>No sample records available</p>
                )}
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>Preview could not be generated.</p>
          )}
        </div>

        <div className="pipeline-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Close Preview</button>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   PIPELINE EXECUTION RESULTS MODAL (STAGE 3)
========================================================= */

function PipelineExecutionModal({
  isOpen,
  onClose,
  executionResult,
  pipelineName,
}) {
  if (!isOpen || !executionResult) return null;

  const summary = executionResult.summary || {};
  const telemetry = executionResult.step_telemetry || [];
  const records = executionResult.records || [];
  const columns = executionResult.columns || (records[0] ? Object.keys(records[0]) : []);

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div className="cleaned-customer-modal" style={{ width: "min(900px, 95%)" }} onClick={(e) => e.stopPropagation()}>
        <div className="cleaned-customer-modal-header">
          <div>
            <h3>Workflow Execution: {pipelineName}</h3>
            <p>Run ID: {executionResult.run_id} • Execution Complete</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body">
          {/* SUMMARY GRID */}
          <div className="pipeline-telemetry-grid">
            <div className="pipeline-telemetry-badge">
              <span>Run Status</span>
              <strong style={{ color: executionResult.status === "success" ? "#16a34a" : "#dc2626" }}>
                {executionResult.status?.toUpperCase()}
              </strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Total Duration</span>
              <strong>{summary.total_duration_ms || 0} ms</strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Steps Executed</span>
              <strong>{summary.steps_executed} / {summary.total_steps}</strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Records Loaded</span>
              <strong style={{ color: "#2563eb" }}>{executionResult.records_loaded}</strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Final Rows</span>
              <strong>{summary.final_rows}</strong>
            </div>
          </div>

          {executionResult.destination_status && (
            <div className="notification" style={{ background: "#f0fdf4", color: "#166534", border: "1px solid #bbf7d0" }}>
              <CircleCheck size={16} />
              <span>{executionResult.destination_status}</span>
            </div>
          )}

          {/* STEP BY STEP TELEMETRY */}
          <h4 style={{ margin: "10px 0 6px", fontSize: "14px", fontWeight: "600", color: "#334155" }}>
            Step Execution Telemetry
          </h4>
          <div style={{ maxHeight: "200px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
            {telemetry.map((t, idx) => (
              <div key={idx} className="pipeline-step-telemetry-row">
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>#{idx + 1}</span>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>{t.step_name}</strong>
                    <span className="pipeline-step-badge" style={{ marginLeft: "8px" }}>{t.type}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px" }}>
                  <span>{t.duration_ms} ms</span>
                  <span>{t.rows_before} → {t.rows_after} rows</span>
                  <span className={t.row_delta < 0 ? "pipeline-delta-negative" : "pipeline-delta-positive"}>
                    {t.row_delta > 0 ? `+${t.row_delta}` : t.row_delta}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* SAMPLE OUTPUT */}
          <h4 style={{ margin: "14px 0 6px", fontSize: "14px", fontWeight: "600", color: "#334155" }}>
            Cleaned Output Sample ({records.length} records shown)
          </h4>
          <div className="pipeline-preview-table-wrapper">
            <table className="cleaned-customer-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  {columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.slice(0, 10).map((row, idx) => (
                  <tr key={idx}>
                    {columns.map((col) => (
                      <td key={col}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : "—"}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pipeline-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   INTERMEDIATE DATA PREVIEW PANEL (STAGE 4 - FEATURE 3)
========================================================= */

function IntermediatePreviewPanel({
  steps = [],
  records = null,
  activeStepIndex = 0,
  onSelectStepIndex,
}) {
  const [stepIndex, setStepIndex] = useState(activeStepIndex || 0);
  const [viewMode, setViewMode] = useState("output"); // 'output', 'input', 'schema', 'changes'
  const [rowLimit, setRowLimit] = useState(25);
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (activeStepIndex !== undefined && activeStepIndex !== null) {
      setStepIndex(activeStepIndex);
    }
  }, [activeStepIndex]);

  const currentStep = steps[stepIndex] || null;

  const loadPreview = async (idx, limit) => {
    if (!steps || steps.length === 0 || idx < 0 || idx >= steps.length) {
      setPreviewData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/pipelines/preview-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step_index: idx,
          steps,
          records,
          row_limit: limit,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.status === "failed") {
        setError(data.error || data.detail || "Transformation preview failed.");
      }
      setPreviewData(data);
    } catch (err) {
      console.error(err);
      setError("Network error fetching preview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (steps.length > 0) {
      const validIndex = Math.min(stepIndex, steps.length - 1);
      loadPreview(validIndex, rowLimit);
    } else {
      setPreviewData(null);
    }
  }, [stepIndex, steps, records, rowLimit]);

  const handleStepChange = (newIndex) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, newIndex));
    setStepIndex(clamped);
    if (onSelectStepIndex) onSelectStepIndex(clamped);
  };

  const handleDownloadPreview = () => {
    const recordsToExport = viewMode === "input" ? previewData?.before?.sample : previewData?.after?.sample;
    if (!recordsToExport || recordsToExport.length === 0) return;

    const headers = Object.keys(recordsToExport[0]);
    const csvRows = [
      headers.join(","),
      ...recordsToExport.map((row) =>
        headers.map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          return String(val).includes(",") ? `"${val}"` : String(val);
        }).join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `intermediate_step_${stepIndex + 1}_${viewMode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!steps || steps.length === 0) {
    return (
      <div className="panel">
        <PanelHeader
          title="Intermediate Data Preview"
          description="Step-by-step sample data, schema inspection, and transformation changes"
          icon={Eye}
        />
        <EmptyState
          icon={Sliders}
          title="No Steps to Preview"
          description="Add transformation steps above to preview intermediate dataset states."
        />
      </div>
    );
  }

  const before = previewData?.before || { rows: 0, columns: [], schema: [], sample: [] };
  const after = previewData?.after || { rows: 0, columns: [], schema: [], sample: [] };
  const changes = previewData?.changes || {};
  const currentSample = viewMode === "input" ? before.sample : after.sample;
  const currentCols = viewMode === "input" ? before.columns : after.columns;

  return (
    <div className="panel">
      <PanelHeader
        title="Intermediate Data Preview"
        description={`Step ${String(stepIndex + 1).padStart(2, "0")} of ${String(steps.length).padStart(2, "0")}: ${currentStep?.name || "Step"}`}
        icon={Eye}
      />

      {/* TOOLBAR */}
      <div className="pipeline-preview-toolbar">
        <div className="pipeline-preview-toolbar-left">
          <button
            type="button"
            className="secondary-button"
            style={{ padding: "6px 10px", fontSize: "12px" }}
            onClick={() => handleStepChange(stepIndex - 1)}
            disabled={stepIndex === 0}
            title="Previous Step"
          >
            <ChevronLeft size={14} /> Previous
          </button>

          <select
            className="pipeline-form-select"
            style={{ width: "auto", minWidth: "220px", padding: "6px 10px", fontSize: "12px" }}
            value={stepIndex}
            onChange={(e) => handleStepChange(Number(e.target.value))}
          >
            {steps.map((s, idx) => (
              <option key={s.id || idx} value={idx}>
                Step {String(idx + 1).padStart(2, "0")}: {s.name} ({s.type})
              </option>
            ))}
          </select>

          <button
            type="button"
            className="secondary-button"
            style={{ padding: "6px 10px", fontSize: "12px" }}
            onClick={() => handleStepChange(stepIndex + 1)}
            disabled={stepIndex === steps.length - 1}
            title="Next Step"
          >
            Next <ChevronRight size={14} />
          </button>

          <button
            type="button"
            className="secondary-button"
            style={{ padding: "6px 10px", fontSize: "12px" }}
            onClick={() => loadPreview(stepIndex, rowLimit)}
            disabled={loading}
            title="Refresh Preview"
          >
            <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
          </button>
        </div>

        <div className="pipeline-preview-toolbar-right">
          <select
            className="pipeline-form-select"
            style={{ width: "auto", padding: "6px 10px", fontSize: "12px" }}
            value={rowLimit}
            onChange={(e) => setRowLimit(Number(e.target.value))}
          >
            <option value={10}>10 sample rows</option>
            <option value={25}>25 sample rows</option>
            <option value={50}>50 sample rows</option>
          </select>

          <button
            type="button"
            className="secondary-button"
            style={{ padding: "6px 12px", fontSize: "12px" }}
            onClick={handleDownloadPreview}
            disabled={!currentSample || currentSample.length === 0}
            title="Download Preview as CSV"
          >
            <Download size={13} /> Download Preview
          </button>
        </div>
      </div>

      {/* TELEMETRY CARDS */}
      <div className="pipeline-telemetry-grid">
        <div className="pipeline-telemetry-badge">
          <span>Transformation</span>
          <strong style={{ fontSize: "14px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
            {currentStep?.name}
          </strong>
        </div>
        <div className="pipeline-telemetry-badge">
          <span>Execution Time</span>
          <strong>{previewData?.duration_ms || 0} ms</strong>
        </div>
        <div className="pipeline-telemetry-badge">
          <span>Input Shape</span>
          <strong>{previewData?.rows_before ?? before.rows} × {previewData?.cols_before_count ?? before.columns.length}</strong>
        </div>
        <div className="pipeline-telemetry-badge">
          <span>Output Shape</span>
          <strong>{previewData?.rows_after ?? after.rows} × {previewData?.cols_after_count ?? after.columns.length}</strong>
        </div>
        <div className="pipeline-telemetry-badge">
          <span>Row Variance</span>
          <strong className={(previewData?.row_delta || 0) < 0 ? "pipeline-delta-negative" : "pipeline-delta-positive"}>
            {(previewData?.row_delta || 0) > 0 ? `+${previewData?.row_delta}` : previewData?.row_delta || 0} rows
          </strong>
        </div>
      </div>

      {/* ERROR OR WARNING NOTIFICATION */}
      {error && (
        <div className="notification" style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", marginBottom: "16px" }}>
          <AlertTriangle size={16} />
          <span><strong>Preview Error:</strong> {error}</span>
        </div>
      )}

      {changes.warnings?.length > 0 && !error && (
        <div className="notification" style={{ background: "#fefce8", color: "#854d0e", border: "1px solid #fef08a", marginBottom: "16px" }}>
          <AlertTriangle size={16} />
          <span><strong>Warnings:</strong> {changes.warnings.join("; ")}</span>
        </div>
      )}

      {/* VIEW SELECTOR BUTTONS */}
      <div className="pipeline-preview-tabs">
        <button
          type="button"
          className={`pipeline-tab-btn ${viewMode === "output" ? "active" : ""}`}
          onClick={() => setViewMode("output")}
        >
          Show Output ({after.rows} rows)
        </button>
        <button
          type="button"
          className={`pipeline-tab-btn ${viewMode === "input" ? "active" : ""}`}
          onClick={() => setViewMode("input")}
        >
          Show Input ({before.rows} rows)
        </button>
        <button
          type="button"
          className={`pipeline-tab-btn ${viewMode === "schema" ? "active" : ""}`}
          onClick={() => setViewMode("schema")}
        >
          Show Schema ({after.columns.length} cols)
        </button>
        <button
          type="button"
          className={`pipeline-tab-btn ${viewMode === "changes" ? "active" : ""}`}
          onClick={() => setViewMode("changes")}
        >
          Show Changes
        </button>
      </div>

      {/* TAB CONTENT */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "30px" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 8px" }}></div>
          <p style={{ color: "#64748b", fontSize: "13px" }}>Computing intermediate preview...</p>
        </div>
      ) : (
        <>
          {/* 1. OUTPUT / INPUT TABLE VIEW */}
          {(viewMode === "output" || viewMode === "input") && (
            <div className="pipeline-preview-table-wrapper">
              {currentSample && currentSample.length > 0 ? (
                <table className="cleaned-customer-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      {currentCols.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSample.map((row, rIdx) => (
                      <tr key={rIdx}>
                        {currentCols.map((col) => {
                          const val = row[col];
                          const isNull = val === null || val === undefined || val === "";
                          return (
                            <td key={col}>
                              {isNull ? (
                                <span className="pipeline-null-badge">null</span>
                              ) : (
                                String(val)
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: "center", padding: "24px", color: "#64748b" }}>
                  No records to display for this view.
                </p>
              )}
            </div>
          )}

          {/* 2. SCHEMA VIEW */}
          {viewMode === "schema" && (
            <div className="pipeline-preview-table-wrapper">
              <table className="cleaned-customer-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Input Type</th>
                    <th>Output Type</th>
                    <th>Null Values</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {after.schema?.map((col) => {
                    const beforeMatch = before.schema?.find((b) => b.name === col.name);
                    const isNew = !beforeMatch;
                    const typeChanged = beforeMatch && beforeMatch.type !== col.type;
                    return (
                      <tr key={col.name}>
                        <td style={{ fontWeight: "600" }}>{col.name}</td>
                        <td>{beforeMatch ? beforeMatch.type : "—"}</td>
                        <td><span className="pipeline-tag-pill">{col.type}</span></td>
                        <td>{col.null_count > 0 ? `${col.null_count} nulls` : "0"}</td>
                        <td>
                          {isNew ? (
                            <span className="pipeline-tag-pill added">+ Added</span>
                          ) : typeChanged ? (
                            <span className="pipeline-tag-pill" style={{ background: "#fef3c7", color: "#b45309" }}>Cast</span>
                          ) : (
                            <span className="pipeline-tag-pill">Preserved</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {before.schema
                    ?.filter((b) => !after.columns.includes(b.name))
                    .map((dropped) => (
                      <tr key={`dropped_${dropped.name}`} style={{ opacity: 0.7 }}>
                        <td style={{ textDecoration: "line-through", color: "#b91c1c" }}>{dropped.name}</td>
                        <td>{dropped.type}</td>
                        <td>—</td>
                        <td>—</td>
                        <td><span className="pipeline-tag-pill dropped">Dropped</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 3. CHANGES DIFF VIEW */}
          {viewMode === "changes" && (
            <div className="pipeline-diff-card">
              <div className="pipeline-diff-section">
                <h5>Row Adjustments</h5>
                <p style={{ fontSize: "13px", color: "#475569", margin: "2px 0 0" }}>
                  Input Rows: <strong>{before.rows}</strong> → Output Rows: <strong>{after.rows}</strong> (
                  <span className={after.rows < before.rows ? "pipeline-delta-negative" : "pipeline-delta-positive"}>
                    {after.rows - before.rows < 0
                      ? `${before.rows - after.rows} rows removed`
                      : `${after.rows - before.rows} rows added`}
                  </span>
                  )
                </p>
              </div>

              <div className="pipeline-diff-section">
                <h5>Columns Added ({changes.added_columns?.length || 0})</h5>
                {changes.added_columns?.length > 0 ? (
                  <div className="pipeline-tag-list">
                    {changes.added_columns.map((c) => (
                      <span key={c} className="pipeline-tag-pill added">+ {c}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>No new columns added in this step</span>
                )}
              </div>

              <div className="pipeline-diff-section">
                <h5>Columns Dropped ({changes.dropped_columns?.length || 0})</h5>
                {changes.dropped_columns?.length > 0 ? (
                  <div className="pipeline-tag-list">
                    {changes.dropped_columns.map((c) => (
                      <span key={c} className="pipeline-tag-pill dropped">- {c}</span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>No columns dropped in this step</span>
                )}
              </div>

              {changes.type_changes?.length > 0 && (
                <div className="pipeline-diff-section">
                  <h5>Data Type Conversions</h5>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {changes.type_changes.map((tc, idx) => (
                      <div key={idx} style={{ fontSize: "12px", color: "#334155" }}>
                        Column <strong>{tc.column}</strong>: <code>{tc.from}</code> → <code>{tc.to}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {changes.conversion_failures?.length > 0 && (
                <div className="pipeline-diff-section">
                  <h5 style={{ color: "#b45309" }}>Conversion Notes & Failures</h5>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "20px", fontSize: "12px", color: "#b45309" }}>
                    {changes.conversion_failures.map((f, idx) => (
                      <li key={idx}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}


/* =========================================================
   PIPELINE WORKBENCH PAGE (STAGE 2)
========================================================= */

function PipelineWorkbenchPage({
  file,
  result,
  navigate,
}) {
  const [pipelineId, setPipelineId] = useState("");
  const [name, setName] = useState("Customer Ingestion & Quality Pipeline");
  const [description, setDescription] = useState("Standardize customer demographics, drop duplicates and load to PostgreSQL");
  const [inputSource, setInputSource] = useState("current_dataset");
  const [destination, setDestination] = useState({ type: "postgres", table: "customers" });
  const [errorPolicy, setErrorPolicy] = useState("stop_on_error");
  const [status, setStatus] = useState("draft");
  const [version, setVersion] = useState(1);
  const [steps, setSteps] = useState([
    {
      id: "step_1",
      name: "Deduplicate by Email",
      type: "remove_duplicates",
      params: { subset: ["email"], keep: "first" },
    },
    {
      id: "step_2",
      name: "Filter Valid Ages",
      type: "filter_rows",
      params: { column: "age", operator: ">=", value: "0" },
    },
    {
      id: "step_3",
      name: "Sort By City",
      type: "sort_rows",
      params: { column: "city", ascending: true, nulls: "last" },
    },
  ]);

  const [savedPipelines, setSavedPipelines] = useState([]);
  const [selectedSavedId, setSelectedSavedId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStepIndex, setEditingStepIndex] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [bannerMessage, setBannerMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // STAGE 3 & 4: Preview and Execution State
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewStep, setPreviewStep] = useState(null);
  const [stepPreviewData, setStepPreviewData] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [execModalOpen, setExecModalOpen] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const availableColumns = result?.records?.[0]
    ? Object.keys(result.records[0])
    : ["id", "name", "email", "age", "city"];

  const loadSavedPipelines = async () => {
    try {
      const res = await fetch(`${API_URL}/pipelines`);
      if (res.ok) {
        const data = await res.json();
        setSavedPipelines(data.pipelines || []);
      }
    } catch (err) {
      console.error("Failed to load pipelines:", err);
    }
  };

  useEffect(() => {
    loadSavedPipelines();
  }, []);

  const handleNewPipeline = () => {
    setPipelineId(`pl_${Date.now()}`);
    setName("New Draft Pipeline");
    setDescription("");
    setInputSource("current_dataset");
    setDestination({ type: "postgres", table: "customers" });
    setErrorPolicy("stop_on_error");
    setVersion(1);
    setStatus("draft");
    setSelectedSavedId("");
    setSteps([]);
    setValidationResult(null);
    setBannerMessage("Created new pipeline draft.");
  };

  const handleOpenSavedPipeline = async (pId) => {
    if (!pId) return;
    try {
      const res = await fetch(`${API_URL}/pipelines/${pId}`);
      if (res.ok) {
        const data = await res.json();
        const p = data.pipeline;
        setPipelineId(p.id);
        setName(p.name);
        setDescription(p.description || "");
        setInputSource(p.input_source?.type || "current_dataset");
        setDestination(p.destination || { type: "postgres", table: "customers" });
        setErrorPolicy(p.error_policy || "stop_on_error");
        setSteps(p.steps || []);
        setVersion(p.version || 1);
        setStatus("saved");
        setSelectedSavedId(p.id);
        setValidationResult(null);
        setBannerMessage(`Loaded pipeline '${p.name}'.`);
      }
    } catch (err) {
      console.error(err);
      setBannerMessage("Failed to load pipeline from database.");
    }
  };

  const handleAddStepClick = () => {
    setEditingStepIndex(null);
    setModalOpen(true);
  };

  const handleEditStepClick = (index) => {
    setEditingStepIndex(index);
    setModalOpen(true);
  };

  const handleSaveStep = (stepData) => {
    if (editingStepIndex !== null) {
      const updated = [...steps];
      updated[editingStepIndex] = stepData;
      setSteps(updated);
    } else {
      setSteps([...steps, stepData]);
    }
    setStatus("draft");
    setValidationResult(null);
  };

  const handleDuplicateStep = (index) => {
    const stepToCopy = steps[index];
    const copy = {
      ...stepToCopy,
      id: `step_${Date.now()}`,
      name: `${stepToCopy.name} (Copy)`,
    };
    const updated = [...steps];
    updated.splice(index + 1, 0, copy);
    setSteps(updated);
    setStatus("draft");
    setValidationResult(null);
  };

  const handleDeleteStep = (index) => {
    const stepName = steps[index].name;
    if (window.confirm(`Delete step "${stepName}"?`)) {
      const updated = steps.filter((_, i) => i !== index);
      setSteps(updated);
      setStatus("draft");
      setValidationResult(null);
    }
  };

  const handleMoveStep = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= steps.length) return;
    const updated = [...steps];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setSteps(updated);
    setStatus("draft");
    setValidationResult(null);
  };

  const handleValidatePipeline = async () => {
    setIsValidating(true);
    setBannerMessage("");
    try {
      const payload = {
        name,
        description,
        input_source: { type: inputSource },
        steps,
        destination,
        error_policy: errorPolicy,
      };

      const res = await fetch(`${API_URL}/pipelines/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      setValidationResult(data);
      if (data.valid) {
        setBannerMessage("Pipeline configuration is valid and ready for execution!");
      }
    } catch (err) {
      console.error(err);
      setBannerMessage("Validation request failed.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSavePipeline = async () => {
    setIsSaving(true);
    setBannerMessage("");
    try {
      const payload = {
        id: pipelineId || undefined,
        name,
        description,
        input_source: { type: inputSource },
        steps,
        destination,
        error_policy: errorPolicy,
        version,
        status: "saved",
      };

      const res = await fetch(`${API_URL}/pipelines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save pipeline to PostgreSQL.");

      const data = await res.json();
      setPipelineId(data.pipeline.id);
      setStatus("saved");
      setBannerMessage(data.message || "Pipeline saved to PostgreSQL.");
      loadSavedPipelines();
    } catch (err) {
      console.error(err);
      setBannerMessage(err.message || "Failed to save pipeline.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewStep = async (step) => {
    setPreviewStep(step);
    setPreviewModalOpen(true);
    setIsPreviewLoading(true);
    setStepPreviewData(null);
    try {
      const res = await fetch(`${API_URL}/pipelines/preview-step`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          records: result?.records || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setStepPreviewData(data);
      } else {
        const err = await res.json();
        setBannerMessage(`Preview error: ${err.detail || "Failed to preview step."}`);
      }
    } catch (err) {
      console.error(err);
      setBannerMessage("Step preview request failed.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handlePreviewPipelineFlow = async () => {
    if (steps.length === 0) return;
    setIsPreviewLoading(true);
    try {
      const res = await fetch(`${API_URL}/pipelines/preview-pipeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steps,
          records: result?.records || null,
          error_policy: errorPolicy,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const lastSnapshot = data.snapshots[data.snapshots.length - 1];
        setPreviewStep({ name: `Full Pipeline Flow (${data.snapshots.length} Steps)` });
        setStepPreviewData({
          step_telemetry: {
            status: data.status,
            duration_ms: data.snapshots.reduce((acc, s) => acc + (s.telemetry?.duration_ms || 0), 0),
            rows_before: data.initial_rows,
            rows_after: data.final_rows,
            row_delta: data.final_rows - data.initial_rows,
          },
          before: { rows: data.initial_rows, columns: data.initial_columns, sample: result?.records?.slice(0, 10) || [] },
          after: { rows: data.final_rows, columns: data.final_columns, sample: lastSnapshot?.sample || [] },
        });
        setPreviewModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setBannerMessage("Pipeline flow preview failed.");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleExecuteWorkflow = async () => {
    setIsExecuting(true);
    setBannerMessage("");
    try {
      const payload = {
        pipeline: {
          id: pipelineId || undefined,
          name,
          description,
          input_source: { type: inputSource },
          steps,
          destination,
          error_policy: errorPolicy,
          version,
          status: "saved",
        },
        records: result?.records || null,
      };

      const res = await fetch(`${API_URL}/pipelines/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Execution failed");
      }

      const data = await res.json();
      setExecutionResult(data);
      setExecModalOpen(true);
      setBannerMessage(data.destination_status || "Pipeline executed successfully.");
      loadSavedPipelines();
    } catch (err) {
      console.error(err);
      setBannerMessage(`Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="page-container">
      {/* STATS OVERVIEW */}
      <div className="stats">
        <StatCard
          label="PIPELINE"
          value={status === "saved" ? "Saved" : "Draft"}
          description={name || "Untitled"}
          icon={GitBranch}
        />
        <StatCard
          label="STEPS"
          value={steps.length}
          description="Transformations in sequence"
          icon={Sliders}
        />
        <StatCard
          label="DESTINATION"
          value={destination?.type === "postgres" ? "PostgreSQL" : "CSV Download"}
          description={destination?.table ? `Table: ${destination.table}` : "Direct export"}
          icon={Database}
        />
        <StatCard
          label="ERROR POLICY"
          value={errorPolicy === "stop_on_error" ? "Stop on Error" : "Continue"}
          description="Execution fault handling"
          icon={CheckCircle2}
        />
      </div>

      {bannerMessage && (
        <div className="notification">
          <CircleCheck size={17} />
          <span>{bannerMessage}</span>
        </div>
      )}

      {/* VALIDATION BANNER */}
      {validationResult && (
        <div className={`pipeline-validation-card ${validationResult.valid ? "valid" : "invalid"}`}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "600" }}>
            {validationResult.valid ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>
              {validationResult.valid
                ? "Configuration Valid: All step dependencies and column requirements are satisfied."
                : `Validation Issues Detected (${validationResult.errors.length} error${validationResult.errors.length > 1 ? "s" : ""}):`}
            </span>
          </div>
          {validationResult.errors?.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: "24px" }}>
              {validationResult.errors.map((e, idx) => (
                <li key={idx}>{e}</li>
              ))}
            </ul>
          )}
          {validationResult.warnings?.length > 0 && (
            <div style={{ marginTop: "4px", color: "#b45309" }}>
              <strong>Warnings: </strong>
              {validationResult.warnings.join("; ")}
            </div>
          )}
        </div>
      )}

      {/* PIPELINE CONFIGURATION PANEL */}
      <div className="panel">
        <PanelHeader
          title="Pipeline Workbench"
          description="Configure pipeline metadata, input source, and output destination"
          icon={GitBranch}
        />

        <div className="pipeline-config-grid">
          <div className="pipeline-form-group">
            <label>Pipeline Name</label>
            <input
              type="text"
              className="pipeline-form-input"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setStatus("draft");
              }}
              placeholder="e.g. Clean Customer Data"
            />
          </div>

          <div className="pipeline-form-group">
            <label>Description</label>
            <input
              type="text"
              className="pipeline-form-input"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setStatus("draft");
              }}
              placeholder="Optional pipeline purpose or workflow summary"
            />
          </div>

          <div className="pipeline-form-group">
            <label>Input Source</label>
            <select
              className="pipeline-form-select"
              value={inputSource}
              onChange={(e) => {
                setInputSource(e.target.value);
                setStatus("draft");
              }}
            >
              <option value="current_dataset">
                {file ? `Current Upload (${file.name})` : "Current Dataset"}
              </option>
              <option value="sample_csv">Sample customers.csv</option>
            </select>
          </div>

          <div className="pipeline-form-group">
            <label>Destination</label>
            <select
              className="pipeline-form-select"
              value={`${destination.type}:${destination.table || ""}`}
              onChange={(e) => {
                const [type, table] = e.target.value.split(":");
                setDestination({ type, table });
                setStatus("draft");
              }}
            >
              <option value="postgres:customers">PostgreSQL: customers table</option>
              <option value="postgres:pipeline_output">PostgreSQL: pipeline_output</option>
              <option value="csv:download">CSV File Download</option>
            </select>
          </div>

          <div className="pipeline-form-group">
            <label>Error Policy</label>
            <select
              className="pipeline-form-select"
              value={errorPolicy}
              onChange={(e) => {
                setErrorPolicy(e.target.value);
                setStatus("draft");
              }}
            >
              <option value="stop_on_error">Stop on First Error</option>
              <option value="continue_on_warning">Continue on Warning</option>
              <option value="skip_invalid">Skip Invalid Records</option>
            </select>
          </div>

          <div className="pipeline-form-group">
            <label>Load Saved Pipeline</label>
            <select
              className="pipeline-form-select"
              value={selectedSavedId}
              onChange={(e) => handleOpenSavedPipeline(e.target.value)}
            >
              <option value="">— Select Saved Pipeline —</option>
              {savedPipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.steps_count} steps)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pipeline-actions-bar">
          <div className="pipeline-actions-left">
            <button type="button" className="secondary-button" onClick={handleNewPipeline}>
              <Plus size={15} /> New Pipeline
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleValidatePipeline}
              disabled={isValidating}
            >
              <Check size={15} /> {isValidating ? "Validating..." : "Validate Pipeline"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviewPipelineFlow}
              disabled={isPreviewLoading || steps.length === 0}
            >
              <Eye size={15} /> Preview Flow
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleSavePipeline}
              disabled={isSaving}
            >
              <Database size={15} /> {isSaving ? "Saving..." : "Save Pipeline"}
            </button>
          </div>

          <div className="pipeline-actions-right">
            <button
              type="button"
              className="primary-button datamedic-load-mysql-button"
              onClick={handleExecuteWorkflow}
              disabled={isExecuting || steps.length === 0}
            >
              <Play size={15} /> {isExecuting ? "Executing..." : "Run Pipeline"}
            </button>
          </div>
        </div>
      </div>

      {/* PIPELINE STEPS LIST */}
      <div className="panel">
        <div className="panel-header chart-panel-header">
          <div>
            <h3>Transformation Steps</h3>
            <p>Execution order is sequential from top to bottom ({steps.length} configured)</p>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={handleAddStepClick}
          >
            <Plus size={15} /> Add Step
          </button>
        </div>

        {steps.length === 0 ? (
          <EmptyState
            icon={Sliders}
            title="No Transformation Steps"
            description="Add steps to filter, sort, transform, or aggregate your dataset records."
            buttonText="+ Add Step"
            onClick={handleAddStepClick}
          />
        ) : (
          <div className="pipeline-steps-container">
            {steps.map((step, index) => {
              const typeMeta = TRANSFORMATION_TYPES.find((t) => t.id === step.type);
              const summary = Object.entries(step.params || {})
                .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(",") : v}`)
                .join(" | ");

              return (
                <div key={step.id || index} className="pipeline-step-item">
                  <div className="pipeline-step-left">
                    <div className="pipeline-step-index">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="pipeline-step-meta">
                      <h4>
                        {step.name}
                        <span className="pipeline-step-badge">
                          {typeMeta?.label || step.type}
                        </span>
                      </h4>
                      <p>{summary || typeMeta?.description}</p>
                    </div>
                  </div>

                  <div className="pipeline-step-buttons">
                    <button
                      type="button"
                      className="pipeline-step-btn"
                      title="Preview Step Output"
                      onClick={() => {
                        setActiveStepIndex(index);
                        handlePreviewStep(step);
                      }}
                    >
                      <Eye size={15} />
                    </button>
                    <button
                      type="button"
                      className="pipeline-step-btn"
                      title="Move Up"
                      disabled={index === 0}
                      onClick={() => handleMoveStep(index, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      type="button"
                      className="pipeline-step-btn"
                      title="Move Down"
                      disabled={index === steps.length - 1}
                      onClick={() => handleMoveStep(index, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      type="button"
                      className="pipeline-step-btn"
                      title="Duplicate Step"
                      onClick={() => handleDuplicateStep(index)}
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      type="button"
                      className="pipeline-step-btn"
                      title="Edit Step"
                      onClick={() => handleEditStepClick(index)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      type="button"
                      className="pipeline-step-btn delete-btn"
                      title="Delete Step"
                      onClick={() => handleDeleteStep(index)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* INTERMEDIATE DATA PREVIEW PANEL (STAGE 4 - FEATURE 3) */}
      <IntermediatePreviewPanel
        steps={steps}
        records={result?.records}
        activeStepIndex={activeStepIndex}
        onSelectStepIndex={setActiveStepIndex}
      />

      {/* STEP CONFIGURATION MODAL */}
      <StepConfigModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveStep}
        stepToEdit={editingStepIndex !== null ? steps[editingStepIndex] : null}
        availableColumns={availableColumns}
      />

      {/* STEP PREVIEW MODAL (STAGE 3) */}
      <StepPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        step={previewStep}
        previewData={stepPreviewData}
        isLoading={isPreviewLoading}
      />

      {/* PIPELINE EXECUTION MODAL (STAGE 3) */}
      <PipelineExecutionModal
        isOpen={execModalOpen}
        onClose={() => setExecModalOpen(false)}
        executionResult={executionResult}
        pipelineName={name}
      />
    </div>
  );
}

/* =========================================================
   OVERVIEW PAGE
========================================================= */

function OverviewPage({
  result,
  navigate,
  analyzeFile,
  loading,
  downloadCleanedCSV,
  loadToPostgres,
}) {
  const report = result?.quality_report ?? result;
  const totalRecords = report?.total_records ?? "—";

  const qualityScore = report?.quality_score ?? "—";

  const missingValues = report?.missing_values ?? 0;

  const duplicateRecords = report?.duplicate_records ?? 0;

  const invalidAges = report?.invalid_age_records ?? 0;

  const invalidEmails = report?.invalid_email_records ?? 0;

    const issues =
      result
        ? missingValues + duplicateRecords + invalidAges + invalidEmails
        : "—";

  const cleanRecords = result
    ? result.cleaned_records ?? Math.max(totalRecords - duplicateRecords, 0)
    : "—";

  return (
    <div className="page-container">

      {/* METRICS */}

      <div className="stats">
        <StatCard
          label="TOTAL RECORDS"
          value={totalRecords}
          description="Records in dataset"
          icon={Database}
        />

        <StatCard
          label="QUALITY SCORE"
          value={`${qualityScore}%`}
          description="Overall data quality"
          icon={CheckCircle2}
        />

        <StatCard
          label="ISSUES DETECTED"
          value={issues}
          description="Quality issues found"
          icon={AlertTriangle}
        />

        <StatCard
          label="CLEAN RECORDS"
          value={cleanRecords}
          description="Records after cleaning"
          icon={FileCheck2}
        />
      </div>

      {/* QUICK ACTIONS */}

      <div className="panel quick-actions-panel">
        <PanelHeader
          title="Quick Actions"
          description="Work with your dataset"
          icon={Activity}
        />

        <div className="quick-actions">

          <QuickAction
            icon={UploadCloud}
            title="Upload Dataset"
            description="Select a CSV file"
            onClick={() => navigate("upload")}
            variant="upload"
          />

          <QuickAction
            icon={BarChart3}
            title="Analyze Dataset"
            description={loading ? "Analysis in progress" : "Run quality checks"}
            onClick={analyzeFile}
            variant="analyze"
          />

          <QuickAction
            icon={Download}
            title="Download Cleaned Data"
            description="Export the cleaned CSV"
            onClick={downloadCleanedCSV}
            variant="download"
          />

          <QuickAction
            icon={Database}
            title="Load to PostgreSQL"
            description="Send cleaned records to the database"
            onClick={loadToPostgres}
            variant="mysql"
          />

        </div>
      </div>

      {/* DATA QUALITY GRAPH */}

      <div className="panel chart-panel overview-quality-panel">
        <div className="panel-header chart-panel-header">
          <div>
            <h3>Data Quality Overview</h3>
            <p>Detected issues by category</p>
          </div>

           <button
      className="view-analytics-button"
      onClick={() => navigate("quality")}
    >
      View analytics
      <ArrowRight size={15} />
    </button>
        </div>

        {!result ? (
          <EmptyState
            icon={UploadCloud}
            title="No Dataset Analyzed"
            description="Upload and analyze a CSV dataset to see the quality graph."
            buttonText="Upload Dataset"
            onClick={() => navigate("upload")}
          />
        ) : (
          <QualityBarChart
            missingValues={missingValues}
            duplicateRecords={duplicateRecords}
            invalidAges={invalidAges}
            invalidEmails={invalidEmails}
          />
        )}
      </div>
    </div>
  );
}

/* =========================================================
   UPLOAD PAGE
========================================================= */

function UploadPage({
  file,
  handleFileChange,
  analyzeFile,
  loading,
  result,
}) {
  return (
    <div className="page-container">

      <div className="panel upload-panel">

        <PanelHeader
          title="Upload Dataset"
          description="Upload a CSV file to begin the data quality pipeline"
          icon={UploadCloud}
        />

        <label className="upload-box">

          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
          />

          <div className="upload-icon">
            <UploadCloud size={32} />
          </div>

          <h3>
            {file
              ? file.name
              : "Choose your CSV dataset"}
          </h3>

          <p>
            CSV files only · Upload your customer dataset
          </p>

          <span className="upload-button datamedic-upload-button">
            Browse CSV
          </span>

        </label>

        {file && (
          <div className="selected-file">
            <div>
              <FileCheck2 size={20} />

              <div>
                <strong>{file.name}</strong>
                <span>
                  {(file.size / 1024).toFixed(1)} KB
                </span>
              </div>
            </div>

            <CheckCircle2 size={20} />
          </div>
        )}

        <button
          className="primary-button datamedic-analyze-button"
          onClick={analyzeFile}
          disabled={!file || loading}
        >
          {loading ? (
            <>
              <RefreshCw
                size={17}
                className="spin"
              />
              Analyzing...
            </>
          ) : (
            <>
              <BarChart3 size={17} />
              Analyze Dataset
            </>
          )}
        </button>

      </div>

      {result && (
        <div className="panel">
          <PanelHeader
            title="Dataset Ready"
            description="Your dataset has already been analyzed"
            icon={CheckCircle2}
          />

          <div className="success-box">
            <CheckCircle2 size={22} />

            <div>
              <strong>
                Analysis completed successfully
              </strong>

              <p>
                You can now review the quality analysis,
                cleaned data, or ETL pipeline.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   QUALITY PAGE
========================================================= */

function QualityPage({ result, navigate }) {
  const [animatedQualityScore, setAnimatedQualityScore] = useState(0);

  const qualityScore = Number(
    result?.quality_report?.quality_score ??
    result?.quality_score ??
    0
  );

  useEffect(() => {
    if (!result) {
      setAnimatedQualityScore(0);
      return;
    }

    setAnimatedQualityScore(0);

    const duration = 1200;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const progress = Math.min(
        (currentTime - startTime) / duration,
        1
      );

      setAnimatedQualityScore(
        Math.round(progress * qualityScore)
      );

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [qualityScore, result]);

  if (!result) {
    return (
      <div className="page-container">
        <div className="panel">
          <EmptyState
            icon={BarChart3}
            title="No Dataset Analyzed"
            description="Upload and analyze a CSV dataset first."
            buttonText="Upload Dataset"
            onClick={() => navigate("upload")}
          />
        </div>
      </div>
    );
  }

  const report = result?.quality_report ?? result;
  const totalRecords = report?.total_records ?? 0;
  const missingValues = report?.missing_values ?? 0;
  const duplicateRecords = report?.duplicate_records ?? 0;
  const invalidAges = report?.invalid_age_records ?? 0;
  const invalidEmails = report?.invalid_email_records ?? 0;

  return (
    <div className="page-container">

      <div className="stats quality-stats">

        <StatCard
          label="TOTAL RECORDS"
          value={totalRecords}
          description="Records analyzed"
          icon={Database}
        />

        <StatCard
          label="MISSING VALUES"
          value={missingValues}
          description="Empty fields"
          icon={AlertTriangle}
        />

        <StatCard
          label="INVALID AGES"
          value={invalidAges}
          description="Invalid age values"
          icon={XCircle}
        />

        <StatCard
          label="DUPLICATE RECORDS"
          value={duplicateRecords}
          description="Duplicate email records"
          icon={Copy}
        />

        <StatCard
          label="QUALITY SCORE"
          value={`${qualityScore}%`}
          description="Overall dataset quality"
          icon={CheckCircle2}
        />

        <StatCard
          label="INVALID EMAILS"
          value={invalidEmails}
          description="Invalid email values"
          icon={XCircle}
        />

      </div>

      <div className="panel">

        <PanelHeader
          title="Data Quality Report"
          description="Detailed quality metrics from the current analysis"
          icon={BarChart3}
        />

        <div className="analysis-chart-wrap">
          <QualityBarChart
            missingValues={missingValues}
            duplicateRecords={duplicateRecords}
            invalidAges={invalidAges}
            invalidEmails={invalidEmails}
          />
        </div>

      </div>

      <div className="panel">

        <PanelHeader
          title="Quality Score"
          description="Overall assessment of the dataset"
          icon={CircleCheck}
        />

        <div className="score-section">

          <div className="score-number">
            {animatedQualityScore}%
          </div>

          <div className="score-track datamedic-score-track">
            <div
              className="score-fill datamedic-score-fill"
              style={{
                width: `${Math.min(
                  Math.max(animatedQualityScore, 0),
                  100
                )}%`,
              }}
            />
          </div>

          <p>
            The quality score is calculated from the
            detected data quality issues.
          </p>

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   CLEANED DATA
========================================================= */

function CleanedDataPage({
  result,
  downloadCleanedCSV,
  navigate,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  if (!result) {
    return (
      <div className="page-container">
        <div className="panel">
          <EmptyState
            icon={FileCheck2}
            title="No Cleaned Dataset"
            description="Upload and analyze a CSV file first."
            buttonText="Upload Dataset"
            onClick={() => navigate("upload")}
          />
        </div>
      </div>
    );
  }

  const report = result?.quality_report ?? result;

  const cleanedRecords =
    Number(result?.cleaned_records) || 0;

  const rows = Array.isArray(result?.cleaned_records_data)
    ? result.cleaned_records_data
    : [];

  const getValue = (row, keys) => {
    for (const key of keys) {
      if (
        row?.[key] !== undefined &&
        row?.[key] !== null &&
        row?.[key] !== ""
      ) {
        return row[key];
      }
    }

    return "";
  };

  const getCustomerId = (row) =>
    getValue(row, ["id", "customer_id", "customerId"]);

  const getCustomerName = (row) =>
    getValue(row, ["name", "customer_name", "customerName"]);

  const getCustomerAge = (row) =>
    getValue(row, ["age"]);

  const getCustomerCity = (row) =>
    getValue(row, ["city"]);

  const getCustomerEmail = (row) =>
    getValue(row, ["email"]);

  const cities = [
    "All Cities",
    ...Array.from(
      new Set(
        rows
          .map((row) => getCustomerCity(row))
          .filter(Boolean)
          .map((city) => String(city))
      )
    ),
  ];

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredRows = rows.filter((row) => {
    const id = String(getCustomerId(row)).toLowerCase();
    const name = String(getCustomerName(row)).toLowerCase();
    const email = String(getCustomerEmail(row)).toLowerCase();
    const city = String(getCustomerCity(row));

    const matchesSearch =
      !normalizedSearch ||
      id.includes(normalizedSearch) ||
      name.includes(normalizedSearch) ||
      email.includes(normalizedSearch);

    const matchesCity =
      selectedCity === "All Cities" ||
      city === selectedCity;

    return matchesSearch && matchesCity;
  });

  const recordsPerPage = 5;

  const totalPages = Math.max(
    Math.ceil(filteredRows.length / recordsPerPage),
    1
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const startIndex =
    (safeCurrentPage - 1) * recordsPerPage;

  const paginatedRows = filteredRows.slice(
    startIndex,
    startIndex + recordsPerPage
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCity("All Cities");
    setCurrentPage(1);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleCityChange = (event) => {
    setSelectedCity(event.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="page-container">

      {/* =====================================================
          STAT CARDS
      ===================================================== */}

      <div className="stats">

        <StatCard
          label="ORIGINAL RECORDS"
          value={report?.total_records ?? 0}
          description="Records before cleaning"
          icon={Database}
        />

        <StatCard
          label="CLEAN RECORDS"
          value={cleanedRecords}
          description="Records after cleaning"
          icon={FileCheck2}
        />

        <StatCard
          label="REMOVED"
          value={Math.max(
            (report?.total_records ?? 0) -
              cleanedRecords,
            0
          )}
          description="Records removed"
          icon={Trash2}
        />

        <StatCard
          label="QUALITY SCORE"
          value={`${report?.quality_score ?? 0}%`}
          description="Original dataset score"
          icon={CheckCircle2}
        />

      </div>

      {/* =====================================================
          SEARCH + FILTERS
      ===================================================== */}

      <div className="cleaned-directory-filters">

        <div className="cleaned-search-box">

          <Search size={16} />

          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by ID, name or email..."
          />

        </div>

        <select
          value={selectedCity}
          onChange={handleCityChange}
          className="cleaned-filter-select"
        >
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cleaned-clear-button"
          onClick={clearFilters}
        >
          Clear
        </button>

      </div>

      {/* =====================================================
          CUSTOMER DIRECTORY
      ===================================================== */}

      <div className="cleaned-customer-directory">

        <div className="cleaned-directory-title">

          <div>

            <h2>Customer Directory</h2>

            <p>
              Showing {paginatedRows.length} of{" "}
              {filteredRows.length} customers
            </p>

          </div>

          <div className="cleaned-page-indicator">
            Page {safeCurrentPage} / {totalPages}
          </div>

        </div>

        {paginatedRows.length > 0 ? (

          <div className="cleaned-table-wrapper">

            <table className="cleaned-customer-table">

              <thead>

                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Age</th>
                  <th>City</th>
                  <th>Email</th>
                  <th></th>
                </tr>

              </thead>

              <tbody>

                {paginatedRows.map((row, index) => {

                  const id = getCustomerId(row);
                  const name = getCustomerName(row);
                  const age = getCustomerAge(row);
                  const city = getCustomerCity(row);
                  const email = getCustomerEmail(row);

                  return (
                    <tr
                      key={`${id}-${index}`}
                    >

                      <td>
                        <strong className="cleaned-customer-id">
                          {id || "—"}
                        </strong>
                      </td>

                      <td>
                        <strong className="cleaned-customer-name">
                          {name || "—"}
                        </strong>
                      </td>

                      <td>
                        {age || "—"}
                      </td>

                      <td>
                        {city || "—"}
                      </td>

                      <td>
                        <span className="cleaned-customer-email">
                          {email || "—"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="cleaned-view-button"
                          onClick={() =>
                            setSelectedCustomer(row)
                          }
                        >
                          View
                        </button>
                      </td>

                    </tr>
                  );

                })}

              </tbody>

            </table>

          </div>

        ) : (

          <div className="cleaned-no-results">

            <FileCheck2 size={28} />

            <h3>No matching customers</h3>

            <p>
              Try changing your search or filters.
            </p>

          </div>

        )}

        {/* ===================================================
            PAGINATION
        =================================================== */}

        <div className="cleaned-pagination">

          <button
            type="button"
            disabled={safeCurrentPage === 1}
            onClick={() =>
              setCurrentPage(
                Math.max(safeCurrentPage - 1, 1)
              )
            }
          >
            ← Previous
          </button>

          <span>
            Page <strong>{safeCurrentPage}</strong> of{" "}
            <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            disabled={safeCurrentPage === totalPages}
            onClick={() =>
              setCurrentPage(
                Math.min(
                  safeCurrentPage + 1,
                  totalPages
                )
              )
            }
          >
            Next →
          </button>

        </div>

      </div>

      {/* =====================================================
          DOWNLOAD CSV
      ===================================================== */}

      <div className="cleaned-download-section">

        <button
          className="primary-button datamedic-download-button"
          onClick={downloadCleanedCSV}
        >
          Download CSV
        </button>

      </div>

      {/* =====================================================
          CUSTOMER DETAILS
      ===================================================== */}

      {selectedCustomer && (

        <div
          className="cleaned-customer-overlay"
          onClick={() => setSelectedCustomer(null)}
        >

          <div
            className="cleaned-customer-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="cleaned-customer-modal-header">

              <div>

                <h3>Customer Details</h3>

                <p>
                  {getCustomerName(selectedCustomer)}
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCustomer(null)
                }
              >
                ×
              </button>

            </div>

            <div className="cleaned-customer-details">

              <div>
                <span>ID</span>

                <strong>
                  {getCustomerId(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Name</span>

                <strong>
                  {getCustomerName(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Age</span>

                <strong>
                  {getCustomerAge(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>City</span>

                <strong>
                  {getCustomerCity(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Email</span>

                <strong>
                  {getCustomerEmail(selectedCustomer) || "—"}
                </strong>
              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}

/* =========================================================
   ETL PAGE
========================================================= */

function ETLPage({
  file,
  result,
  dbLoadResult,
  loadToPostgres,
}) {
  return (
    <div className="page-container">

      <div className="panel">

        <PanelHeader
          title="ETL Pipeline"
          description="Extract, transform, validate and load your data"
          icon={GitBranch}
        />

        <div className="pipeline">

          <PipelineStep
            number="01"
            title="CSV Input"
            description={
              file
                ? `CSV loaded: ${file.name}`
                : "Waiting for CSV dataset"
            }
            icon={UploadCloud}
            completed={Boolean(file)}
          />

          <div className="pipeline-line"></div>

          <PipelineStep
            number="02"
            title="Quality Analysis"
            description={
              result
                ? "Dataset analysis complete"
                : "Waiting for analysis"
            }
            icon={RefreshCw}
            completed={Boolean(result)}
          />

          <div className="pipeline-line"></div>

          <PipelineStep
            number="03"
            title="Data Cleaning"
            description={
              result
                ? "Cleaned dataset is available"
                : "Waiting for analysis"
            }
            icon={CheckCircle2}
            completed={Boolean(result)}
          />

          <div className="pipeline-line"></div>

          <PipelineStep
            number="04"
            title="PostgreSQL Load"
            description={
              dbLoadResult?.status === "success"
                ? "Load completed"
                : "Not loaded"
            }
            icon={Database}
            completed={
              dbLoadResult?.status === "success"
            }
          />

        </div>

        <button
          className="primary-button datamedic-load-mysql-button"
          onClick={loadToPostgres}
          disabled={!file}
        >
          <Database size={17} />
          Load to PostgreSQL
        </button>

      </div>

    </div>
  );
}

/* =========================================================
   DATASET RECORDS
========================================================= */

function DatasetRecordsPage({ result }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  if (!result) {
    return (
      <div className="page-container">
        <div className="panel">
          <EmptyState
            icon={Database}
            title="No Dataset Available"
            description="Upload and analyze a CSV dataset to view records."
          />
        </div>
      </div>
    );
  }

  const rows = Array.isArray(result?.records)
    ? result.records
    : [];

  const getValue = (row, keys) => {
    for (const key of keys) {
      if (
        row?.[key] !== undefined &&
        row?.[key] !== null &&
        row?.[key] !== ""
      ) {
        return row[key];
      }
    }

    return "";
  };

  const getCustomerId = (row) =>
    getValue(row, ["id", "customer_id", "customerId"]);

  const getCustomerName = (row) =>
    getValue(row, ["name", "customer_name", "customerName"]);

  const getCustomerAge = (row) =>
    getValue(row, ["age"]);

  const getCustomerCity = (row) =>
    getValue(row, ["city"]);

  const getCustomerEmail = (row) =>
    getValue(row, ["email"]);

  const cities = [
    "All Cities",
    ...Array.from(
      new Set(
        rows
          .map((row) => getCustomerCity(row))
          .filter(Boolean)
          .map((city) => String(city))
      )
    ),
  ];

  const normalizedSearch =
    searchTerm.trim().toLowerCase();

  const filteredRows = rows.filter((row) => {
    const id = String(getCustomerId(row)).toLowerCase();
    const name = String(getCustomerName(row)).toLowerCase();
    const email = String(getCustomerEmail(row)).toLowerCase();
    const city = String(getCustomerCity(row));

    const matchesSearch =
      !normalizedSearch ||
      id.includes(normalizedSearch) ||
      name.includes(normalizedSearch) ||
      email.includes(normalizedSearch);

    const matchesCity =
      selectedCity === "All Cities" ||
      city === selectedCity;

    return matchesSearch && matchesCity;
  });

  const recordsPerPage = 5;

  const totalPages = Math.max(
    Math.ceil(filteredRows.length / recordsPerPage),
    1
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const startIndex =
    (safeCurrentPage - 1) * recordsPerPage;

  const paginatedRows = filteredRows.slice(
    startIndex,
    startIndex + recordsPerPage
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCity("All Cities");
    setCurrentPage(1);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleCityChange = (event) => {
    setSelectedCity(event.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="page-container">

      {/* =====================================================
          SEARCH + FILTERS
      ===================================================== */}

      <div className="cleaned-directory-filters">

        <div className="cleaned-search-box">

          <Search size={16} />

          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by ID, name or email..."
          />

        </div>

        <select
          value={selectedCity}
          onChange={handleCityChange}
          className="cleaned-filter-select"
        >
          {cities.map((city) => (
            <option
              key={city}
              value={city}
            >
              {city}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cleaned-clear-button"
          onClick={clearFilters}
        >
          Clear
        </button>

      </div>

      {/* =====================================================
          DATASET DIRECTORY
      ===================================================== */}

      <div className="cleaned-customer-directory">

        <div className="cleaned-directory-title">

          <div>

            <h2>Dataset Records</h2>

            <p>
              Showing {paginatedRows.length} of{" "}
              {filteredRows.length} records
            </p>

          </div>

          <div className="cleaned-page-indicator">
            Page {safeCurrentPage} / {totalPages}
          </div>

        </div>

        {paginatedRows.length > 0 ? (

          <div className="cleaned-table-wrapper">

            <table className="cleaned-customer-table">

              <thead>

                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Age</th>
                  <th>City</th>
                  <th>Email</th>
                  <th></th>
                </tr>

              </thead>

              <tbody>

                {paginatedRows.map((row, index) => {

                  const id = getCustomerId(row);
                  const name = getCustomerName(row);
                  const age = getCustomerAge(row);
                  const city = getCustomerCity(row);
                  const email = getCustomerEmail(row);

                  return (
                    <tr
                      key={`${id}-${index}`}
                    >

                      <td>
                        <strong className="cleaned-customer-id">
                          {id || "—"}
                        </strong>
                      </td>

                      <td>
                        <strong className="cleaned-customer-name">
                          {name || "—"}
                        </strong>
                      </td>

                      <td>
                        {age || "—"}
                      </td>

                      <td>
                        {city || "—"}
                      </td>

                      <td>
                        <span className="cleaned-customer-email">
                          {email || "—"}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          className="cleaned-view-button"
                          onClick={() =>
                            setSelectedCustomer(row)
                          }
                        >
                          View
                        </button>
                      </td>

                    </tr>
                  );

                })}

              </tbody>

            </table>

          </div>

        ) : (

          <div className="cleaned-no-results">

            <FileCheck2 size={28} />

            <h3>
              {searchTerm || selectedCity !== "All Cities"
                ? "No matching records"
                : "No records available"}
            </h3>

            <p>
              {searchTerm || selectedCity !== "All Cities"
                ? "Try changing your search or filters."
                : "Analyze a dataset to populate the records table."}
            </p>

          </div>

        )}

        {/* ===================================================
            PAGINATION
        =================================================== */}

        <div className="cleaned-pagination">

          <button
            type="button"
            disabled={safeCurrentPage === 1}
            onClick={() =>
              setCurrentPage(
                Math.max(safeCurrentPage - 1, 1)
              )
            }
          >
            ← Previous
          </button>

          <span>
            Page <strong>{safeCurrentPage}</strong> of{" "}
            <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            disabled={safeCurrentPage === totalPages}
            onClick={() =>
              setCurrentPage(
                Math.min(
                  safeCurrentPage + 1,
                  totalPages
                )
              )
            }
          >
            Next →
          </button>

        </div>

      </div>

      {/* =====================================================
          CUSTOMER DETAILS
      ===================================================== */}

      {selectedCustomer && (

        <div
          className="cleaned-customer-overlay"
          onClick={() =>
            setSelectedCustomer(null)
          }
        >

          <div
            className="cleaned-customer-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="cleaned-customer-modal-header">

              <div>

                <h3>Customer Details</h3>

                <p>
                  {getCustomerName(selectedCustomer)}
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCustomer(null)
                }
              >
                ×
              </button>

            </div>

            <div className="cleaned-customer-details">

              <div>
                <span>ID</span>

                <strong>
                  {getCustomerId(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Name</span>

                <strong>
                  {getCustomerName(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Age</span>

                <strong>
                  {getCustomerAge(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>City</span>

                <strong>
                  {getCustomerCity(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Email</span>

                <strong>
                  {getCustomerEmail(selectedCustomer) || "—"}
                </strong>
              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
/* =========================================================
   POSTGRESQL PAGE
========================================================= */

function PostgreSQLPage({
  result,
  file,
  dbLoadResult,
  loadToPostgres,
}) {
  const databaseReport = dbLoadResult?.quality_report;

  const databaseRows =
  Array.isArray(result?.cleaned_records_data)
    ? result.cleaned_records_data
    : [];

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCity, setSelectedCity] = useState("All Cities");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dbStatus, setDbStatus] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/db/status`)
      .then((res) => res.json())
      .then((data) => setDbStatus(data))
      .catch(() => {});
  }, [dbLoadResult]);

  const getValue = (row, keys) => {
    for (const key of keys) {
      if (
        row?.[key] !== undefined &&
        row?.[key] !== null &&
        row?.[key] !== ""
      ) {
        return row[key];
      }
    }

    return "";
  };

  const getCustomerId = (row) =>
    getValue(row, ["id", "customer_id", "customerId"]);

  const getCustomerName = (row) =>
    getValue(row, ["name", "customer_name", "customerName"]);

  const getCustomerAge = (row) =>
    getValue(row, ["age"]);

  const getCustomerCity = (row) =>
    getValue(row, ["city"]);

  const getCustomerEmail = (row) =>
    getValue(row, ["email"]);

  const cities = [
    "All Cities",
    ...Array.from(
      new Set(
        databaseRows
          .map((row) => getCustomerCity(row))
          .filter(Boolean)
          .map((city) => String(city))
      )
    ),
  ];

  const normalizedSearch =
    searchTerm.trim().toLowerCase();

  const filteredRows = databaseRows.filter((row) => {
    const id = String(getCustomerId(row)).toLowerCase();
    const name = String(getCustomerName(row)).toLowerCase();
    const email = String(getCustomerEmail(row)).toLowerCase();
    const city = String(getCustomerCity(row));

    const matchesSearch =
      !normalizedSearch ||
      id.includes(normalizedSearch) ||
      name.includes(normalizedSearch) ||
      email.includes(normalizedSearch);

    const matchesCity =
      selectedCity === "All Cities" ||
      city === selectedCity;

    return matchesSearch && matchesCity;
  });

  const recordsPerPage = 5;

  const totalPages = Math.max(
    Math.ceil(filteredRows.length / recordsPerPage),
    1
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages
  );

  const startIndex =
    (safeCurrentPage - 1) * recordsPerPage;

  const paginatedRows = filteredRows.slice(
    startIndex,
    startIndex + recordsPerPage
  );

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedCity("All Cities");
    setCurrentPage(1);
  };

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1);
  };

  const handleCityChange = (event) => {
    setSelectedCity(event.target.value);
    setCurrentPage(1);
  };

  const isConnected =
    dbLoadResult?.status === "success" ||
    dbStatus?.status === "connected";

  return (
    <div className="page-container">

      <div className="stats">

        <StatCard
          label="DATABASE"
          value="PostgreSQL"
          description="Relational database"
          icon={Database}
        />

        <StatCard
          label="STATUS"
          value={isConnected ? "Connected" : "Unverified"}
          description={isConnected ? "Connected & verified" : "Check credentials in .env"}
          icon={CircleCheck}
        />

        <StatCard
          label="RECORDS"
          value={dbLoadResult?.records_loaded ?? "—"}
          description="Records reported as loaded"
          icon={Server}
        />

        <StatCard
          label="PIPELINE"
          value="ETL"
          description="Load destination"
          icon={GitBranch}
        />

      </div>

      {/* =====================================================
          POSTGRESQL DATABASE
      ===================================================== */}

      <div className="panel">

        <PanelHeader
          title="PostgreSQL Database"
          description="Load the cleaned dataset into PostgreSQL"
          icon={Database}
        />

        <div className="database-card">

          <div className="database-icon datamedic-mysql-icon">
            <Database size={30} />
          </div>

          <div className="database-info">

            <h3>PostgreSQL Database</h3>

            <p>
              {dbLoadResult?.status === "success"
                ? dbLoadResult.message ||
                  "The load endpoint confirmed a successful database load."
                : dbStatus?.status === "connected"
                ? `Connected to database '${dbStatus.database}' at ${dbStatus.host}:${dbStatus.port}. Ready to load records.`
                : "Database connectivity has not been verified in this session. Configure .env and load a dataset to verify."}
            </p>

            <div className="database-tags">

              <span>PostgreSQL</span>

              <span>
                {file?.name || "No dataset selected"}
              </span>

              <span>
                {databaseReport?.total_records ?? "—"} analyzed rows
              </span>

            </div>

          </div>

          <button
            className="primary-button datamedic-mysql-load-button"
            onClick={loadToPostgres}
            disabled={!file}
          >
            Load Data
          </button>

        </div>

      </div>

      {/* =====================================================
          DATABASE RECORDS
      ===================================================== */}

      <div className="cleaned-directory-filters">

        <div className="cleaned-search-box">

          <Search size={16} />

          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search by ID, name or email..."
          />

        </div>

        <select
          value={selectedCity}
          onChange={handleCityChange}
          className="cleaned-filter-select"
        >
          {cities.map((city) => (
            <option
              key={city}
              value={city}
            >
              {city}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="cleaned-clear-button"
          onClick={clearFilters}
        >
          Clear
        </button>

      </div>

      <div className="cleaned-customer-directory">

        <div className="cleaned-directory-title">

          <div>

            <h2>Database Records</h2>

            <p>
              Showing {paginatedRows.length} of{" "}
              {filteredRows.length} records
            </p>

          </div>

          <div className="cleaned-page-indicator">
            Page {safeCurrentPage} / {totalPages}
          </div>

        </div>

        {paginatedRows.length > 0 ? (

          <div className="cleaned-table-wrapper">

            <table className="cleaned-customer-table">

              <thead>

                <tr>
                  <th>ID</th>
                  <th>Customer</th>
                  <th>Age</th>
                  <th>City</th>
                  <th>Email</th>
                  <th></th>
                </tr>

              </thead>

              <tbody>

                {paginatedRows.map((row, index) => {

                  const id = getCustomerId(row);
                  const name = getCustomerName(row);
                  const age = getCustomerAge(row);
                  const city = getCustomerCity(row);
                  const email = getCustomerEmail(row);

                  return (
                    <tr
                      key={`${id}-${index}`}
                    >

                      <td>
                        <strong className="cleaned-customer-id">
                          {id || "—"}
                        </strong>
                      </td>

                      <td>
                        <strong className="cleaned-customer-name">
                          {name || "—"}
                        </strong>
                      </td>

                      <td>
                        {age || "—"}
                      </td>

                      <td>
                        {city || "—"}
                      </td>

                      <td>
                        <span className="cleaned-customer-email">
                          {email || "—"}
                        </span>
                      </td>

                      <td>

                        <button
                          type="button"
                          className="cleaned-view-button"
                          onClick={() =>
                            setSelectedCustomer(row)
                          }
                        >
                          View
                        </button>

                      </td>

                    </tr>
                  );

                })}

              </tbody>

            </table>

          </div>

        ) : (

          <div className="cleaned-no-results">

            <Database size={28} />

            <h3>
              {searchTerm ||
              selectedCity !== "All Cities"
                ? "No matching records"
                : "No database records available"}
            </h3>

            <p>
              {searchTerm ||
              selectedCity !== "All Cities"
                ? "Try changing your search or filters."
                : "Analyze and load a dataset to populate the database records."}
            </p>

          </div>

        )}

        {/* ===================================================
            PAGINATION
        =================================================== */}

        <div className="cleaned-pagination">

          <button
            type="button"
            disabled={safeCurrentPage === 1}
            onClick={() =>
              setCurrentPage(
                Math.max(safeCurrentPage - 1, 1)
              )
            }
          >
            ← Previous
          </button>

          <span>
            Page <strong>{safeCurrentPage}</strong> of{" "}
            <strong>{totalPages}</strong>
          </span>

          <button
            type="button"
            disabled={safeCurrentPage === totalPages}
            onClick={() =>
              setCurrentPage(
                Math.min(
                  safeCurrentPage + 1,
                  totalPages
                )
              )
            }
          >
            Next →
          </button>

        </div>

      </div>

      {/* =====================================================
          CUSTOMER DETAILS
      ===================================================== */}

      {selectedCustomer && (

        <div
          className="cleaned-customer-overlay"
          onClick={() =>
            setSelectedCustomer(null)
          }
        >

          <div
            className="cleaned-customer-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            <div className="cleaned-customer-modal-header">

              <div>

                <h3>Customer Details</h3>

                <p>
                  {getCustomerName(selectedCustomer)}
                </p>

              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCustomer(null)
                }
              >
                ×
              </button>

            </div>

            <div className="cleaned-customer-details">

              <div>
                <span>ID</span>

                <strong>
                  {getCustomerId(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Name</span>

                <strong>
                  {getCustomerName(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Age</span>

                <strong>
                  {getCustomerAge(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>City</span>

                <strong>
                  {getCustomerCity(selectedCustomer) || "—"}
                </strong>
              </div>

              <div>
                <span>Email</span>

                <strong>
                  {getCustomerEmail(selectedCustomer) || "—"}
                </strong>
              </div>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}
/* =========================================================
   API STATUS
========================================================= */

function APIStatusPage({ dbConnected }) {
  const [apiStatus, setApiStatus] = useState("checking");
  const [dbStatus, setDbStatus] = useState(null);

  const checkAPI = async () => {
    setApiStatus("checking");

    try {
      const response = await fetch(`${API_URL}/`);
      setApiStatus(response.ok ? "healthy" : "error");

      const dbRes = await fetch(`${API_URL}/db/status`);
      if (dbRes.ok) {
        const data = await dbRes.json();
        setDbStatus(data);
      }
    } catch {
      setApiStatus("error");
    }
  };

  useEffect(() => {
    checkAPI();
  }, []);

  const isPostgresHealthy =
    dbConnected || dbStatus?.status === "connected";

  return (
    <div className="page-container">

      <div className="system-status-grid">

        <StatusCard
          label="API STATUS"
          value={
            apiStatus === "healthy"
              ? "connected"
              : apiStatus === "error"
              ? "offline"
              : "checking"
          }
          icon={Activity}
          status={apiStatus}
        />

        <StatusCard
          label="POSTGRESQL"
          value={isPostgresHealthy ? "connected" : "not verified"}
          icon={Database}
          status={isPostgresHealthy ? "healthy" : "unknown"}
        />

      </div>

      <div className="panel">

        <PanelHeader
          title="Backend Information"
          description="FlowForge service configuration"
          icon={Server}
        />

        <div className="info-list">

          <InfoRow
            label="API Base URL"
            value={API_URL}
          />

          <InfoRow
            label="Platform"
            value="FlowForge ETL"
          />

          <InfoRow
            label="Backend"
            value="FastAPI"
          />

          <InfoRow
            label="Database"
            value="PostgreSQL"
          />

          <InfoRow
            label="Data Processing"
            value="Python + Pandas"
          />

        </div>

        <button
          className="secondary-button"
          onClick={checkAPI}
        >
          <RefreshCw size={15} />
          Check API Again
        </button>

      </div>
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function StatCard({
  label,
  value,
  description,
  icon: Icon,
}) {
  return (
    <div className="stat-card">

      <div className="stat-icon">
        <Icon size={19} />
      </div>

      <div className="stat-content">

        <span className="stat-label">
          {label}
        </span>

        <strong>{value}</strong>

        <p>{description}</p>

      </div>
    </div>
  );
}

function PanelHeader({
  title,
  description,
  icon: Icon,
}) {
  return (
    <div className="panel-header">

      <div>
        <h3>{title}</h3>

        {description && (
          <p>{description}</p>
        )}
      </div>

      {Icon && (
        <div className="panel-header-icon">
          <Icon size={18} />
        </div>
      )}

    </div>
  );
}

function QualityRow({
  label,
  value,
  type,
}) {
  return (
    <div className="quality-row">

      <div className="quality-row-left">

        {type === "success" ? (
          <CheckCircle2 size={18} />
        ) : type === "danger" ? (
          <XCircle size={18} />
        ) : (
          <AlertTriangle size={18} />
        )}

        <span>{label}</span>

      </div>

      <strong className={`quality-value ${type}`}>
        {value}
      </strong>

    </div>
  );
}

function QuickAction({
  icon: Icon,
  title,
  description,
  onClick,
  variant,
}) {
  return (
    <button
      className={`quick-action quick-action--${variant}`}
      onClick={onClick}
    >
      <div className="quick-action-icon">
        <Icon size={17} />
      </div>

      <div className="quick-action-content">
        <strong>{title}</strong>
        <span>{description}</span>
      </div>

      <ArrowRight size={16} className="quick-action-arrow" />
    </button>
  );
}

function IssueCard({
  icon: Icon,
  title,
  value,
  description,
  type,
}) {
  return (
    <div className={`issue-card ${type}`}>

      <div className="issue-icon">
        <Icon size={19} />
      </div>

      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <p>{description}</p>
      </div>

    </div>
  );
}

function AnalysisRow({
  label,
  value,
  status,
  good,
}) {
  return (
    <div className="analysis-row">

      <div>
        <strong>{label}</strong>
        <span>{status}</span>
      </div>

      <div className={good ? "analysis-good" : ""}>
        {value}
      </div>

    </div>
  );
}

function PipelineStep({
  number,
  title,
  description,
  icon: Icon,
  completed,
}) {
  return (
    <div className="pipeline-step">

      <div
        className={`pipeline-number ${
          completed ? "completed" : ""
        }`}
      >
        {completed ? (
          <CheckCircle2 size={20} />
        ) : (
          number
        )}
      </div>

      <div className="pipeline-icon">
        <Icon size={20} />
      </div>

      <div className="pipeline-content">

        <strong>{title}</strong>

        <span>{description}</span>

      </div>

    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  buttonText,
  onClick,
}) {
  return (
    <div className="empty-state">

      <div className="empty-icon">
        <Icon size={28} />
      </div>

      <h3>{title}</h3>

      <p>{description}</p>

      {buttonText && (
        <button
          className="secondary-button"
          onClick={onClick}
        >
          {buttonText}
          <ArrowRight size={15} className="overview-upload-arrow" />
        </button>
      )}

    </div>
  );
}

function StatusCard({
  label,
  value,
  icon: Icon,
  status,
}) {
  return (
    <div className={`status-card ${status}`}>

      <div className="status-card-icon">
        <Icon size={19} />
      </div>

      <div>
        <span>{label}</span>

        <strong className={`status-${status}`}>
          {value}
        </strong>
      </div>

    </div>
  );
}
function RecordsTable({ rows }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td key={column}>
                  {row[column] === null ||
                  row[column] === undefined ||
                  row[column] === ""
                    ? "—"
                    : String(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function InfoRow({
  label,
  value,
}) {
  return (
    <div className="info-row">

      <span>{label}</span>

      <strong>{value}</strong>

    </div>
  );
}

export default App;