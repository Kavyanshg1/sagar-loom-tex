import { useEffect, useMemo, useRef, useState } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { ConfirmationModal } from "./components/ConfirmationModal";
import { EntryModal } from "./components/EntryModal";
import { RecordsTable } from "./components/RecordsTable";
import { SectionCard } from "./components/SectionCard";
import { StatCard } from "./components/StatCard";
import { TabButton } from "./components/TabButton";
import { UploadPanel } from "./components/UploadPanel";
import logo from "./assets/logo.png";
import { api } from "./lib/api";

const tabs = [
  "Manglam Yarn Agencies",
  "Shubham Syncotex",
  "Sai Leela Processors",
  "Sagar Loom Tex (Direct from Shubham)",
];

const exportOptions = [
  { label: "Past Week", value: "week" },
  { label: "Past Month", value: "month" },
  { label: "Past Year", value: "year" },
  { label: "Lifetime", value: "lifetime" },
  { label: "Custom Date Range", value: "custom" },
];

const processingFields = [
  { name: "date", label: "Date", type: "date" },
  { name: "challan_number", label: "Challan Number" },
  { name: "yarn_consumed_kg", label: "Yarn Consumed (kg)", type: "number" },
  { name: "wastage_kg", label: "Wastage (kg)", type: "number", readOnly: true },
  { name: "fabric_produced_meters", label: "Fabric Produced (m)", type: "number" },
  { name: "yarn_balance_kg", label: "Yarn Balance (kg)", type: "number", readOnly: true },
];

const processingColumns = [
  { key: "date", label: "Date" },
  { key: "challan_number", label: "Challan #" },
  { key: "yarn_consumed_kg", label: "Consumed (kg)" },
  { key: "wastage_kg", label: "Wastage (kg)" },
  { key: "fabric_produced_meters", label: "Fabric (m)" },
  { key: "yarn_balance_kg", label: "Yarn Balance (kg)" },
];

const config = {
  "Manglam Yarn Agencies": {
    title: "Manglam Yarn Agencies",
    endpoint: "createYarnPurchase",
    resourcePath: "/yarn-purchases",
    recordsKey: "yarn_purchases",
    documentType: "yarn",
    uploadTitle: "Invoice OCR Preview",
    searchKey: "invoice_number",
    summaryLabel: "Total yarn purchased",
    fields: [
      { name: "date", label: "Date", type: "date" },
      { name: "invoice_number", label: "Invoice Number" },
      { name: "yarn_weight_kg", label: "Yarn Weight (kg)", type: "number" },
      { name: "notes", label: "Notes" },
    ],
    tableColumns: [
      { key: "date", label: "Date" },
      { key: "invoice_number", label: "Invoice #" },
      { key: "yarn_weight_kg", label: "Yarn (kg)" },
      { key: "notes", label: "Notes" },
      { key: "created_at", label: "Logged At" },
    ],
    emptyMessage: "No yarn purchase records yet.",
  },
  "Shubham Syncotex": {
    title: "Shubham Syncotex",
    endpoint: "createProcessingRecord",
    resourcePath: "/processing-records",
    recordsKey: "processing_records",
    documentType: "processing",
    uploadTitle: "Processing Challan OCR Preview",
    searchKey: "challan_number",
    summaryLabel: "Fabric sent to Sai Leela",
    fields: processingFields,
    tableColumns: processingColumns,
    emptyMessage: "No processing records yet.",
  },
  "Sai Leela Processors": {
    title: "Sai Leela Processors",
    endpoint: "createDyeingRecord",
    resourcePath: "/dyeing-records",
    recordsKey: "dyeing_records",
    documentType: "dyeing",
    uploadTitle: "Dyeing Challan OCR Preview",
    searchKey: "challan_number",
    summaryLabel: "Fabric balance",
    fields: [
      { name: "date", label: "Date", type: "date" },
      { name: "challan_number", label: "Challan Number" },
      { name: "fabric_dyed_meters", label: "Fabric Dyed (m)", type: "number" },
    ],
    tableColumns: [
      { key: "date", label: "Date" },
      { key: "challan_number", label: "Challan #" },
      { key: "fabric_dyed_meters", label: "Fabric Dyed (m)" },
      { key: "balance_meters", label: "Balance (m)" },
    ],
    emptyMessage: "No dyeing records yet.",
  },
  "Sagar Loom Tex (Direct from Shubham)": {
    title: "Sagar Loom Tex (Direct from Shubham)",
    endpoint: "createDirectProcessingRecord",
    resourcePath: "/direct-processing-records",
    recordsKey: "direct_processing_records",
    documentType: "processing",
    uploadTitle: "Direct Transfer Challan OCR Preview",
    searchKey: "challan_number",
    summaryLabel: "Direct fabric received",
    fields: processingFields,
    tableColumns: processingColumns,
    emptyMessage: "No direct transfer records yet.",
  },
};

const stockFields = [
  { name: "yarn_kg", label: "Initial Yarn Stock at Shubham (kg)", type: "number" },
  { name: "fabric_meters", label: "Initial Fabric Stock at Sai Leela (meters)", type: "number" },
];

const passwordFields = [
  { name: "new_password", label: "New Password", type: "password" },
  { name: "confirm_password", label: "Confirm Password", type: "password" },
];

function createDefaultValues() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    "Manglam Yarn Agencies": {
      date: today,
      invoice_number: "",
      yarn_weight_kg: "",
      notes: "",
    },
    "Shubham Syncotex": {
      date: today,
      challan_number: "",
      yarn_consumed_kg: "",
      wastage_kg: "",
      fabric_produced_meters: "",
      yarn_balance_kg: "",
    },
    "Sai Leela Processors": {
      date: today,
      challan_number: "",
      fabric_dyed_meters: "",
    },
    "Sagar Loom Tex (Direct from Shubham)": {
      date: today,
      challan_number: "",
      yarn_consumed_kg: "",
      wastage_kg: "",
      fabric_produced_meters: "",
      yarn_balance_kg: "",
    },
  };
}

function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function formatMetric(value, unit) {
  const numericValue = Number(value || 0);
  return `${numericValue.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })} ${unit}`;
}

function pickFormValues(tab, record) {
  const base = createDefaultValues()[tab];
  const nextValues = { ...base };
  config[tab].fields.forEach((field) => {
    nextValues[field.name] = record[field.name] ?? base[field.name] ?? "";
  });
  return nextValues;
}

function FlowNode({ active, label, subtitle, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[26px] border p-5 text-left shadow-sm transition duration-200 ${
        active
          ? "border-ink bg-ink text-white shadow-float"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      }`}
    >
      <div className="text-lg font-bold">{label}</div>
      <div className={`mt-2 text-sm ${active ? "text-slate-200" : "text-slate-500"}`}>
        {subtitle}
      </div>
    </button>
  );
}

export default function App() {
  const [authResolved, setAuthResolved] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authUser, setAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authBootstrap, setAuthBootstrap] = useState({ user_count: 0 });
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [records, setRecords] = useState({
    yarn_purchases: [],
    processing_records: [],
    direct_processing_records: [],
    dyeing_records: [],
    admin: {
      initial_yarn_stock_kg: 0,
      initial_fabric_stock_meters: 0,
      password_set: false,
    },
    current_user: null,
    dashboard: {
      yarn_with_shubham_kg: 0,
      fabric_with_sai_meters: 0,
      logged_fabric_balance_meters: 0,
      fabric_sent_direct_to_sagar_meters: 0,
      shubham_remaining_fabric_meters: 0,
      flow_summary: {
        manglam: { total_yarn_purchased_kg: 0 },
        shubham: {
          yarn_balance_kg: 0,
          fabric_produced_meters: 0,
          fabric_sent_to_sai_meters: 0,
          fabric_sent_direct_meters: 0,
          remaining_fabric_meters: 0,
        },
        sai: {
          fabric_received_meters: 0,
          fabric_dyed_meters: 0,
          balance_meters: 0,
        },
        sagar: { fabric_received_direct_meters: 0 },
      },
    },
  });
  const [formState, setFormState] = useState(createDefaultValues);
  const [previewState, setPreviewState] = useState({
    yarn: null,
    processing: null,
    dyeing: null,
  });
  const [fieldConfidenceState, setFieldConfidenceState] = useState(
    Object.fromEntries(tabs.map((tab) => [tab, {}])),
  );
  const [selectedRecords, setSelectedRecords] = useState(
    Object.fromEntries(tabs.map((tab) => [tab, []])),
  );
  const [searchState, setSearchState] = useState(
    Object.fromEntries(tabs.map((tab) => [tab, ""])),
  );
  const [sortState, setSortState] = useState(
    Object.fromEntries(tabs.map((tab) => [tab, "desc"])),
  );
  const [activeFlowNode, setActiveFlowNode] = useState("shubham");
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [adminModal, setAdminModal] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminForm, setAdminForm] = useState({
    yarn_kg: "",
    fabric_meters: "",
    new_password: "",
    confirm_password: "",
    clear_password: "",
  });
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteState, setDeleteState] = useState({ open: false, ids: [] });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [exportRange, setExportRange] = useState("month");
  const [customRange, setCustomRange] = useState({ start_date: "", end_date: "" });
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const adminMenuRef = useRef(null);

  const currentConfig = config[activeTab];
  const currentSelectedIds = selectedRecords[activeTab];

  async function loadAuthStatus() {
    const data = await api.getAuthStatus();
    setAuthBootstrap(data);
    if (data.user_count === 0) {
      setAuthMode("signup");
    }
  }

  async function loadRecords() {
    const data = await api.getRecords();
    setRecords(data);
  }

  async function bootstrapAuth() {
    try {
      await loadAuthStatus();
      if (!api.getAuthToken()) {
        return;
      }
      const data = await api.getCurrentUser();
      setAuthUser(data.user);
    } catch (requestError) {
      api.clearAuthToken();
      setAuthUser(null);
    } finally {
      setAuthResolved(true);
    }
  }

  useEffect(() => {
    bootstrapAuth();
  }, []);

  useEffect(() => {
    if (!authResolved || !authUser) {
      return;
    }
    loadRecords().catch((requestError) => {
      if (requestError.status === 401) {
        api.clearAuthToken();
        setAuthUser(null);
        setError("");
        return;
      }
      setError(requestError.message);
    });
  }, [authResolved, authUser]);

  useEffect(() => {
    function handleDocumentClick(event) {
      if (!adminMenuRef.current?.contains(event.target)) {
        setShowAdminMenu(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, []);

  const tableRows = useMemo(() => {
    const rows = records[currentConfig.recordsKey] ?? [];
    const searchTerm = searchState[activeTab].trim().toLowerCase();
    const filteredRows = rows.filter((row) => {
      if (!searchTerm) {
        return true;
      }
      return String(row[currentConfig.searchKey] ?? "").toLowerCase().includes(searchTerm);
    });

    return [...filteredRows].sort((left, right) => {
      const leftDate = new Date(left.date).getTime();
      const rightDate = new Date(right.date).getTime();
      if (leftDate === rightDate) {
        return sortState[activeTab] === "asc" ? left.id - right.id : right.id - left.id;
      }
      return sortState[activeTab] === "asc" ? leftDate - rightDate : rightDate - leftDate;
    });
  }, [activeTab, currentConfig.recordsKey, currentConfig.searchKey, records, searchState, sortState]);

  const currentSelectedRows = tableRows.filter((row) => currentSelectedIds.includes(row.id));

  function getCurrentFormValues(tab = activeTab) {
    const rawValues = formState[tab];
    if (tab !== "Shubham Syncotex" && tab !== "Sagar Loom Tex (Direct from Shubham)") {
      return rawValues;
    }

    const yarnConsumed = Number(rawValues.yarn_consumed_kg || 0);
    const wastage = yarnConsumed ? roundToTwo(yarnConsumed * 0.04) : "";
    const baseYarnBalance =
      editingRecordId && rawValues.yarn_balance_kg !== ""
        ? rawValues.yarn_balance_kg
        : yarnConsumed
          ? roundToTwo(records.dashboard.yarn_with_shubham_kg - yarnConsumed - Number(wastage || 0))
          : "";

    return {
      ...rawValues,
      wastage_kg: wastage,
      yarn_balance_kg: baseYarnBalance,
    };
  }

  function resetFormForTab(tab) {
    setFormState((current) => ({
      ...current,
      [tab]: createDefaultValues()[tab],
    }));
    setFieldConfidenceState((current) => ({
      ...current,
      [tab]: {},
    }));
  }

  function clearSelection(tab, idsToRemove = null) {
    setSelectedRecords((current) => ({
      ...current,
      [tab]:
        idsToRemove === null
          ? []
          : current[tab].filter((id) => !idsToRemove.includes(id)),
    }));
  }

  function openCreateModal() {
    setEditingRecordId(null);
    resetFormForTab(activeTab);
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(record) {
    setEditingRecordId(record.id);
    setFormState((current) => ({
      ...current,
      [activeTab]: pickFormValues(activeTab, record),
    }));
    setFieldConfidenceState((current) => ({
      ...current,
      [activeTab]: {},
    }));
    setError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingRecordId(null);
    setError("");
  }

  function openDeleteModal(ids) {
    setDeleteState({ open: true, ids });
    setError("");
  }

  function closeDeleteModal() {
    setDeleteState({ open: false, ids: [] });
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({
      ...current,
      [activeTab]: {
        ...current[activeTab],
        [name]: value,
      },
    }));
  }

  function handleSearchChange(event) {
    const { value } = event.target;
    setSearchState((current) => ({
      ...current,
      [activeTab]: value,
    }));
  }

  function toggleSortDirection() {
    setSortState((current) => ({
      ...current,
      [activeTab]: current[activeTab] === "asc" ? "desc" : "asc",
    }));
  }

  function handleCustomDateChange(event) {
    const { name, value } = event.target;
    setCustomRange((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAdminFormChange(event) {
    const { name, value } = event.target;
    setAdminForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAuthChange(event) {
    const { name, value } = event.target;
    setAuthForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAuthModeChange(mode) {
    setAuthMode(mode);
    setAuthError("");
  }

  function handleApiError(requestError, setter = setError) {
    if (requestError.status === 401) {
      handleLogout();
      setter("Your session expired. Please log in again.");
      return;
    }
    setter(requestError.message);
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    try {
      let response;
      if (authMode === "signup") {
        if (!authForm.name.trim()) {
          throw new Error("Enter your name.");
        }
        if (authForm.password !== authForm.confirm_password) {
          throw new Error("Passwords do not match.");
        }
        response = await api.signup({
          name: authForm.name,
          email: authForm.email,
          password: authForm.password,
        });
      } else {
        response = await api.login({
          email: authForm.email,
          password: authForm.password,
        });
      }

      api.setAuthToken(response.access_token);
      setAuthUser(response.user);
      setAuthForm({
        name: "",
        email: "",
        password: "",
        confirm_password: "",
      });
      await loadAuthStatus();
    } catch (requestError) {
      setAuthError(requestError.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    api.clearAuthToken();
    setAuthUser(null);
    setShowAdminMenu(false);
    setShowExportPanel(false);
    setError("");
    setAuthMode("login");
  }

  function openAdminModal(type) {
    setShowAdminMenu(false);
    setAdminError("");
    setAdminMessage("");
    if (type === "stock") {
      setAdminForm((current) => ({
        ...current,
        yarn_kg: String(records.admin?.initial_yarn_stock_kg ?? 0),
        fabric_meters: String(records.admin?.initial_fabric_stock_meters ?? 0),
      }));
    }
    if (type === "password") {
      setAdminForm((current) => ({
        ...current,
        new_password: "",
        confirm_password: "",
      }));
    }
    if (type === "clear") {
      setAdminForm((current) => ({
        ...current,
        clear_password: "",
      }));
    }
    setAdminModal(type);
  }

  function closeAdminModal() {
    setAdminModal(null);
    setAdminError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");

    try {
      const payload = getCurrentFormValues();
      if (editingRecordId) {
        await api.updateRecord(currentConfig.resourcePath, editingRecordId, payload);
      } else {
        await api[currentConfig.endpoint](payload);
      }

      await loadRecords();
      clearSelection(activeTab);
      resetFormForTab(activeTab);
      setPreviewState((current) => ({
        ...current,
        [currentConfig.documentType]: null,
      }));
      setFieldConfidenceState((current) => ({
        ...current,
        [activeTab]: {},
      }));
      closeModal();
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    setDeleting(true);
    setError("");

    try {
      await Promise.all(
        deleteState.ids.map((id) => api.deleteRecord(currentConfig.resourcePath, id)),
      );
      await loadRecords();
      clearSelection(activeTab, deleteState.ids);
      closeDeleteModal();
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpload(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_type", currentConfig.documentType);
      const response = await api.uploadDocument(formData);
      setPreviewState((current) => ({
        ...current,
        [currentConfig.documentType]: response,
      }));
      setFormState((current) => ({
        ...current,
        [activeTab]: {
          ...createDefaultValues()[activeTab],
          ...response.detected_fields,
        },
      }));
      setFieldConfidenceState((current) => ({
        ...current,
        [activeTab]: response.confidence ?? {},
      }));
      setEditingRecordId(null);
      setIsModalOpen(true);
    } catch (requestError) {
      handleApiError(requestError, setUploadError);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  function usePreviewData() {
    const preview = previewState[currentConfig.documentType];
    if (!preview) {
      return;
    }

    setEditingRecordId(null);
    setFormState((current) => ({
      ...current,
      [activeTab]: {
        ...createDefaultValues()[activeTab],
        ...preview.detected_fields,
      },
    }));
    setFieldConfidenceState((current) => ({
      ...current,
      [activeTab]: preview.confidence ?? {},
    }));
    setIsModalOpen(true);
  }

  function handleSelectRecord(row) {
    setSelectedRecords((current) => ({
      ...current,
      [activeTab]: current[activeTab].includes(row.id)
        ? current[activeTab]
        : [...current[activeTab], row.id],
    }));
  }

  function handleEditSelected() {
    if (currentSelectedRows.length !== 1) {
      return;
    }
    openEditModal(currentSelectedRows[0]);
  }

  async function handleExportPdf() {
    setExporting(true);
    setError("");

    try {
      const params = new URLSearchParams({ range_type: exportRange });
      if (exportRange === "custom") {
        if (!customRange.start_date || !customRange.end_date) {
          throw new Error("Select both start and end dates for a custom PDF export.");
        }
        params.set("start_date", customRange.start_date);
        params.set("end_date", customRange.end_date);
      }

      const blob = await api.exportPdf(params.toString());
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `textile-production-report-${exportRange}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setShowExportPanel(false);
    } catch (requestError) {
      handleApiError(requestError);
    } finally {
      setExporting(false);
    }
  }

  async function handleSetInitialStock(event) {
    event.preventDefault();
    setAdminLoading(true);
    setAdminError("");

    try {
      await api.setInitialStock({
        yarn_kg: Number(adminForm.yarn_kg || 0),
        fabric_meters: Number(adminForm.fabric_meters || 0),
      });
      await loadRecords();
      setAdminMessage("Starting stock updated successfully.");
      closeAdminModal();
    } catch (requestError) {
      handleApiError(requestError, setAdminError);
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleSetPassword(event) {
    event.preventDefault();
    setAdminLoading(true);
    setAdminError("");

    try {
      if (!adminForm.new_password) {
        throw new Error("Enter a new password.");
      }
      if (adminForm.new_password !== adminForm.confirm_password) {
        throw new Error("Passwords do not match.");
      }

      await api.setPassword({ password: adminForm.new_password });
      await loadRecords();
      setAdminMessage("Admin password saved successfully.");
      closeAdminModal();
    } catch (requestError) {
      handleApiError(requestError, setAdminError);
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleClearAllData() {
    setAdminLoading(true);
    setAdminError("");

    try {
      if (!adminForm.clear_password) {
        throw new Error("Enter the admin password to clear all data.");
      }

      await api.clearAllData({ password: adminForm.clear_password });
      await loadRecords();
      setSelectedRecords(Object.fromEntries(tabs.map((tab) => [tab, []])));
      setPreviewState({ yarn: null, processing: null, dyeing: null });
      setAdminMessage("All record data cleared successfully.");
      closeAdminModal();
    } catch (requestError) {
      handleApiError(requestError, setAdminError);
    } finally {
      setAdminLoading(false);
    }
  }

  if (!authResolved) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-6 text-ink">
        <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-5 shadow-float">
          <div className="text-sm font-semibold text-slate-500">Checking secure session...</div>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={handleAuthModeChange}
        values={authForm}
        onChange={handleAuthChange}
        onSubmit={handleAuthSubmit}
        loading={authLoading}
        error={authError}
        userCount={authBootstrap.user_count ?? 0}
      />
    );
  }

  const autoInsightMap = {
    "Manglam Yarn Agencies":
      "Every yarn purchase immediately increases the live yarn balance at Shubham Syncotex.",
    "Shubham Syncotex":
      "These records represent Shubham fabric routed to Sai Leela. Wastage stays at 4%, and yarn balance is shared across both Shubham outflows.",
    "Sai Leela Processors":
      "Sai Leela receives unfinished fabric from Shubham processing records only, while balance is total received minus dyed meters.",
    "Sagar Loom Tex (Direct from Shubham)":
      "Direct challans mirror Shubham processing fields and draw from the same yarn balance while routing fabric straight to Sagar Loom Tex.",
  };

  const flowSummary = records.dashboard.flow_summary;
  const flowNodeDetails = {
    manglam: [
      `Total yarn purchased: ${formatMetric(flowSummary.manglam.total_yarn_purchased_kg, "kg")}`,
    ],
    shubham: [
      `Yarn balance: ${formatMetric(flowSummary.shubham.yarn_balance_kg, "kg")}`,
      `Fabric produced: ${formatMetric(flowSummary.shubham.fabric_produced_meters, "m")}`,
      `Remaining balance: ${formatMetric(flowSummary.shubham.remaining_fabric_meters, "m")}`,
    ],
    sai: [
      `Fabric received: ${formatMetric(flowSummary.sai.fabric_received_meters, "m")}`,
      `Fabric dyed: ${formatMetric(flowSummary.sai.fabric_dyed_meters, "m")}`,
      `Balance: ${formatMetric(flowSummary.sai.balance_meters, "m")}`,
    ],
    sagar: [
      `Fabric received directly: ${formatMetric(
        flowSummary.sagar.fabric_received_direct_meters,
        "m",
      )}`,
    ],
  };

  return (
    <div className="min-h-screen px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[36px] bg-ink px-6 py-8 text-white shadow-float sm:px-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center">
              <img
                src={logo}
                alt="Sagar Loom Tex Logo"
                className="mr-4 h-12 w-auto object-contain sm:h-14"
              />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  SAGAR LOOM TEX
                </h1>
                <p className="mt-1 text-sm text-blue-200 sm:text-base">
                  Textile Production Flow Dashboard
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">
                    Signed in
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">{authUser.name}</div>
                  <div className="text-xs text-slate-300">
                    {authUser.email} · {authUser.role}
                  </div>
                </div>
                {authUser.role === "admin" ? (
                  <div className="relative" ref={adminMenuRef}>
                    <button
                      type="button"
                      onClick={() => setShowAdminMenu((current) => !current)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/15"
                    >
                      <span>Admin</span>
                      <span className="text-lg leading-none">⋮</span>
                    </button>
                    {showAdminMenu ? (
                      <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-64 rounded-3xl border border-slate-200 bg-white p-2 text-ink shadow-2xl">
                        <button
                          type="button"
                          onClick={() => openAdminModal("stock")}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50"
                        >
                          <span>Set Starting Stock</span>
                          <span className="text-slate-400">↗</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdminModal("clear")}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50"
                        >
                          <span>Clear All Data</span>
                          <span className="text-slate-400">↗</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdminModal("password")}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-slate-50"
                        >
                          <span>
                            {records.admin?.password_set ? "Change Password" : "Set Password"}
                          </span>
                          <span className="text-slate-400">↗</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white shadow-sm backdrop-blur transition hover:bg-white/15"
                >
                  Logout
                </button>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/10 p-5 backdrop-blur">
                <div className="text-sm font-semibold text-slate-200">Live production note</div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  Shubham Syncotex can now route fabric to Sai Leela Processors or directly to
                  Sagar Loom Tex while sharing one yarn balance ledger.
                </div>
              </div>
            </div>
          </div>
        </section>

        {adminMessage ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
            {adminMessage}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <StatCard
            label="Shubham Yarn Balance"
            value={formatMetric(records.dashboard.yarn_with_shubham_kg, "kg")}
            subtitle="Shared yarn position after both Sai and direct Shubham processing records."
            accent="bg-sand text-ember"
          />
          <StatCard
            label="Sai Fabric Balance"
            value={formatMetric(records.dashboard.fabric_with_sai_meters, "m")}
            subtitle="Fabric routed to Sai Leela minus total dyed meters."
            accent="bg-teal-100 text-ocean"
          />
          <StatCard
            label="Direct To Sagar"
            value={formatMetric(records.dashboard.fabric_sent_direct_to_sagar_meters, "m")}
            subtitle="Fabric transferred directly from Shubham Syncotex to Sagar Loom Tex."
            accent="bg-orange-100 text-ember"
          />
        </section>

        <section className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-3">
            {tabs.map((tab) => (
              <TabButton
                key={tab}
                label={tab}
                active={tab === activeTab}
                onClick={() => setActiveTab(tab)}
              />
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowExportPanel((current) => !current)}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-slate-50"
            >
              Export PDF
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-2xl bg-ember px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-orange-700"
            >
              New Entry
            </button>
          </div>
        </section>

        {showExportPanel ? (
          <section className="mt-4 rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-float backdrop-blur">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-bold text-ink">Export production report</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Download a clean PDF report covering yarn purchases, processing, direct
                  transfers, and dyeing records for the selected period.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-5">
                  {exportOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setExportRange(option.value)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        exportRange === option.value
                          ? "bg-ink text-white shadow-lg"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {exportRange === "custom" ? (
                  <div className="mt-4 grid gap-4 md:max-w-xl md:grid-cols-2">
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      <span>Start Date</span>
                      <input
                        type="date"
                        name="start_date"
                        value={customRange.start_date}
                        onChange={handleCustomDateChange}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      <span>End Date</span>
                      <input
                        type="date"
                        name="end_date"
                        value={customRange.end_date}
                        onChange={handleCustomDateChange}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowExportPanel(false)}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {exporting ? "Generating..." : "Download PDF"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
          <SectionCard>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-ink">{currentConfig.title}</h2>
                <p className="mt-1 text-sm text-slate-500">{autoInsightMap[activeTab]}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {currentConfig.summaryLabel}:{" "}
                <span className="font-bold text-ink">
                  {activeTab === "Manglam Yarn Agencies"
                    ? formatMetric(flowSummary.manglam.total_yarn_purchased_kg, "kg")
                    : activeTab === "Shubham Syncotex"
                      ? formatMetric(flowSummary.shubham.fabric_sent_to_sai_meters, "m")
                      : activeTab === "Sai Leela Processors"
                        ? formatMetric(flowSummary.sai.balance_meters, "m")
                        : formatMetric(flowSummary.sagar.fabric_received_direct_meters, "m")}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto] md:items-center">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                  <span>Search {currentConfig.searchKey.replaceAll("_", " ")}</span>
                  <input
                    type="text"
                    value={searchState[activeTab]}
                    onChange={handleSearchChange}
                    placeholder={
                      currentConfig.searchKey === "invoice_number"
                        ? "Search invoice number"
                        : "Search challan number"
                    }
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
                  />
                </label>
                <button
                  type="button"
                  onClick={toggleSortDirection}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-slate-100"
                >
                  Sort by Date: {sortState[activeTab] === "desc" ? "Newest" : "Oldest"}
                </button>
              </div>

              {currentSelectedIds.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="text-sm font-semibold text-ink">
                    Selected: {currentSelectedIds.length} records
                  </div>
                  <button
                    type="button"
                    onClick={handleEditSelected}
                    disabled={currentSelectedIds.length !== 1}
                    className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeleteModal(currentSelectedIds)}
                    className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
                  >
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              <RecordsTable
                columns={currentConfig.tableColumns}
                rows={tableRows}
                emptyMessage={currentConfig.emptyMessage}
                selectedRowIds={currentSelectedIds}
                onSelectRecord={handleSelectRecord}
                onEditRecord={openEditModal}
                onDeleteRecord={(row) => openDeleteModal([row.id])}
              />
            </div>
          </SectionCard>

          <SectionCard className="flex flex-col gap-5">
            <div>
              <h3 className="text-xl font-bold text-ink">Entry options</h3>
              <p className="mt-2 text-sm text-slate-500">
                Manual entry stays fully available. Uploads only help prefill fields before you
                review and save.
              </p>
            </div>

            <div className="rounded-3xl bg-peach p-5">
              <div className="text-sm font-bold uppercase tracking-[0.24em] text-ember">
                Manual entry
              </div>
              <p className="mt-2 text-sm text-slate-600">
                Open the modal form, edit existing records, and keep balances synced across both
                Shubham outflows.
              </p>
              <button
                type="button"
                onClick={openCreateModal}
                className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm"
              >
                Open Form
              </button>
            </div>

            <UploadPanel
              title={currentConfig.uploadTitle}
              documentType={currentConfig.documentType}
              preview={previewState[currentConfig.documentType]}
              uploadError={uploadError}
              uploading={uploading}
              onFileChange={handleUpload}
              onUsePreview={usePreviewData}
            />

            {error ? <p className="text-sm text-ember">{error}</p> : null}
          </SectionCard>
        </section>

        <section className="mt-6">
          <SectionCard>
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="text-2xl font-bold text-ink">Production Flow</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Click any node to inspect live movement totals across Manglam Yarn Agencies,
                  Shubham Syncotex, Sai Leela Processors, and direct transfer to Sagar Loom Tex.
                </p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,80px,1fr]">
                <div className="flex flex-col items-center gap-4">
                  <FlowNode
                    active={activeFlowNode === "manglam"}
                    label="Manglam Yarn Agencies"
                    subtitle="Yarn purchased"
                    onClick={() => setActiveFlowNode("manglam")}
                  />
                  <div className="text-3xl text-slate-300">↓</div>
                  <FlowNode
                    active={activeFlowNode === "shubham"}
                    label="Shubham Syncotex"
                    subtitle="Shared yarn and fabric hub"
                    onClick={() => setActiveFlowNode("shubham")}
                  />
                </div>

                <div className="hidden items-center justify-center text-5xl text-slate-300 lg:flex">
                  ↙ ↘
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                  <FlowNode
                    active={activeFlowNode === "sai"}
                    label="Sai Leela Processors"
                    subtitle="Fabric routed for dyeing"
                    onClick={() => setActiveFlowNode("sai")}
                  />
                  <FlowNode
                    active={activeFlowNode === "sagar"}
                    label="Sagar Loom Tex"
                    subtitle="Direct transfer from Shubham"
                    onClick={() => setActiveFlowNode("sagar")}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-sm font-bold uppercase tracking-[0.24em] text-slate-500">
                  {activeFlowNode} summary
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {flowNodeDetails[activeFlowNode].map((detail) => (
                    <div key={detail} className="rounded-2xl bg-white px-4 py-4 text-sm font-semibold text-ink shadow-sm">
                      {detail}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>
        </section>

        <EntryModal
          open={adminModal === "stock"}
          title="Set Starting Stock"
          description="Set the opening yarn stock at Shubham and the opening fabric stock at Sai Leela. Existing balances will recalculate immediately."
          fields={stockFields}
          values={adminForm}
          onChange={handleAdminFormChange}
          onClose={closeAdminModal}
          onSubmit={handleSetInitialStock}
          submitLabel="Save Starting Stock"
          loading={adminLoading}
        >
          {adminError ? <p className="text-sm text-ember">{adminError}</p> : null}
        </EntryModal>

        <EntryModal
          open={adminModal === "password"}
          title={records.admin?.password_set ? "Change Password" : "Set Password"}
          description="Protect destructive admin actions with a hashed password stored in system configuration."
          fields={passwordFields}
          values={adminForm}
          onChange={handleAdminFormChange}
          onClose={closeAdminModal}
          onSubmit={handleSetPassword}
          submitLabel={records.admin?.password_set ? "Update Password" : "Save Password"}
          loading={adminLoading}
        >
          {adminError ? <p className="text-sm text-ember">{adminError}</p> : null}
        </EntryModal>

        <ConfirmationModal
          open={adminModal === "clear"}
          title="Clear all data?"
          description="Are you sure you want to delete all records? This cannot be undone."
          confirmLabel="Clear All Data"
          loading={adminLoading}
          onClose={closeAdminModal}
          onConfirm={handleClearAllData}
        >
          <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
            <span>Admin Password</span>
            <input
              type="password"
              name="clear_password"
              value={adminForm.clear_password}
              onChange={handleAdminFormChange}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-ocean focus:ring-2 focus:ring-teal-100"
            />
          </label>
          {adminError ? <p className="mt-3 text-sm text-ember">{adminError}</p> : null}
        </ConfirmationModal>

        <EntryModal
          open={isModalOpen}
          title={
            editingRecordId
              ? `${currentConfig.title} Record Update`
              : `${currentConfig.title} Entry`
          }
          description="Save a new record or edit an existing one while keeping yarn and fabric balances aligned. Yellow fields came from AI with low confidence and should be reviewed."
          fields={currentConfig.fields}
          values={getCurrentFormValues()}
          fieldConfidence={fieldConfidenceState[activeTab]}
          onChange={handleChange}
          onClose={closeModal}
          onSubmit={handleSubmit}
          submitLabel={editingRecordId ? "Update Record" : "Save Record"}
          loading={saving}
        >
          {(activeTab === "Shubham Syncotex" ||
            activeTab === "Sagar Loom Tex (Direct from Shubham)") ? (
            <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
              Wastage is calculated at 4% of yarn consumed, and yarn balance is recomputed across
              both Shubham transfer routes on save.
            </div>
          ) : null}
          {activeTab === "Sai Leela Processors" ? (
            <div className="rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
              Sai Leela balance is based only on fabric routed through Shubham processing records.
            </div>
          ) : null}
          {error ? <p className="text-sm text-ember">{error}</p> : null}
        </EntryModal>

        <ConfirmationModal
          open={deleteState.open}
          title="Delete selected records?"
          description={`This will permanently remove ${deleteState.ids.length} record${
            deleteState.ids.length === 1 ? "" : "s"
          } and recalculate balances across the workflow.`}
          confirmLabel="Delete Records"
          loading={deleting}
          onClose={closeDeleteModal}
          onConfirm={handleDeleteConfirmed}
        />
      </div>
    </div>
  );
}
