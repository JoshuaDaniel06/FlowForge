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
  Folder,
  GitCompare,
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
        id: "saved-pipelines",
        label: "Saved Pipelines",
        icon: Sliders,
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
        label: "Data Sources",
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
  const [workbenchPipelineId, setWorkbenchPipelineId] = useState(null);

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
      "saved-pipelines": {
        title: "Saved Pipelines",
        subtitle: "Manage, version, duplicate, and restore ETL data pipelines",
      },
      postgres: {
        title: "Data Sources",
        subtitle: "Inspect PostgreSQL connection status, metadata, and browse relational tables",
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
            initialPipelineId={workbenchPipelineId}
            onPipelineLoaded={() => setWorkbenchPipelineId(null)}
            onBrowsePipelines={() => setActivePage("saved-pipelines")}
          />
        )}

        {activePage === "saved-pipelines" && (
          <SavedPipelinesPage
            onOpenPipeline={(pId) => {
              setWorkbenchPipelineId(pId);
              setActivePage("workbench");
            }}
            onNewPipeline={() => {
              setWorkbenchPipelineId("NEW");
              setActivePage("workbench");
            }}
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
   TABLE PREVIEW MODAL (STAGE 6 - FEATURE 5)
========================================================= */

function TablePreviewModal({ isOpen, onClose, tableName, schema = "public" }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && tableName) {
      setLoading(true);
      setError(null);
      fetch(`${API_URL}/db/tables/${tableName}/preview?schema=${schema}&limit=50`)
        .then((res) => {
          if (!res.ok) throw new Error(`Could not load preview for table '${tableName}'`);
          return res.json();
        })
        .then((resData) => {
          setData(resData.preview);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [isOpen, tableName, schema]);

  if (!isOpen) return null;

  const records = data?.records || [];
  const columns = data?.columns || [];

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ width: "min(960px, 95%)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cleaned-customer-modal-header">
          <div>
            <h3>PostgreSQL Table Preview: {schema}.{tableName}</h3>
            <p style={{ marginTop: "2px" }}>
              {data ? `${data.total_rows} total rows in table • Showing first ${records.length} records` : "Connecting..."}
            </p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body" style={{ maxHeight: "calc(90vh - 140px)", overflowY: "auto" }}>
          {loading && (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
              Loading records from PostgreSQL...
            </div>
          )}

          {error && (
            <div className="notification" style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", marginBottom: "12px" }}>
              <AlertTriangle size={16} />
              <span>{error}</span>
            </div>
          )}

          {data && (
            <>
              {/* Schema Summary */}
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>
                  Schema Columns ({columns.length}):
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                  {columns.map((c) => (
                    <span key={c.name} className="pipeline-tag-pill">
                      {c.name}: <strong>{c.type}</strong> {c.nullable ? "" : "NOT NULL"}
                    </span>
                  ))}
                </div>
              </div>

              {/* Records Table */}
              {records.length > 0 ? (
                <div className="pipeline-preview-table-wrapper">
                  <table className="cleaned-customer-table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        {columns.map((c) => (
                          <th key={c.name}>{c.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((row, idx) => (
                        <tr key={idx}>
                          {columns.map((c) => (
                            <td key={c.name}>
                              {row[c.name] !== null && row[c.name] !== undefined ? (
                                String(row[c.name])
                              ) : (
                                <span className="pipeline-null-badge">null</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: "8px" }}>
                  Table '{tableName}' is currently empty (0 rows).
                </div>
              )}
            </>
          )}
        </div>

        <div className="pipeline-modal-footer">
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   PIPELINE EXECUTION RESULTS MODAL (STAGE 5 - FEATURE 4)
========================================================= */

function PipelineExecutionModal({
  isOpen,
  onClose,
  executionResult,
  pipelineName,
  onRetry,
  isRetrying,
}) {
  if (!isOpen || !executionResult) return null;

  const isFailed = executionResult.status === "failed";
  const [activeTab, setActiveTab] = useState(isFailed ? "error" : "output");
  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const summary = executionResult.summary || {};
  const telemetry = executionResult.step_telemetry || [];
  const records = executionResult.records || [];
  const columns = executionResult.columns || (records[0] ? Object.keys(records[0]) : []);
  const failingStep = executionResult.failing_step || null;

  // Whenever executionResult changes, reset default tab
  useEffect(() => {
    setActiveTab(executionResult.status === "failed" ? "error" : "output");
  }, [executionResult?.run_id, executionResult?.status]);

  // Load structured logs from backend
  const loadLogs = async () => {
    if (!executionResult?.run_id) return;
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/pipelines/runs/${executionResult.run_id}/logs`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to load execution logs", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen && executionResult?.run_id) {
      loadLogs();
    }
  }, [isOpen, executionResult?.run_id]);

  const handleCopyLogs = () => {
    if (!logs || logs.length === 0) return;
    navigator.clipboard.writeText(logs.join("\n"));
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  const handleExportCSV = () => {
    if (!records || records.length === 0) return;
    const cols = columns.length > 0 ? columns : Object.keys(records[0]);
    const headerRow = cols.join(",");
    const dataRows = records.map((r) =>
      cols
        .map((c) => {
          const val = r[c] === null || r[c] === undefined ? "" : String(r[c]);
          return `"${val.replace(/"/g, '""')}"`;
        })
        .join(",")
    );
    const csvContent = [headerRow, ...dataRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(pipelineName || "pipeline").replace(/\s+/g, "_")}_${executionResult.run_id || "run"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    if (!records || records.length === 0) return;
    const jsonString = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(pipelineName || "pipeline").replace(/\s+/g, "_")}_${executionResult.run_id || "run"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ width: "min(960px, 95%)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cleaned-customer-modal-header">
          <div>
            <h3>Workflow Execution: {pipelineName || "Pipeline"}</h3>
            <p style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", marginTop: "2px" }}>
              <span>Run ID: {executionResult.run_id}</span>
              <span>•</span>
              <span style={{ color: isFailed ? "#dc2626" : "#16a34a", fontWeight: "600" }}>
                {executionResult.status?.toUpperCase()}
              </span>
              {executionResult.started_at && (
                <>
                  <span>•</span>
                  <span>Started: {new Date(executionResult.started_at).toLocaleTimeString()}</span>
                </>
              )}
              {executionResult.completed_at && (
                <>
                  <span>•</span>
                  <span>Completed: {new Date(executionResult.completed_at).toLocaleTimeString()}</span>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body" style={{ maxHeight: "calc(90vh - 140px)", overflowY: "auto" }}>
          {/* SUMMARY GRID */}
          <div className="pipeline-telemetry-grid">
            <div className="pipeline-telemetry-badge">
              <span>Run Status</span>
              <strong style={{ color: isFailed ? "#dc2626" : "#16a34a" }}>
                {executionResult.status?.toUpperCase()}
              </strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Total Duration</span>
              <strong>{executionResult.duration_ms ?? summary.total_duration_ms ?? 0} ms</strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Steps Completed</span>
              <strong>
                {executionResult.completed_steps ?? summary.steps_executed ?? 0} /{" "}
                {summary.total_steps || telemetry.length}
              </strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Rows In → Out</span>
              <strong>
                {executionResult.input_rows ?? summary.initial_rows ?? 0} →{" "}
                {executionResult.output_rows ?? summary.final_rows ?? 0}
              </strong>
            </div>
            <div className="pipeline-telemetry-badge">
              <span>Records Loaded</span>
              <strong style={{ color: "#2563eb" }}>{executionResult.records_loaded ?? 0}</strong>
            </div>
          </div>

          {/* STATUS BANNER */}
          {executionResult.destination_status && (
            <div
              className="notification"
              style={{
                background: isFailed ? "#fef2f2" : "#f0fdf4",
                color: isFailed ? "#991b1b" : "#166534",
                border: isFailed ? "1px solid #fecaca" : "1px solid #bbf7d0",
                marginBottom: "12px",
              }}
            >
              {isFailed ? <AlertTriangle size={16} /> : <CircleCheck size={16} />}
              <span>{executionResult.destination_status}</span>
            </div>
          )}

          {/* TAB BUTTONS (STAGE 5) */}
          <div className="pipeline-exec-tabs">
            <button
              type="button"
              className={`pipeline-exec-tab-btn ${activeTab === "output" ? "active" : ""}`}
              onClick={() => setActiveTab("output")}
            >
              <Eye size={14} /> View Output ({records.length})
            </button>
            <button
              type="button"
              className={`pipeline-exec-tab-btn ${isFailed ? "error-tab" : ""} ${activeTab === "error" ? "active" : ""}`}
              onClick={() => setActiveTab("error")}
            >
              {isFailed ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />} View Error {isFailed ? "(!)" : ""}
            </button>
            <button
              type="button"
              className={`pipeline-exec-tab-btn ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("logs");
                if (logs.length === 0) loadLogs();
              }}
            >
              <FileCheck2 size={14} /> View Logs ({logs.length})
            </button>
            <button
              type="button"
              className={`pipeline-exec-tab-btn ${activeTab === "steps" ? "active" : ""}`}
              onClick={() => setActiveTab("steps")}
            >
              <Sliders size={14} /> Step Telemetry ({telemetry.length})
            </button>
          </div>

          {/* TAB 1: VIEW OUTPUT */}
          {activeTab === "output" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ fontSize: "13px", color: "#475569" }}>
                  Displaying final dataset ({records.length} records, {columns.length} columns)
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={handleExportCSV}
                    disabled={records.length === 0}
                  >
                    <Download size={13} /> Export Results (CSV)
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={handleExportJSON}
                    disabled={records.length === 0}
                  >
                    <Download size={13} /> Export Results (JSON)
                  </button>
                </div>
              </div>

              {records.length > 0 ? (
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
                      {records.slice(0, 50).map((row, idx) => (
                        <tr key={idx}>
                          {columns.map((col) => (
                            <td key={col}>
                              {row[col] !== null && row[col] !== undefined ? (
                                String(row[col])
                              ) : (
                                <span className="pipeline-null-badge">null</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: "30px", textAlign: "center", color: "#94a3b8", background: "#f8fafc", borderRadius: "8px" }}>
                  No output records available. {isFailed ? "Pipeline execution halted before generating final destination dataset." : "Execution produced 0 rows."}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: VIEW ERROR */}
          {activeTab === "error" && (
            <div>
              {isFailed ? (
                <div className="pipeline-error-panel">
                  <div className="pipeline-error-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <AlertTriangle size={18} color="#dc2626" />
                      <strong style={{ color: "#991b1b", fontSize: "14px" }}>
                        Pipeline Execution Halted on Error
                      </strong>
                    </div>
                    {failingStep && (
                      <span className="pipeline-error-step-badge">
                        Failed at Step #{failingStep.step_order}: {failingStep.step_name} ({failingStep.step_type})
                      </span>
                    )}
                  </div>

                  <div className="pipeline-error-message">
                    {executionResult.error_message || failingStep?.error || "Unknown execution error occurred."}
                  </div>

                  {failingStep?.warnings?.length > 0 && (
                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#b45309" }}>
                      <strong>Step Warnings: </strong>
                      {failingStep.warnings.join("; ")}
                    </div>
                  )}

                  <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748b" }}>
                    <strong>Safe Halt Guarantee: </strong>
                    Execution stopped sequentially at the failing step. Subsequent steps were skipped to prevent partial
                    data corruption. You can adjust the step configuration in the Workbench and click <strong>Retry Execution</strong>.
                  </div>
                </div>
              ) : (
                <div style={{ padding: "28px", textAlign: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px" }}>
                  <CheckCircle2 size={32} color="#16a34a" style={{ margin: "0 auto 8px" }} />
                  <h4 style={{ margin: "0 0 4px", color: "#166534" }}>Zero Errors Detected</h4>
                  <p style={{ margin: 0, color: "#15803d", fontSize: "13px" }}>
                    All configured pipeline steps executed cleanly and satisfied data criteria.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: VIEW LOGS */}
          {activeTab === "logs" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", color: "#475569" }}>
                  Structured Execution Logs ({logs.length} entries)
                </span>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={loadLogs}
                    disabled={loadingLogs}
                  >
                    <RefreshCw size={12} className={loadingLogs ? "spin" : ""} /> Refresh Logs
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    style={{ padding: "4px 10px", fontSize: "12px" }}
                    onClick={handleCopyLogs}
                    disabled={logs.length === 0}
                  >
                    {copiedLogs ? <Check size={12} /> : <Copy size={12} />} {copiedLogs ? "Copied!" : "Copy Logs"}
                  </button>
                </div>
              </div>

              <div className="pipeline-log-terminal">
                {logs.length > 0 ? (
                  logs.map((line, idx) => {
                    const isErr = line.includes("ERROR:");
                    const isWarn = line.includes("WARN:");
                    const isInfo = line.includes("INFO:");
                    const cls = isErr ? "error" : isWarn ? "warn" : isInfo ? "info" : "";
                    return (
                      <div key={idx} className={`pipeline-log-line ${cls}`}>
                        {line}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: "#64748b" }}>
                    {loadingLogs ? "Loading execution logs from server..." : "No logs available for this run."}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STEP TELEMETRY */}
          {activeTab === "steps" && (
            <div>
              <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: "600", color: "#334155" }}>
                Step Execution Telemetry ({telemetry.length} steps recorded)
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {telemetry.map((t, idx) => {
                  const stepFailed = t.status === "failed";
                  return (
                    <div
                      key={idx}
                      className="pipeline-step-telemetry-row"
                      style={stepFailed ? { borderColor: "#fca5a5", background: "#fef2f2" } : {}}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>#{idx + 1}</span>
                        <div>
                          <strong style={{ fontSize: "13px", color: stepFailed ? "#b91c1c" : "#0f172a" }}>
                            {t.step_name}
                          </strong>
                          <span className="pipeline-step-badge" style={{ marginLeft: "8px" }}>
                            {t.type}
                          </span>
                          {stepFailed && (
                            <span style={{ marginLeft: "6px", color: "#dc2626", fontSize: "11px", fontWeight: "700" }}>
                              [FAILED]
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "12px" }}>
                        <span>{t.duration_ms} ms</span>
                        <span>
                          {t.rows_before} → {t.rows_after} rows
                        </span>
                        <span className={t.row_delta < 0 ? "pipeline-delta-negative" : "pipeline-delta-positive"}>
                          {t.row_delta > 0 ? `+${t.row_delta}` : t.row_delta}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER WITH RETRY AND EXPORT ACTIONS */}
        <div className="pipeline-modal-footer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="primary-button datamedic-load-mysql-button"
              onClick={() => onRetry && onRetry(executionResult.run_id)}
              disabled={isRetrying}
            >
              <RefreshCw size={14} className={isRetrying ? "spin" : ""} />
              {isRetrying ? "Retrying..." : "Retry Execution"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleExportCSV}
              disabled={records.length === 0}
            >
              <Download size={14} /> Export Results
            </button>
          </div>
          <button type="button" className="secondary-button" onClick={onClose}>
            Done
          </button>
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
   STAGE 7: PIPELINE MODALS & SAVED PIPELINES PAGE
========================================================= */

function PipelineDeleteModal({
  isOpen,
  onClose,
  pipeline,
  onConfirmDelete,
  isDeleting,
}) {
  if (!isOpen || !pipeline) return null;

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ maxWidth: "480px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cleaned-customer-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={20} color="#dc2626" />
            <h3 style={{ color: "#991b1b" }}>Delete Pipeline</h3>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body" style={{ padding: "16px 20px" }}>
          <p style={{ fontSize: "14px", color: "#334155", lineHeight: "1.5", margin: "0 0 12px 0" }}>
            Are you sure you want to delete pipeline <strong>"{pipeline.name}"</strong>?
          </p>
          <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>
            This action will permanently remove the pipeline definition and all historical version snapshots from PostgreSQL. This cannot be undone.
          </p>
        </div>

        <div className="pipeline-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px" }}>
          <button type="button" className="secondary-button" onClick={onClose} disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            style={{ background: "#dc2626", borderColor: "#dc2626" }}
            onClick={() => onConfirmDelete(pipeline.id)}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete Pipeline"}
          </button>
        </div>
      </div>
    </div>
  );
}


function PipelineRenameModal({
  isOpen,
  onClose,
  pipeline,
  onRenameSuccess,
}) {
  if (!isOpen || !pipeline) return null;

  const [newName, setNewName] = useState(pipeline.name || "");
  const [newDesc, setNewDesc] = useState(pipeline.description || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (pipeline) {
      setNewName(pipeline.name || "");
      setNewDesc(pipeline.description || "");
      setError(null);
    }
  }, [pipeline]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Pipeline name cannot be empty.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipeline.id}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to rename pipeline.");
      }
      const data = await res.json();
      onRenameSuccess(data.pipeline);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ maxWidth: "520px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit}>
          <div className="cleaned-customer-modal-header">
            <div>
              <h3>Rename Pipeline</h3>
              <p style={{ marginTop: "2px" }}>Update pipeline title and description</p>
            </div>
            <button type="button" onClick={onClose}>×</button>
          </div>

          <div className="pipeline-modal-body" style={{ padding: "16px 20px" }}>
            {error && (
              <div className="notification" style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", marginBottom: "12px" }}>
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            <div className="pipeline-form-group" style={{ marginBottom: "14px" }}>
              <label>Pipeline Name *</label>
              <input
                type="text"
                className="pipeline-form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Daily Customer Ingestion"
                required
              />
            </div>

            <div className="pipeline-form-group">
              <label>Description</label>
              <textarea
                className="pipeline-form-input"
                style={{ height: "80px", resize: "vertical" }}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description of pipeline transformations..."
              />
            </div>
          </div>

          <div className="pipeline-modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "14px 20px" }}>
            <button type="button" className="secondary-button" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function PipelineVersionsModal({
  isOpen,
  onClose,
  pipelineId,
  pipelineName,
  currentVersion,
  onRestoreSuccess,
}) {
  if (!isOpen || !pipelineId) return null;

  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [restoringVersion, setRestoringVersion] = useState(null);
  const [expandedVersion, setExpandedVersion] = useState(null);

  const fetchVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/versions`);
      if (!res.ok) throw new Error("Failed to load version history.");
      const data = await res.json();
      setVersions(data.versions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [pipelineId]);

  const handleRestore = async (verNum) => {
    const confirmed = window.confirm(
      `Restore Version ${verNum} as a new version? All existing version history will remain preserved in PostgreSQL.`
    );
    if (!confirmed) return;

    setRestoringVersion(verNum);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/versions/${verNum}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Failed to restore version.");
      }
      const data = await res.json();
      if (onRestoreSuccess) {
        onRestoreSuccess(data);
      }
      fetchVersions();
    } catch (err) {
      alert(`Restore failed: ${err.message}`);
    } finally {
      setRestoringVersion(null);
    }
  };

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ width: "min(720px, 95%)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cleaned-customer-modal-header">
          <div>
            <h3>Version History: {pipelineName}</h3>
            <p style={{ marginTop: "2px" }}>
              Immutable historical version snapshots stored in PostgreSQL
            </p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body" style={{ maxHeight: "calc(85vh - 140px)", overflowY: "auto", padding: "16px 20px" }}>
          {error && (
            <div className="notification" style={{ background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", marginBottom: "12px" }}>
              <AlertTriangle size={15} />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
              Loading version snapshots from PostgreSQL...
            </div>
          ) : versions.length > 0 ? (
            <div>
              {versions.map((ver) => {
                const isCurrent = ver.version === currentVersion;
                const isExpanded = expandedVersion === ver.version;
                const steps = ver.definition?.steps || [];

                return (
                  <div
                    key={ver.id || ver.version}
                    className={`version-item-card ${isCurrent ? "active" : ""}`}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="pipeline-version-badge" style={{ fontSize: "12px", padding: "3px 8px" }}>
                            Version {ver.version}
                          </span>
                          {isCurrent && (
                            <span className="pipeline-status-badge saved" style={{ fontSize: "11px" }}>
                              Current Active
                            </span>
                          )}
                          <span style={{ fontSize: "12px", color: "#64748b" }}>
                            {steps.length} step{steps.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          {ver.created_at ? new Date(ver.created_at).toLocaleString() : "—"}
                        </span>
                      </div>

                      <p style={{ fontSize: "12px", color: "#475569", margin: "4px 0" }}>
                        {ver.description || ver.definition?.description || "No description for this version snapshot."}
                      </p>

                      {isExpanded && (
                        <div className="version-steps-preview">
                          <strong style={{ display: "block", marginBottom: "6px", color: "#0f172a" }}>
                            Steps Configuration ({steps.length}):
                          </strong>
                          {steps.length > 0 ? (
                            <ol style={{ paddingLeft: "18px", margin: 0 }}>
                              {steps.map((st, i) => (
                                <li key={i} style={{ marginBottom: "4px" }}>
                                  <strong>{st.name || st.id}</strong> (<code>{st.type}</code>)
                                </li>
                              ))}
                            </ol>
                          ) : (
                            <em>No transformation steps in this version snapshot.</em>
                          )}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ fontSize: "11px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => setExpandedVersion(isExpanded ? null : ver.version)}
                        >
                          <Eye size={12} /> {isExpanded ? "Hide Steps" : "View Version"}
                        </button>

                        {!isCurrent && (
                          <button
                            type="button"
                            className="secondary-button"
                            style={{ fontSize: "11px", padding: "4px 10px", borderColor: "#2563eb", color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            onClick={() => handleRestore(ver.version)}
                            disabled={restoringVersion === ver.version}
                          >
                            <RefreshCw size={12} className={restoringVersion === ver.version ? "spin" : ""} />
                            {restoringVersion === ver.version ? "Restoring..." : "Restore Version"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cleaned-no-results">
              <Clock size={28} />
              <h3>No Version History</h3>
              <p>Save this pipeline to create its initial version snapshot.</p>
            </div>
          )}
        </div>

        <div className="pipeline-modal-footer" style={{ display: "flex", justifyContent: "flex-end", padding: "14px 20px" }}>
          <button type="button" className="secondary-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}


function SavedPipelinesPage({ onOpenPipeline, onNewPipeline }) {
  const [pipelines, setPipelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [banner, setBanner] = useState(null);

  // Modals state
  const [deletingPipeline, setDeletingPipeline] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [renamingPipeline, setRenamingPipeline] = useState(null);
  const [versionsModalPipeline, setVersionsModalPipeline] = useState(null);
  const [duplicatingId, setDuplicatingId] = useState(null);

  const fetchPipelines = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/pipelines`);
      if (res.ok) {
        const data = await res.json();
        setPipelines(data.pipelines || []);
      }
    } catch (err) {
      console.error("Failed to load pipelines", err);
      setBanner({ type: "error", text: "Failed to load saved pipelines from PostgreSQL." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelines();
  }, []);

  const handleDuplicate = async (pipelineId) => {
    setDuplicatingId(pipelineId);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/duplicate`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Duplication failed.");
      const data = await res.json();
      setBanner({ type: "success", text: data.message || "Pipeline duplicated successfully." });
      fetchPipelines();
    } catch (err) {
      setBanner({ type: "error", text: err.message || "Failed to duplicate pipeline." });
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleConfirmDelete = async (pipelineId) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete pipeline.");
      setBanner({ type: "success", text: "Pipeline deleted from PostgreSQL." });
      setDeletingPipeline(null);
      fetchPipelines();
    } catch (err) {
      setBanner({ type: "error", text: err.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRenameSuccess = (updatedPipeline) => {
    setBanner({ type: "success", text: `Pipeline renamed to '${updatedPipeline.name}'.` });
    fetchPipelines();
  };

  // Filter & Sort
  const filteredPipelines = pipelines
    .filter((p) => {
      const matchesSearch =
        !searchTerm.trim() ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" || p.status?.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === "name_asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "steps_desc") {
        return (b.steps_count || 0) - (a.steps_count || 0);
      }
      return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
    });

  const totalPipelines = pipelines.length;
  const savedCount = pipelines.filter((p) => p.status === "saved").length;
  const draftCount = pipelines.filter((p) => p.status === "draft").length;
  const totalSteps = pipelines.reduce((acc, p) => acc + (p.steps_count || 0), 0);

  return (
    <div className="page-container">
      {/* StatCards */}
      <div className="stats">
        <StatCard
          label="TOTAL PIPELINES"
          value={totalPipelines}
          description="Stored in PostgreSQL"
          icon={GitBranch}
        />
        <StatCard
          label="SAVED PIPELINES"
          value={savedCount}
          description="Ready for execution"
          icon={CircleCheck}
        />
        <StatCard
          label="DRAFTS"
          value={draftCount}
          description="Work in progress"
          icon={FileCheck2}
        />
        <StatCard
          label="TRANSFORMATION STEPS"
          value={totalSteps}
          description="Total steps across pipelines"
          icon={Layers}
        />
      </div>

      <div className="panel">
        <PanelHeader
          title="Saved Pipelines"
          description="Browse, duplicate, rename, version, and execute saved ETL pipelines"
          icon={Sliders}
        />

        {banner && (
          <div
            className={`notification ${banner.type === "success" ? "notification-success" : "notification-error"}`}
            style={{
              margin: "0 0 16px 0",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "6px",
              background: banner.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${banner.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              color: banner.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            {banner.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span style={{ fontSize: "13px" }}>{banner.text}</span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "16px" }}
            >
              ×
            </button>
          </div>
        )}

        {/* Toolbar: Search, Filters, New Pipeline */}
        <div className="saved-pipelines-toolbar">
          <div className="saved-pipelines-controls">
            <div className="cleaned-search-box" style={{ maxWidth: "280px", margin: 0 }}>
              <Search size={15} />
              <input
                type="text"
                placeholder="Search pipelines..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <select
              className="pipeline-form-select"
              style={{ width: "auto", minWidth: "140px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="saved">Saved Only</option>
              <option value="draft">Drafts Only</option>
            </select>

            <select
              className="pipeline-form-select"
              style={{ width: "auto", minWidth: "180px" }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="updated_desc">Sort by Last Updated</option>
              <option value="name_asc">Sort by Name (A-Z)</option>
              <option value="steps_desc">Sort by Step Count</option>
            </select>
          </div>

          <button
            type="button"
            className="primary-button"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            onClick={onNewPipeline}
          >
            <Plus size={15} /> New Pipeline
          </button>
        </div>

        {/* Pipeline Cards Grid */}
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
            Loading pipelines from PostgreSQL...
          </div>
        ) : filteredPipelines.length > 0 ? (
          <div className="pipelines-grid">
            {filteredPipelines.map((p) => (
              <div key={p.id} className="pipeline-card-modern">
                <div>
                  <div className="pipeline-card-top">
                    <div className="pipeline-card-title-group">
                      <GitBranch size={17} color="#2563eb" />
                      <h3 title={p.name}>{p.name}</h3>
                    </div>
                    <div className="pipeline-badge-group">
                      <span className="pipeline-version-badge">
                        v{p.version || 1}
                      </span>
                      <span className={`pipeline-status-badge ${p.status === "saved" ? "saved" : "draft"}`}>
                        {p.status || "draft"}
                      </span>
                    </div>
                  </div>

                  <p className="pipeline-card-desc">
                    {p.description || "No description provided."}
                  </p>

                  <div className="pipeline-card-meta">
                    <div className="pipeline-card-meta-left">
                      <span className="pipeline-steps-tag">
                        <Layers size={13} /> {p.steps_count || 0} step{(p.steps_count !== 1) ? "s" : ""}
                      </span>
                      <span>
                        Target: {p.destination?.table || "customers"}
                      </span>
                    </div>
                    <span>
                      {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "—"}
                    </span>
                  </div>
                </div>

                <div className="pipeline-card-actions">
                  <div className="pipeline-card-actions-left">
                    <button
                      type="button"
                      className="primary-button"
                      style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => onOpenPipeline(p.id)}
                      title="Open in Pipeline Workbench"
                    >
                      <ArrowRight size={13} /> Open
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "12px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => handleDuplicate(p.id)}
                      disabled={duplicatingId === p.id}
                      title="Duplicate pipeline"
                    >
                      <Copy size={13} /> {duplicatingId === p.id ? "Duplicating..." : "Duplicate"}
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "12px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => setRenamingPipeline(p)}
                      title="Rename pipeline"
                    >
                      <Edit2 size={13} /> Rename
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      style={{ fontSize: "12px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => setVersionsModalPipeline(p)}
                      title="View and restore versions"
                    >
                      <Clock size={13} /> Versions
                    </button>
                  </div>

                  <button
                    type="button"
                    className="secondary-button pipeline-btn-delete"
                    style={{ fontSize: "12px", padding: "6px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                    onClick={() => setDeletingPipeline(p)}
                    title="Delete pipeline"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cleaned-no-results">
            <GitBranch size={28} />
            <h3>No Pipelines Found</h3>
            <p>
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search query or filters."
                : "No saved pipelines exist yet. Click 'New Pipeline' to build your first ETL pipeline."}
            </p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <PipelineDeleteModal
        isOpen={Boolean(deletingPipeline)}
        pipeline={deletingPipeline}
        onClose={() => setDeletingPipeline(null)}
        onConfirmDelete={handleConfirmDelete}
        isDeleting={isDeleting}
      />

      {/* Rename Modal */}
      <PipelineRenameModal
        isOpen={Boolean(renamingPipeline)}
        pipeline={renamingPipeline}
        onClose={() => setRenamingPipeline(null)}
        onRenameSuccess={handleRenameSuccess}
      />

      {/* Version History Modal */}
      <PipelineVersionsModal
        isOpen={Boolean(versionsModalPipeline)}
        pipelineId={versionsModalPipeline?.id}
        pipelineName={versionsModalPipeline?.name}
        currentVersion={versionsModalPipeline?.version || 1}
        onClose={() => setVersionsModalPipeline(null)}
        onRestoreSuccess={(res) => {
          setBanner({ type: "success", text: res.message || "Version restored successfully." });
          fetchPipelines();
        }}
      />
    </div>
  );
}


/* =========================================================
   STAGE 8: DATA CONTRACT MODAL & INPUT VALIDATION
========================================================= */

function DataContractModal({
  isOpen,
  onClose,
  pipelineId,
  pipelineName,
  availableColumns = [],
  records = null,
  errorPolicy = "stop_on_error",
  onRulesUpdated,
  onContinueExecution,
}) {
  const [rules, setRules] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState(null);

  // Form states
  const [formRuleName, setFormRuleName] = useState("");
  const [formColumnName, setFormColumnName] = useState("");
  const [formIsRequired, setFormIsRequired] = useState(true);
  const [formExpectedType, setFormExpectedType] = useState("string");
  const [formAllowNull, setFormAllowNull] = useState(true);
  const [formMinValue, setFormMinValue] = useState("");
  const [formMaxValue, setFormMaxValue] = useState("");
  const [formIsUnique, setFormIsUnique] = useState(false);
  const [formPermittedValues, setFormPermittedValues] = useState("");
  const [banner, setBanner] = useState(null);

  const fetchRules = async () => {
    if (!pipelineId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/contracts`);
      if (res.ok) {
        const data = await res.json();
        const loadedRules = data.rules || [];
        setRules(loadedRules);
        if (onRulesUpdated) onRulesUpdated(loadedRules);
      }
    } catch (err) {
      console.error(err);
      setBanner({ type: "danger", text: "Failed to load contract rules from database." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchRules();
      setValidationResult(null);
      setIsEditingRule(false);
      setBanner(null);
    }
  }, [isOpen, pipelineId]);

  const handleOpenAddRule = () => {
    setEditingRuleId(null);
    setFormRuleName("");
    setFormColumnName(availableColumns[0] || "email");
    setFormIsRequired(true);
    setFormExpectedType("string");
    setFormAllowNull(true);
    setFormMinValue("");
    setFormMaxValue("");
    setFormIsUnique(false);
    setFormPermittedValues("");
    setIsEditingRule(true);
    setBanner(null);
  };

  const handleOpenEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setFormRuleName(rule.rule_name || "");
    setFormColumnName(rule.column_name || "");
    setFormIsRequired(rule.is_required ?? true);
    setFormExpectedType(rule.expected_type || "string");
    setFormAllowNull(rule.allow_null ?? true);
    setFormMinValue(rule.min_value !== null && rule.min_value !== undefined ? String(rule.min_value) : "");
    setFormMaxValue(rule.max_value !== null && rule.max_value !== undefined ? String(rule.max_value) : "");
    setFormIsUnique(Boolean(rule.is_unique));
    setFormPermittedValues(Array.isArray(rule.permitted_values) ? rule.permitted_values.join(", ") : "");
    setIsEditingRule(true);
    setBanner(null);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!formColumnName.trim()) {
      setBanner({ type: "danger", text: "Column name is required." });
      return;
    }

    const permittedList = formPermittedValues
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const rulePayload = {
      rule_name: formRuleName.trim() || `Rule: ${formColumnName.trim()}`,
      column_name: formColumnName.trim(),
      is_required: formIsRequired,
      expected_type: formExpectedType,
      allow_null: formAllowNull,
      min_value: formMinValue !== "" ? parseFloat(formMinValue) : null,
      max_value: formMaxValue !== "" ? parseFloat(formMaxValue) : null,
      is_unique: formIsUnique,
      permitted_values: permittedList,
    };

    try {
      let res;
      if (editingRuleId) {
        res = await fetch(`${API_URL}/pipelines/${pipelineId}/contracts/${editingRuleId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rulePayload),
        });
      } else {
        res = await fetch(`${API_URL}/pipelines/${pipelineId}/contracts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(rulePayload),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to save contract rule.");
      }

      setBanner({ type: "success", text: `Rule '${rulePayload.rule_name}' saved successfully.` });
      setIsEditingRule(false);
      fetchRules();
    } catch (err) {
      setBanner({ type: "danger", text: err.message });
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm("Are you sure you want to remove this contract rule?")) return;
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/contracts/${ruleId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setBanner({ type: "success", text: "Rule removed successfully." });
        fetchRules();
      } else {
        throw new Error("Failed to delete rule.");
      }
    } catch (err) {
      setBanner({ type: "danger", text: err.message });
    }
  };

  const handleValidateContract = async () => {
    setIsValidating(true);
    setBanner(null);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/contracts/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: rules,
          records: records || null,
          error_policy: errorPolicy,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Validation request failed.");
      }
      const data = await res.json();
      setValidationResult(data.validation);
    } catch (err) {
      setBanner({ type: "danger", text: err.message });
    } finally {
      setIsValidating(false);
    }
  };

  const handleDownloadResults = () => {
    if (!validationResult) return;
    const reportData = {
      pipeline_id: pipelineId,
      pipeline_name: pipelineName,
      timestamp: new Date().toISOString(),
      overall_status: validationResult.status,
      summary: validationResult.summary,
      total_rules: validationResult.total_rules,
      passed_count: validationResult.passed_count,
      warning_count: validationResult.warning_count,
      failed_count: validationResult.failed_count,
      can_continue: validationResult.can_continue,
      has_hard_failure: validationResult.has_hard_failure,
      results: validationResult.rule_results,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data_contract_validation_${pipelineId || "report"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ maxWidth: "880px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cleaned-customer-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileCheck2 size={20} color="#2563eb" />
            <div>
              <h3 style={{ margin: 0 }}>Data Contract & Input Validation</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Pipeline: <strong>{pipelineName || pipelineId}</strong> ({rules.length} rule{rules.length !== 1 ? "s" : ""})
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </div>

        <div className="pipeline-modal-body" style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {banner && (
            <div
              className={`pipeline-alert ${banner.type}`}
              style={{
                padding: "10px 14px",
                borderRadius: "6px",
                marginBottom: "14px",
                fontSize: "12px",
                background: banner.type === "danger" ? "#fef2f2" : "#f0fdf4",
                color: banner.type === "danger" ? "#991b1b" : "#166534",
                border: `1px solid ${banner.type === "danger" ? "#fecaca" : "#bbf7d0"}`,
              }}
            >
              {banner.text}
            </div>
          )}

          {/* Validation summary banner if validation was run */}
          {validationResult && (
            <div className={`contract-banner-summary ${validationResult.status}`}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {validationResult.status === "passed" ? (
                  <CheckCircle2 size={18} color="#15803d" />
                ) : validationResult.status === "warning" ? (
                  <AlertTriangle size={18} color="#b45309" />
                ) : (
                  <XCircle size={18} color="#b91c1c" />
                )}
                <span>
                  <strong>Contract Status: {validationResult.status.toUpperCase()}</strong> — {validationResult.summary}
                </span>
              </div>
              <div>
                <span style={{ fontSize: "12px", opacity: 0.9 }}>
                  Can proceed: <strong>{validationResult.can_continue ? "YES" : "NO"}</strong>
                </span>
              </div>
            </div>
          )}

          {/* Add / Edit Rule Form */}
          {isEditingRule ? (
            <form className="contract-rule-form" onSubmit={handleSaveRule}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <h4 style={{ margin: 0, fontSize: "13px", color: "#1e293b" }}>
                  {editingRuleId ? "Edit Contract Rule" : "Add New Contract Rule"}
                </h4>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                  onClick={() => setIsEditingRule(false)}
                >
                  Cancel
                </button>
              </div>

              <div className="contract-form-grid">
                <div className="contract-form-group">
                  <label>Rule Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Require Non-Null Email"
                    value={formRuleName}
                    onChange={(e) => setFormRuleName(e.target.value)}
                  />
                </div>

                <div className="contract-form-group">
                  <label>Target Column *</label>
                  <select
                    value={formColumnName}
                    onChange={(e) => setFormColumnName(e.target.value)}
                  >
                    <option value="">-- Select Column --</option>
                    {availableColumns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>

                <div className="contract-form-group">
                  <label>Expected Type</label>
                  <select
                    value={formExpectedType}
                    onChange={(e) => setFormExpectedType(e.target.value)}
                  >
                    <option value="string">string (text)</option>
                    <option value="integer">integer</option>
                    <option value="float">float / number</option>
                    <option value="boolean">boolean</option>
                    <option value="datetime">datetime</option>
                    <option value="any">any</option>
                  </select>
                </div>

                <div className="contract-form-group">
                  <label>Numeric Range (Min / Max)</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="number"
                      placeholder="Min"
                      value={formMinValue}
                      onChange={(e) => setFormMinValue(e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Max"
                      value={formMaxValue}
                      onChange={(e) => setFormMaxValue(e.target.value)}
                    />
                  </div>
                </div>

                <div className="contract-form-group" style={{ gridColumn: "1 / -1" }}>
                  <label>Permitted Values (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. Chennai, Madurai, Coimbatore, Bangalore"
                    value={formPermittedValues}
                    onChange={(e) => setFormPermittedValues(e.target.value)}
                  />
                </div>
              </div>

              <div className="contract-form-checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    checked={formIsRequired}
                    onChange={(e) => setFormIsRequired(e.target.checked)}
                  />
                  Required Column (Missing column halts pipeline)
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={formAllowNull}
                    onChange={(e) => setFormAllowNull(e.target.checked)}
                  />
                  Allow Null Values
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={formIsUnique}
                    onChange={(e) => setFormIsUnique(e.target.checked)}
                  />
                  Must Be Unique
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setIsEditingRule(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-button"
                >
                  {editingRuleId ? "Update Rule" : "Save Rule"}
                </button>
              </div>
            </form>
          ) : null}

          {/* Validation Results Table */}
          {validationResult && (
            <div style={{ marginBottom: "20px" }}>
              <div className="contract-table-header">
                <h4 style={{ margin: 0, fontSize: "13px", color: "#1e293b" }}>
                  Validation Results ({validationResult.rule_results.length})
                </h4>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: "11px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={handleDownloadResults}
                >
                  <Download size={13} /> Download Validation Results
                </button>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rule</th>
                      <th>Column</th>
                      <th>Status</th>
                      <th>Affected Rows</th>
                      <th>Explanation</th>
                      <th>Can Continue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationResult.rule_results.map((r, i) => (
                      <tr key={r.rule_id || i}>
                        <td><strong>{r.rule_name}</strong></td>
                        <td><code>{r.column}</code></td>
                        <td>
                          <span className={`contract-status-badge ${r.status}`}>
                            {r.status}
                          </span>
                        </td>
                        <td>{r.affected_rows}</td>
                        <td style={{ fontSize: "12px", color: r.status === "failed" ? "#991b1b" : "#475569" }}>
                          {r.explanation}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: r.can_continue ? "#15803d" : "#b91c1c" }}>
                            {r.can_continue ? "Yes" : "No"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rules Configuration List */}
          <div>
            <div className="contract-table-header">
              <h4 style={{ margin: 0, fontSize: "13px", color: "#1e293b" }}>
                Configured Contract Rules ({rules.length})
              </h4>
              {!isEditingRule && (
                <button
                  type="button"
                  className="secondary-button"
                  style={{ fontSize: "12px", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={handleOpenAddRule}
                >
                  <Plus size={13} /> Add Rule
                </button>
              )}
            </div>

            {isLoading ? (
              <p style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>Loading contract rules...</p>
            ) : rules.length > 0 ? (
              <div className="contract-rule-grid">
                {rules.map((rule) => (
                  <div key={rule.id} className="contract-rule-card">
                    <div className="contract-rule-info">
                      <div className="contract-rule-title-row">
                        <strong>{rule.rule_name}</strong>
                        <span style={{ fontSize: "12px", color: "#64748b" }}>
                          column: <code>{rule.column_name}</code>
                        </span>
                      </div>
                      <div className="contract-rule-tags">
                        <span className={`contract-rule-tag ${rule.is_required ? "required" : "optional"}`}>
                          {rule.is_required ? "Required Column" : "Optional Column"}
                        </span>
                        <span className="contract-rule-tag type">
                          Type: {rule.expected_type || "any"}
                        </span>
                        <span className="contract-rule-tag">
                          {rule.allow_null ? "Allows Null" : "Disallow Null"}
                        </span>
                        {rule.is_unique && (
                          <span className="contract-rule-tag unique">
                            Unique Required
                          </span>
                        )}
                        {(rule.min_value !== null || rule.max_value !== null) && (
                          <span className="contract-rule-tag range">
                            Range: [{rule.min_value !== null ? rule.min_value : "-∞"}, {rule.max_value !== null ? rule.max_value : "+∞"}]
                          </span>
                        )}
                        {rule.permitted_values?.length > 0 && (
                          <span className="contract-rule-tag">
                            Permitted: {rule.permitted_values.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="contract-rule-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ fontSize: "11px", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        onClick={() => handleOpenEditRule(rule)}
                        title="Edit Rule"
                      >
                        <Edit2 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ fontSize: "11px", padding: "4px 8px", color: "#dc2626", borderColor: "#fecaca", display: "inline-flex", alignItems: "center", gap: "4px" }}
                        onClick={() => handleDeleteRule(rule.id)}
                        title="Remove Rule"
                      >
                        <Trash2 size={12} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                <FileCheck2 size={24} color="#94a3b8" />
                <p style={{ margin: "8px 0 12px 0", fontSize: "13px", color: "#64748b" }}>
                  No contract rules defined for this pipeline yet.
                </p>
                <button
                  type="button"
                  className="primary-button"
                  style={{ fontSize: "12px", padding: "6px 14px" }}
                  onClick={handleOpenAddRule}
                >
                  <Plus size={13} /> Add First Rule
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pipeline-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", borderTop: "1px solid #e2e8f0" }}>
          <div>
            {validationResult && (
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={handleDownloadResults}
              >
                <Download size={14} /> Download Validation Results
              </button>
            )}
          </div>

          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            {/* Only add Continue Anyway if execution policy explicitly allows warnings and rule is not a hard failure */}
            {validationResult &&
              validationResult.status === "warning" &&
              errorPolicy === "continue_on_warning" &&
              !validationResult.has_hard_failure && (
                <button
                  type="button"
                  className="primary-button"
                  style={{ background: "#d97706", borderColor: "#d97706", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  onClick={() => {
                    onClose();
                    if (onContinueExecution) onContinueExecution();
                  }}
                  title="Execution policy permits continuing with warnings"
                >
                  <Play size={14} /> Continue Anyway
                </button>
              )}

            <button
              type="button"
              className="primary-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              onClick={handleValidateContract}
              disabled={isValidating || rules.length === 0}
            >
              <Check size={14} /> {isValidating ? "Validating..." : "Validate Contract"}
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


/* =========================================================
   STAGE 9: SCHEMA CHANGE DETECTION & DRIFT MODAL (FEATURE 8)
========================================================= */

function SchemaCheckModal({
  isOpen,
  onClose,
  pipelineId,
  pipelineName,
  records = null,
  contractRules = [],
  onSchemaAccepted,
  onOpenContractValidation,
}) {
  const [loading, setLoading] = useState(false);
  const [schemaCheck, setSchemaCheck] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [banner, setBanner] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [showConfirmAccept, setShowConfirmAccept] = useState(false);

  const fetchSchemaCheck = async () => {
    setLoading(true);
    setBanner(null);
    try {
      let res;
      if (pipelineId) {
        res = await fetch(`${API_URL}/pipelines/${pipelineId}/schema-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: records || null,
            contract_rules: contractRules || null,
          }),
        });
      } else {
        res = await fetch(`${API_URL}/schema/detect-changes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            records: records || null,
            contract_rules: contractRules || null,
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to check schema.");
      }

      const data = await res.json();
      setSchemaCheck(data.schema_check);
    } catch (err) {
      console.error(err);
      setBanner({ type: "danger", text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchSchemaCheck();
      setShowConfirmAccept(false);
    }
  }, [isOpen, pipelineId]);

  const handleConfirmAcceptSchema = async () => {
    if (!pipelineId) {
      setBanner({ type: "warning", text: "Please save the pipeline before accepting schema updates to PostgreSQL." });
      setShowConfirmAccept(false);
      return;
    }

    setIsAccepting(true);
    try {
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/accept-schema`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: records || null,
          new_schema: schemaCheck?.current_schema || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to accept new schema.");
      }

      const data = await res.json();
      setBanner({
        type: "success",
        text: `Schema accepted! Synchronized ${data.updated_contracts?.length || 0} contract rules in PostgreSQL database.`,
      });
      setShowConfirmAccept(false);
      if (onSchemaAccepted) {
        onSchemaAccepted(data.updated_contracts);
      }
      fetchSchemaCheck();
    } catch (err) {
      console.error(err);
      setBanner({ type: "danger", text: err.message });
      setShowConfirmAccept(false);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDownloadDiffReport = () => {
    if (!schemaCheck) return;
    const reportData = {
      pipeline_id: pipelineId,
      pipeline_name: pipelineName,
      generated_at: new Date().toISOString(),
      compatibility_status: schemaCheck.compatibility_status,
      summary: schemaCheck.summary,
      stats: schemaCheck.stats,
      missing_columns: schemaCheck.missing_columns,
      unexpected_columns: schemaCheck.unexpected_columns,
      type_changes: schemaCheck.type_changes,
      compatible_columns: schemaCheck.compatible_columns,
      current_schema: schemaCheck.current_schema,
      expected_schema: schemaCheck.expected_schema,
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema_drift_report_${pipelineId || "workbench"}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const totalDiffs =
    (schemaCheck?.missing_columns?.length || 0) +
    (schemaCheck?.unexpected_columns?.length || 0) +
    (schemaCheck?.type_changes?.length || 0);

  return (
    <div className="cleaned-customer-overlay" onClick={onClose}>
      <div
        className="cleaned-customer-modal"
        style={{ maxWidth: "920px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cleaned-customer-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <GitCompare size={20} color="#2563eb" />
            <div>
              <h3 style={{ margin: 0 }}>Schema Change Detection & Drift Analysis</h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Pipeline: <strong>{pipelineName || pipelineId || "Current Dataset"}</strong> — Comparing incoming dataset against expected data contract
              </p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {banner && (
          <div
            className={`contract-banner-summary ${banner.type}`}
            style={{ margin: "12px 20px 0 20px" }}
          >
            {banner.type === "success" && <CheckCircle2 size={16} />}
            {banner.type === "danger" && <XCircle size={16} />}
            {banner.type === "warning" && <AlertTriangle size={16} />}
            <span>{banner.text}</span>
          </div>
        )}

        <div className="cleaned-customer-modal-content" style={{ padding: "16px 20px", overflowY: "auto", flex: 1 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
              <RefreshCw size={24} className="spin" style={{ marginBottom: "12px", color: "#2563eb" }} />
              <p style={{ margin: 0, fontSize: "14px" }}>Analyzing dataset schema against pipeline contracts...</p>
            </div>
          )}

          {!loading && schemaCheck && (
            <>
              {/* Overall Status Banner */}
              <div
                className={`contract-banner-summary ${schemaCheck.compatibility_status}`}
                style={{ marginBottom: "16px", padding: "14px 18px", borderRadius: "8px" }}
              >
                {schemaCheck.compatibility_status === "compatible" && (
                  <CheckCircle2 size={20} color="#10b981" />
                )}
                {schemaCheck.compatibility_status === "warning" && (
                  <AlertTriangle size={20} color="#f59e0b" />
                )}
                {schemaCheck.compatibility_status === "incompatible" && (
                  <XCircle size={20} color="#ef4444" />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <strong style={{ fontSize: "14px" }}>
                      {schemaCheck.compatibility_status === "compatible" && "SCHEMA COMPATIBLE"}
                      {schemaCheck.compatibility_status === "warning" && "SCHEMA DRIFT DETECTED (WARNING)"}
                      {schemaCheck.compatibility_status === "incompatible" && "INCOMPATIBLE SCHEMA (BREAKING CHANGES)"}
                    </strong>
                    <span className={`contract-status-badge ${schemaCheck.compatibility_status}`}>
                      {schemaCheck.compatibility_status.toUpperCase()}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px" }}>{schemaCheck.summary}</p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="schema-stats-grid">
                <div className="schema-stat-box">
                  <span>Detected Columns</span>
                  <strong>{schemaCheck.stats?.total_current_columns || 0}</strong>
                </div>
                <div className="schema-stat-box">
                  <span>Expected Columns</span>
                  <strong>{schemaCheck.stats?.total_expected_columns || 0}</strong>
                </div>
                <div className="schema-stat-box" style={{ borderLeft: schemaCheck.missing_columns?.length > 0 ? "3px solid #ef4444" : undefined }}>
                  <span>Missing Columns</span>
                  <strong style={{ color: schemaCheck.missing_columns?.length > 0 ? "#ef4444" : "#1e293b" }}>
                    {schemaCheck.stats?.missing_count || 0}
                  </strong>
                </div>
                <div className="schema-stat-box" style={{ borderLeft: schemaCheck.unexpected_columns?.length > 0 ? "3px solid #f59e0b" : undefined }}>
                  <span>Unexpected Drift</span>
                  <strong style={{ color: schemaCheck.unexpected_columns?.length > 0 ? "#f59e0b" : "#1e293b" }}>
                    {schemaCheck.stats?.unexpected_count || 0}
                  </strong>
                </div>
                <div className="schema-stat-box" style={{ borderLeft: schemaCheck.type_changes?.length > 0 ? "3px solid #ef4444" : undefined }}>
                  <span>Type Mismatches</span>
                  <strong style={{ color: schemaCheck.type_changes?.length > 0 ? "#ef4444" : "#1e293b" }}>
                    {schemaCheck.stats?.type_change_count || 0}
                  </strong>
                </div>
                <div className="schema-stat-box" style={{ borderLeft: "3px solid #10b981" }}>
                  <span>Compatible</span>
                  <strong style={{ color: "#10b981" }}>
                    {schemaCheck.stats?.compatible_count || 0}
                  </strong>
                </div>
              </div>

              {/* Confirmation Notice when Accept New Schema is clicked */}
              {showConfirmAccept && (
                <div
                  style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: "8px",
                    padding: "16px",
                    marginBottom: "16px",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px 0", color: "#1e3a8a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <AlertTriangle size={18} color="#2563eb" />
                    Confirm Contract Schema Synchronization
                  </h4>
                  <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#1e40af" }}>
                    Are you sure you want to accept this new schema? This will synchronize the PostgreSQL Data Contract rules for pipeline <strong>{pipelineName || pipelineId}</strong>:
                  </p>
                  <ul style={{ margin: "0 0 14px 20px", fontSize: "12px", color: "#334155" }}>
                    <li>Add rules for unexpected columns: <strong>{schemaCheck.unexpected_columns?.map(c => c.column).join(", ") || "None"}</strong></li>
                    <li>Update expected types for changed columns: <strong>{schemaCheck.type_changes?.map(c => `${c.column} (${c.expected_type} → ${c.detected_type})`).join(", ") || "None"}</strong></li>
                    <li>Relax constraints on removed columns so pipeline execution is unblocked.</li>
                  </ul>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      className="primary-button"
                      style={{ background: "#2563eb", borderColor: "#2563eb" }}
                      onClick={handleConfirmAcceptSchema}
                      disabled={isAccepting}
                    >
                      {isAccepting ? "Updating PostgreSQL Contracts..." : "Confirm & Update Contracts"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setShowConfirmAccept(false)}
                      disabled={isAccepting}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="schema-nav-tabs">
                <button
                  type="button"
                  className={`schema-nav-tab ${activeTab === "all" ? "active" : ""}`}
                  onClick={() => setActiveTab("all")}
                >
                  All Differences ({totalDiffs})
                </button>
                <button
                  type="button"
                  className={`schema-nav-tab ${activeTab === "missing" ? "active" : ""}`}
                  onClick={() => setActiveTab("missing")}
                >
                  Missing ({schemaCheck.missing_columns?.length || 0})
                </button>
                <button
                  type="button"
                  className={`schema-nav-tab ${activeTab === "unexpected" ? "active" : ""}`}
                  onClick={() => setActiveTab("unexpected")}
                >
                  Unexpected Drift ({schemaCheck.unexpected_columns?.length || 0})
                </button>
                <button
                  type="button"
                  className={`schema-nav-tab ${activeTab === "types" ? "active" : ""}`}
                  onClick={() => setActiveTab("types")}
                >
                  Type Mismatches ({schemaCheck.type_changes?.length || 0})
                </button>
                <button
                  type="button"
                  className={`schema-nav-tab ${activeTab === "compatible" ? "active" : ""}`}
                  onClick={() => setActiveTab("compatible")}
                >
                  Compatible ({schemaCheck.compatible_columns?.length || 0})
                </button>
                <button
                  type="button"
                  className={`schema-nav-tab ${activeTab === "matrix" ? "active" : ""}`}
                  onClick={() => setActiveTab("matrix")}
                >
                  Side-by-Side Matrix
                </button>
              </div>

              {/* Tab Contents */}
              {activeTab === "all" && totalDiffs === 0 && (
                <div style={{ textAlign: "center", padding: "30px", color: "#10b981" }}>
                  <CheckCircle2 size={36} style={{ marginBottom: "8px" }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No schema drift or mismatches detected!</p>
                  <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                    All ingested columns match the pipeline's expected contract schema.
                  </p>
                </div>
              )}

              {/* Missing Columns */}
              {(activeTab === "all" || activeTab === "missing") &&
                schemaCheck.missing_columns?.map((m) => (
                  <div key={m.column} className={`schema-diff-card ${m.severity}`}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "14px", color: "#1e293b" }}>{m.column}</strong>
                        <span className={`contract-rule-tag ${m.is_required ? "required" : "optional"}`}>
                          {m.is_required ? "REQUIRED MISSING" : "OPTIONAL MISSING"}
                        </span>
                        <span className="contract-rule-tag type">
                          expected: {m.expected_type}
                        </span>
                        <span className={`contract-status-badge ${m.severity}`}>
                          {m.severity.toUpperCase()}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{m.explanation}</p>
                    </div>
                  </div>
                ))}

              {/* Unexpected Columns (Drift) */}
              {(activeTab === "all" || activeTab === "unexpected") &&
                schemaCheck.unexpected_columns?.map((u) => (
                  <div key={u.column} className={`schema-diff-card ${u.severity}`}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "14px", color: "#1e293b" }}>{u.column}</strong>
                        <span className="contract-rule-tag range" style={{ background: "#fef3c7", color: "#92400e" }}>
                          UNEXPECTED COLUMN (DRIFT)
                        </span>
                        <span className="contract-rule-tag type">
                          detected: {u.detected_type}
                        </span>
                        <span className="contract-status-badge warning">
                          WARNING
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{u.explanation}</p>
                    </div>
                  </div>
                ))}

              {/* Type Changes */}
              {(activeTab === "all" || activeTab === "types") &&
                schemaCheck.type_changes?.map((t) => (
                  <div key={t.column} className={`schema-diff-card ${t.severity}`}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                        <strong style={{ fontSize: "14px", color: "#1e293b" }}>{t.column}</strong>
                        <span className="schema-type-compare">
                          <span>{t.expected_type}</span>
                          <ArrowRight size={12} color="#64748b" />
                          <span style={{ fontWeight: 600, color: t.severity === "incompatible" ? "#ef4444" : "#f59e0b" }}>
                            {t.detected_type}
                          </span>
                        </span>
                        <span className={`contract-status-badge ${t.severity}`}>
                          {t.severity === "incompatible" ? "BREAKING MISMATCH" : "TYPE WARNING"}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>{t.explanation}</p>
                    </div>
                  </div>
                ))}

              {/* Compatible Columns */}
              {activeTab === "compatible" && (
                <div>
                  {schemaCheck.compatible_columns?.length === 0 ? (
                    <p style={{ color: "#64748b", textAlign: "center", padding: "20px" }}>No compatible columns found.</p>
                  ) : (
                    schemaCheck.compatible_columns?.map((c) => (
                      <div key={c.column} className="schema-diff-card compatible">
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <CheckCircle2 size={16} color="#10b981" />
                          <strong style={{ fontSize: "14px" }}>{c.column}</strong>
                          <span className="contract-rule-tag type">{c.type}</span>
                          <span className="contract-status-badge success">MATCHED</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Side-by-Side Matrix */}
              {activeTab === "matrix" && (
                <div style={{ overflowX: "auto" }}>
                  <table className="pipeline-table" style={{ width: "100%", fontSize: "12px" }}>
                    <thead>
                      <tr>
                        <th>Column Name</th>
                        <th>Incoming Data Type</th>
                        <th>Expected Type</th>
                        <th>Required?</th>
                        <th>Compatibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Expected columns */}
                      {schemaCheck.expected_schema?.map((exp) => {
                        const isMissing = schemaCheck.missing_columns?.some((m) => m.column === exp.name);
                        const typeChange = schemaCheck.type_changes?.find((t) => t.column === exp.name);
                        const currCol = schemaCheck.current_schema?.find((c) => c.name === exp.name);

                        let statusBadge = (
                          <span className="contract-status-badge success">COMPATIBLE</span>
                        );
                        if (isMissing) {
                          statusBadge = (
                            <span className={`contract-status-badge ${exp.is_required ? "incompatible" : "warning"}`}>
                              {exp.is_required ? "MISSING (REQUIRED)" : "MISSING (OPTIONAL)"}
                            </span>
                          );
                        } else if (typeChange) {
                          statusBadge = (
                            <span className={`contract-status-badge ${typeChange.severity}`}>
                              {typeChange.severity === "incompatible" ? "BREAKING TYPE" : "TYPE WARNING"}
                            </span>
                          );
                        }

                        return (
                          <tr key={`exp_${exp.name}`}>
                            <td><strong>{exp.name}</strong></td>
                            <td>{currCol ? currCol.type : <span style={{ color: "#ef4444" }}>— (Not Present)</span>}</td>
                            <td>{exp.expected_type}</td>
                            <td>
                              <span className={`contract-rule-tag ${exp.is_required ? "required" : "optional"}`}>
                                {exp.is_required ? "Yes" : "No"}
                              </span>
                            </td>
                            <td>{statusBadge}</td>
                          </tr>
                        );
                      })}

                      {/* Unexpected columns */}
                      {schemaCheck.unexpected_columns?.map((unexp) => (
                        <tr key={`unexp_${unexp.column}`} style={{ background: "#fffdfa" }}>
                          <td><strong>{unexp.column}</strong></td>
                          <td>{unexp.detected_type}</td>
                          <td><span style={{ color: "#64748b" }}>— (Not Expected)</span></td>
                          <td><span className="contract-rule-tag optional">No</span></td>
                          <td>
                            <span className="contract-status-badge warning">UNEXPECTED (DRIFT)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="cleaned-customer-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              onClick={fetchSchemaCheck}
              disabled={loading}
              title="Re-run schema comparison against current dataset"
            >
              <RefreshCw size={14} className={loading ? "spin" : ""} /> Compare Schema
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              onClick={handleDownloadDiffReport}
              disabled={loading || !schemaCheck}
              title="Download full schema diff report as JSON"
            >
              <Download size={14} /> Export Diff
            </button>
          </div>

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
              title="Keep existing data contract rules without changes"
            >
              Keep Existing Schema
            </button>

            {onOpenContractValidation && (
              <button
                type="button"
                className="secondary-button"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                onClick={() => {
                  onClose();
                  onOpenContractValidation();
                }}
                title="Run full data contract validation on dataset"
              >
                <Check size={14} /> Run Validation
              </button>
            )}

            <button
              type="button"
              className="primary-button"
              style={{
                background: "#2563eb",
                borderColor: "#2563eb",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
              onClick={() => setShowConfirmAccept(true)}
              disabled={
                loading ||
                isAccepting ||
                !pipelineId ||
                (!schemaCheck?.unexpected_columns?.length &&
                  !schemaCheck?.missing_columns?.length &&
                  !schemaCheck?.type_changes?.length)
              }
              title={
                !pipelineId
                  ? "Save pipeline first to synchronize PostgreSQL contracts"
                  : "Accept incoming schema and synchronize contract rules in PostgreSQL"
              }
            >
              <GitCompare size={14} /> Accept New Schema
            </button>
          </div>
        </div>
      </div>
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
  initialPipelineId,
  onPipelineLoaded,
  onBrowsePipelines,
}) {
  const [pipelineId, setPipelineId] = useState("");
  const [name, setName] = useState("Customer Ingestion & Quality Pipeline");
  const [description, setDescription] = useState("Standardize customer demographics, drop duplicates and load to PostgreSQL");
  const [inputSource, setInputSource] = useState("current_dataset");
  const [destination, setDestination] = useState({ type: "postgres", schema: "public", table: "customers", mode: "append" });
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

  // STAGE 6: PostgreSQL Integration and Output Destination
  const [dbTables, setDbTables] = useState([]);
  const [previewModalTable, setPreviewModalTable] = useState(null);
  const [mappingValidation, setMappingValidation] = useState(null);
  const [isValidatingMapping, setIsValidatingMapping] = useState(false);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const [isLoadingOutput, setIsLoadingOutput] = useState(false);

  // STAGE 7: Pipeline Versioning Modal State
  const [versionsModalOpen, setVersionsModalOpen] = useState(false);

  // STAGE 8: Data Contract Modal & Validation State
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractRules, setContractRules] = useState([]);
  const [contractValidation, setContractValidation] = useState(null);

  // STAGE 9: Schema Change Detection Modal State
  const [schemaModalOpen, setSchemaModalOpen] = useState(false);

  const loadContractRules = async (pId) => {
    if (!pId) return;
    try {
      const res = await fetch(`${API_URL}/pipelines/${pId}/contracts`);
      if (res.ok) {
        const data = await res.json();
        setContractRules(data.rules || []);
      }
    } catch (e) {
      console.error("Failed to load contract rules:", e);
    }
  };

  useEffect(() => {
    if (pipelineId) {
      loadContractRules(pipelineId);
    }
  }, [pipelineId]);

  useEffect(() => {
    fetch(`${API_URL}/db/tables`)
      .then((res) => res.json())
      .then((data) => {
        if (data.tables) setDbTables(data.tables);
      })
      .catch(() => {});
  }, []);

  const handleTestDbConn = async () => {
    setIsTestingConn(true);
    try {
      const res = await fetch(`${API_URL}/db/status`);
      const data = await res.json();
      if (data.status === "connected") {
        setBannerMessage(`Connected to PostgreSQL database '${data.database}' at ${data.host}:${data.port} (v${data.version}).`);
      } else {
        setBannerMessage(`PostgreSQL connection failed: ${data.error || "Disconnected"}`);
      }
    } catch (e) {
      setBannerMessage(`PostgreSQL connection error: ${e.message}`);
    } finally {
      setIsTestingConn(false);
    }
  };

  const handleBrowseDbTables = async () => {
    try {
      const res = await fetch(`${API_URL}/db/tables`);
      if (res.ok) {
        const data = await res.json();
        setDbTables(data.tables || []);
        setBannerMessage(`Loaded ${data.tables?.length || 0} public PostgreSQL tables.`);
      }
    } catch (e) {
      setBannerMessage(`Could not list database tables: ${e.message}`);
    }
  };

  const handlePreviewDestinationTable = () => {
    const targetTable = destination?.table || "customers";
    setPreviewModalTable(targetTable);
  };

  const handleValidateMapping = async () => {
    setIsValidatingMapping(true);
    setMappingValidation(null);
    try {
      const sourceCols = result?.columns || (result?.records?.[0] ? Object.keys(result.records[0]) : ["id", "name", "email", "age", "city"]);
      const res = await fetch(`${API_URL}/db/validate-mapping`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_table: destination?.table || "customers",
          source_columns: sourceCols,
          schema_name: destination?.schema || "public",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMappingValidation(data.validation);
        if (data.validation.valid) {
          setBannerMessage(data.validation.notice || `Mapping valid for table '${destination?.table || "customers"}'.`);
        } else {
          setBannerMessage(`Mapping validation warnings/issues for '${destination?.table || "customers"}'.`);
        }
      }
    } catch (e) {
      setBannerMessage(`Mapping validation failed: ${e.message}`);
    } finally {
      setIsValidatingMapping(false);
    }
  };

  const handleDirectLoadOutput = async () => {
    setIsLoadingOutput(true);
    try {
      const res = await fetch(`${API_URL}/db/load-output`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          records: result?.records || null,
          table_name: destination?.table || "customers",
          schema_name: destination?.schema || "public",
          mode: destination?.mode || "append",
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Load failed");
      }
      const data = await res.json();
      setBannerMessage(data.message || `Successfully loaded ${data.rows_written} records into '${destination?.table}'.`);
      handleBrowseDbTables();
    } catch (e) {
      setBannerMessage(`Load output failed: ${e.message}`);
    } finally {
      setIsLoadingOutput(false);
    }
  };

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
    setContractRules([]);
    setContractValidation(null);
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
        loadContractRules(p.id);
        setBannerMessage(`Loaded pipeline '${p.name}'.`);
      }
    } catch (err) {
      console.error(err);
      setBannerMessage("Failed to load pipeline from database.");
    }
  };

  useEffect(() => {
    if (initialPipelineId === "NEW") {
      handleNewPipeline();
      if (onPipelineLoaded) onPipelineLoaded();
    } else if (initialPipelineId) {
      handleOpenSavedPipeline(initialPipelineId);
      if (onPipelineLoaded) onPipelineLoaded();
    }
  }, [initialPipelineId]);

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

  const handleSaveAsNewVersion = async () => {
    if (!pipelineId) {
      handleSavePipeline();
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        definition: {
          name,
          description,
          input_source: { type: inputSource },
          steps,
          destination,
          error_policy: errorPolicy,
          status: "saved",
        },
      };
      const res = await fetch(`${API_URL}/pipelines/${pipelineId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save as new version.");
      const data = await res.json();
      setVersion(data.version);
      setStatus("saved");
      setBannerMessage(data.message || `Saved pipeline as new Version ${data.version}.`);
      loadSavedPipelines();
    } catch (err) {
      setBannerMessage(err.message || "Failed to save version.");
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
      if (data.status === "failed") {
        setBannerMessage(`Execution halted: ${data.error_message || data.destination_status || "Step error encountered."}`);
      } else {
        setBannerMessage(data.destination_status || "Pipeline executed successfully.");
      }
      loadSavedPipelines();
    } catch (err) {
      console.error(err);
      setBannerMessage(`Execution failed: ${err.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRetryExecution = async (runId) => {
    setIsExecuting(true);
    try {
      const res = await fetch(`${API_URL}/pipelines/runs/${runId || executionResult?.run_id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_id: pipelineId || undefined,
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
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Retry execution failed");
      }

      const data = await res.json();
      setExecutionResult(data);
      setExecModalOpen(true);
      if (data.status === "failed") {
        setBannerMessage(`Retry run stopped on error: ${data.error_message || data.destination_status || "Execution failed"}`);
      } else {
        setBannerMessage(data.destination_status || `Pipeline rerun completed with status: ${data.status}`);
      }
      loadSavedPipelines();
    } catch (err) {
      console.error(err);
      setBannerMessage(`Retry failed: ${err.message}`);
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

        {/* OUTPUT DESTINATION CONFIGURATION (STAGE 6 - FEATURE 5) */}
        <div className="destination-config-panel">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Server size={17} color="#2563eb" />
              <strong style={{ fontSize: "14px", color: "#0f172a" }}>Output Configuration</strong>
            </div>
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              Target: {destination.type === "postgres" ? `PostgreSQL (${destination.schema || "public"}.${destination.table || "customers"} • ${destination.mode === "replace" ? "Replace" : "Append"})` : "CSV Download"}
            </span>
          </div>

          <div className="pipeline-config-grid">
            <div className="pipeline-form-group">
              <label>Destination Target</label>
              <select
                className="pipeline-form-select"
                value={destination.type || "postgres"}
                onChange={(e) => {
                  setDestination({ ...destination, type: e.target.value });
                  setStatus("draft");
                }}
              >
                <option value="postgres">PostgreSQL Relational Table</option>
                <option value="csv">CSV File Stream / Download</option>
              </select>
            </div>

            {destination.type === "postgres" && (
              <>
                <div className="pipeline-form-group">
                  <label>Allowed Schema</label>
                  <input
                    type="text"
                    className="pipeline-form-input"
                    value={destination.schema || "public"}
                    onChange={(e) => {
                      setDestination({ ...destination, schema: e.target.value });
                      setStatus("draft");
                    }}
                    placeholder="public"
                  />
                </div>

                <div className="pipeline-form-group">
                  <label>Destination Table</label>
                  <input
                    type="text"
                    className="pipeline-form-input"
                    value={destination.table || "customers"}
                    onChange={(e) => {
                      setDestination({ ...destination, table: e.target.value });
                      setStatus("draft");
                    }}
                    placeholder="e.g. customers, pipeline_output"
                    list="available-db-tables"
                  />
                  <datalist id="available-db-tables">
                    {dbTables.map((t) => (
                      <option key={t.name} value={t.name}>{t.name} ({t.row_count} rows)</option>
                    ))}
                  </datalist>
                </div>

                <div className="pipeline-form-group">
                  <label>Write Mode</label>
                  <select
                    className="pipeline-form-select"
                    value={destination.mode || "append"}
                    onChange={(e) => {
                      setDestination({ ...destination, mode: e.target.value });
                      setStatus("draft");
                    }}
                  >
                    <option value="append">Append (Insert new records)</option>
                    <option value="replace">Replace (Truncate & overwrite table)</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* MAPPING VALIDATION NOTICE IF APPLICABLE */}
          {mappingValidation && (
            <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "6px", background: mappingValidation.valid ? "#f0fdf4" : "#fef2f2", border: `1px solid ${mappingValidation.valid ? "#bbf7d0" : "#fecaca"}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: mappingValidation.valid ? "#166534" : "#991b1b" }}>
                {mappingValidation.valid ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                <span>
                  {mappingValidation.table_exists
                    ? `Destination table '${destination.table}' verified with ${mappingValidation.target_columns?.length || 0} columns.`
                    : `Notice: Table '${destination.table}' does not exist yet; FlowForge will auto-create it with matching column types upon load.`}
                </span>
              </div>
              {mappingValidation.errors?.length > 0 && (
                <ul style={{ margin: "6px 0 0", paddingLeft: "20px", fontSize: "12px", color: "#b91c1c" }}>
                  {mappingValidation.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
              {mappingValidation.warnings?.length > 0 && (
                <div style={{ marginTop: "4px", fontSize: "12px", color: "#b45309" }}>
                  <strong>Warnings:</strong> {mappingValidation.warnings.join("; ")}
                </div>
              )}
            </div>
          )}

          {/* STAGE 6 BUTTONS */}
          <div className="destination-actions-row">
            <button
              type="button"
              className="secondary-button"
              onClick={handleTestDbConn}
              disabled={isTestingConn}
            >
              <Server size={14} /> {isTestingConn ? "Testing..." : "Test Connection"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleBrowseDbTables}
            >
              <Database size={14} /> Browse Tables {dbTables.length > 0 ? `(${dbTables.length})` : ""}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviewDestinationTable}
            >
              <Eye size={14} /> Preview Table
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handleValidateMapping}
              disabled={isValidatingMapping}
            >
              <FileCheck2 size={14} /> {isValidatingMapping ? "Validating..." : "Validate Mapping"}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={handleDirectLoadOutput}
              disabled={isLoadingOutput}
            >
              <Database size={14} /> {isLoadingOutput ? "Loading..." : "Load Output"}
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={handlePreviewDestinationTable}
            >
              <Activity size={14} /> View Loaded Data
            </button>
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
            <button
              type="button"
              className="secondary-button"
              onClick={handleSaveAsNewVersion}
              disabled={isSaving || !pipelineId}
              title="Save current state as a new version"
            >
              <GitBranch size={15} /> Save as New Version
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setVersionsModalOpen(true)}
              disabled={!pipelineId}
              title="View version history and restore previous versions"
            >
              <Clock size={15} /> Version History (v{version || 1})
            </button>
            {onBrowsePipelines && (
              <button
                type="button"
                className="secondary-button"
                onClick={onBrowsePipelines}
                title="Browse all saved pipelines"
              >
                <Folder size={15} /> Saved Pipelines
              </button>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setContractModalOpen(true)}
              title="Validate input dataset schema and quality contracts before transformations run"
            >
              <FileCheck2 size={15} /> Validate Input (Data Contract)
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => setSchemaModalOpen(true)}
              title="Compare incoming schema against expected contract schema and detect drift"
            >
              <GitCompare size={15} /> Schema Check
            </button>
          </div>

          <div className="pipeline-actions-right">
            {executionResult && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setExecModalOpen(true)}
                title="View results of previous pipeline run"
              >
                <Activity size={15} /> Run #{executionResult.run_id ? executionResult.run_id.slice(-6) : "Last"}: {executionResult.status?.toUpperCase()}
              </button>
            )}
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

      {/* INPUT DATA CONTRACT PANEL (STAGE 8 - FEATURE 7) */}
      <div className="contract-workbench-panel">
        <div className="contract-workbench-header">
          <div>
            <h4 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 4px 0", fontSize: "14px", color: "#1e293b" }}>
              <FileCheck2 size={16} color="#2563eb" />
              Input Data Contract
              {contractRules.length > 0 && (
                <span className="pipeline-version-badge" style={{ background: "#f1f5f9", color: "#475569" }}>
                  {contractRules.length} rule{contractRules.length !== 1 ? "s" : ""}
                </span>
              )}
              {contractValidation && (
                <span className={`contract-status-badge ${contractValidation.status}`}>
                  {contractValidation.status.toUpperCase()}
                </span>
              )}
            </h4>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Validate input dataset schema, required columns, expected types, nullability, uniqueness, and value bounds before transformations execute.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              onClick={() => setSchemaModalOpen(true)}
              title="Detect schema drift and check compatibility"
            >
              <GitCompare size={13} /> Schema Check
            </button>
            <button
              type="button"
              className="secondary-button"
              style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              onClick={() => setContractModalOpen(true)}
            >
              <Sliders size={13} /> Rules ({contractRules.length})
            </button>
            <button
              type="button"
              className="primary-button"
              style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              onClick={() => setContractModalOpen(true)}
            >
              <Check size={13} /> Validate Input
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

      {/* PIPELINE EXECUTION MODAL (STAGE 5) */}
      <PipelineExecutionModal
        isOpen={execModalOpen}
        onClose={() => setExecModalOpen(false)}
        executionResult={executionResult}
        pipelineName={name}
        onRetry={handleRetryExecution}
        isRetrying={isExecuting}
      />

      {/* TABLE PREVIEW MODAL (STAGE 6 - FEATURE 5) */}
      <TablePreviewModal
        isOpen={Boolean(previewModalTable)}
        onClose={() => setPreviewModalTable(null)}
        tableName={previewModalTable}
        schema={destination.schema || "public"}
      />

      {/* PIPELINE VERSION HISTORY MODAL (STAGE 7 - FEATURE 6) */}
      <PipelineVersionsModal
        isOpen={versionsModalOpen}
        pipelineId={pipelineId}
        pipelineName={name}
        currentVersion={version || 1}
        onClose={() => setVersionsModalOpen(false)}
        onRestoreSuccess={(res) => {
          if (res.pipeline) {
            setVersion(res.new_version || res.pipeline.version);
            setSteps(res.pipeline.steps || []);
            setName(res.pipeline.name || name);
            setDescription(res.pipeline.description || description);
            if (res.pipeline.destination) setDestination(res.pipeline.destination);
            if (res.pipeline.error_policy) setErrorPolicy(res.pipeline.error_policy);
            if (res.pipeline.status) setStatus(res.pipeline.status);
            setBannerMessage(res.message || `Restored pipeline to new Version ${res.new_version}.`);
          }
          loadSavedPipelines();
        }}
      />

      {/* DATA CONTRACT MODAL (STAGE 8 - FEATURE 7) */}
      <DataContractModal
        isOpen={contractModalOpen}
        onClose={() => setContractModalOpen(false)}
        pipelineId={pipelineId}
        pipelineName={name}
        availableColumns={availableColumns}
        records={result?.records}
        errorPolicy={errorPolicy}
        onRulesUpdated={(updatedRules) => {
          setContractRules(updatedRules);
        }}
        onContinueExecution={() => {
          handleExecuteWorkflow();
        }}
      />

      {/* SCHEMA CHANGE DETECTION MODAL (STAGE 9 - FEATURE 8) */}
      <SchemaCheckModal
        isOpen={schemaModalOpen}
        onClose={() => setSchemaModalOpen(false)}
        pipelineId={pipelineId}
        pipelineName={name}
        records={result?.records}
        contractRules={contractRules}
        onSchemaAccepted={(updatedContracts) => {
          if (pipelineId) {
            loadContractRules(pipelineId);
          }
        }}
        onOpenContractValidation={() => {
          setContractModalOpen(true);
        }}
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
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [previewModalTable, setPreviewModalTable] = useState(null);
  const [tableFilter, setTableFilter] = useState("");

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/db/status`);
      if (res.ok) {
        const data = await res.json();
        setDbStatus(data);
        return data;
      }
    } catch {
      setDbStatus({ status: "disconnected" });
    }
  };

  const fetchTables = async () => {
    setLoadingTables(true);
    try {
      const res = await fetch(`${API_URL}/db/tables`);
      if (res.ok) {
        const data = await res.json();
        setTables(data.tables || []);
      }
    } catch (err) {
      console.error("Failed to fetch tables", err);
    } finally {
      setLoadingTables(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API_URL}/db/test-connection`, { method: "POST" });
      const data = await res.json();
      setDbStatus(data);
      if (data.status === "connected") {
        setTestResult({
          type: "success",
          message: `Connected successfully to PostgreSQL '${data.database}' at ${data.host}:${data.port} (User: ${data.user}, Version: ${data.version})`,
        });
        fetchTables();
      } else {
        setTestResult({
          type: "error",
          message: `Connection failed: ${data.error || "Unable to reach database"}`,
        });
      }
    } catch (err) {
      setTestResult({
        type: "error",
        message: `Network error: ${err.message}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([fetchStatus(), fetchTables()]);
  };

  useEffect(() => {
    fetchStatus();
    fetchTables();
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

  const filteredTables = tables.filter((t) =>
    t.name.toLowerCase().includes(tableFilter.trim().toLowerCase())
  );

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
          label="TABLES"
          value={tables.length ? `${tables.length} tables` : (dbLoadResult?.records_loaded ?? "—")}
          description="Public schema catalog"
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
          description="Safe connection metadata and database operations"
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
                ? `Connected to database '${dbStatus.database}' at ${dbStatus.host}:${dbStatus.port} as user '${dbStatus.user}'. Engine: ${dbStatus.version || "PostgreSQL"}.`
                : "Database connectivity has not been verified in this session. Configure .env and click Test Connection to verify."}
            </p>

            <div className="database-tags">
              <span>PostgreSQL</span>
              <span>DB: {dbStatus?.database || "flowforge"}</span>
              <span>Host: {dbStatus?.host || "localhost"}:{dbStatus?.port || 5432}</span>
              <span>User: {dbStatus?.user || "postgres"}</span>
              <span>Status: {isConnected ? "Connected" : "Disconnected"}</span>
              <span>{file?.name || "No dataset selected"}</span>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "14px" }}>
              <button
                type="button"
                className="primary-button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                style={{ fontSize: "12px", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Activity size={14} className={testingConnection ? "spin" : ""} />
                {testingConnection ? "Testing Connection..." : "Test Connection"}
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  document.getElementById("available-tables-section")?.scrollIntoView({ behavior: "smooth" });
                }}
                style={{ fontSize: "12px", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Database size={14} />
                Browse Tables
              </button>

              <button
                type="button"
                className="secondary-button"
                onClick={handleRefresh}
                style={{ fontSize: "12px", padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <RefreshCw size={14} className={loadingTables ? "spin" : ""} />
                Refresh
              </button>

              <button
                type="button"
                className="secondary-button datamedic-mysql-load-button"
                onClick={loadToPostgres}
                disabled={!file}
                style={{ fontSize: "12px", padding: "8px 14px", marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <UploadCloud size={14} />
                Load Data
              </button>
            </div>

          </div>

        </div>

        {testResult && (
          <div
            className={`notification ${testResult.type === "success" ? "notification-success" : "notification-error"}`}
            style={{
              margin: "14px 0 0 0",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "10px 14px",
              borderRadius: "6px",
              background: testResult.type === "success" ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${testResult.type === "success" ? "#bbf7d0" : "#fecaca"}`,
              color: testResult.type === "success" ? "#166534" : "#991b1b",
            }}
          >
            {testResult.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <span style={{ fontSize: "13px" }}>{testResult.message}</span>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "16px" }}
            >
              ×
            </button>
          </div>
        )}

      </div>

      {/* =====================================================
          AVAILABLE TABLES SECTION
      ===================================================== */}

      <div id="available-tables-section" className="panel" style={{ marginTop: "20px" }}>

        <PanelHeader
          title="Available Tables"
          description="Public schema tables, record counts, and column definitions"
          icon={Server}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", gap: "10px", flexWrap: "wrap" }}>
          <div className="cleaned-search-box" style={{ maxWidth: "320px", margin: 0 }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Search tables..."
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            />
          </div>
          <div style={{ fontSize: "12px", color: "#64748b" }}>
            {tables.length} table{tables.length !== 1 ? "s" : ""} registered in public schema
          </div>
        </div>

        {loadingTables ? (
          <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
            Scanning PostgreSQL tables...
          </div>
        ) : filteredTables.length > 0 ? (
          <div className="db-tables-grid">
            {filteredTables.map((tbl) => (
              <div key={tbl.name} className="db-table-card">
                <div>
                  <div className="db-table-card-header">
                    <span className="db-table-card-title">
                      <Database size={15} color="#2563eb" />
                      {tbl.name}
                    </span>
                    <span className="db-table-badge">
                      {tbl.row_count.toLocaleString()} rows
                    </span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#64748b", margin: "6px 0 12px 0", lineHeight: "1.4" }}>
                    {tbl.columns.length} columns: {tbl.columns.slice(0, 4).map((c) => c.name).join(", ")}{tbl.columns.length > 4 ? "..." : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ width: "100%", justifyContent: "center", padding: "6px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  onClick={() => setPreviewModalTable(tbl.name)}
                >
                  <Eye size={14} /> Preview Table
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="cleaned-no-results">
            <Database size={28} />
            <h3>No tables found</h3>
            <p>{tableFilter ? "No tables match your search filter." : "No tables exist yet in the public schema."}</p>
          </div>
        )}

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

      {/* Table Preview Modal */}
      <TablePreviewModal
        isOpen={!!previewModalTable}
        tableName={previewModalTable}
        schema="public"
        onClose={() => setPreviewModalTable(null)}
      />

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