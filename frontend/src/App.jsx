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
  "Manglam Yarn Purchases",
  "Shubham White Yarn",
  "Shubham Black Yarn",
  "Sai Leela Processors",
  "Sagar Loom Tex Receipts",
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
  "Manglam Yarn Purchases": {
    title: "Manglam Yarn Purchases",
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
      {
        name: "yarn_type",
        label: "Yarn Type",
        type: "select",
        options: [
          { value: "white", label: "White Yarn" },
          { value: "black", label: "Black Yarn" },
        ],
      },
      { name: "yarn_weight_kg", label: "Yarn Weight (kg)", type: "number" },
      { name: "notes", label: "Notes" },
    ],
    tableColumns: [
      { key: "date", label: "Date" },
      { key: "invoice_number", label: "Invoice #" },
      { key: "yarn_type", label: "Yarn Type", render: (value) => String(value).toUpperCase() },
      { key: "yarn_weight_kg", label: "Yarn (kg)" },
      { key: "notes", label: "Notes" },
    ],
    emptyMessage: "No yarn purchase records yet.",
  },
  "Shubham White Yarn": {
    title: "Shubham Syncotex - White Yarn",
    endpoint: "createProcessingRecord",
    resourcePath: "/processing-records",
    recordsKey: "processing_records",
    documentType: "processing",
    uploadTitle: "White Processing Challan Preview",
    searchKey: "challan_number",
    summaryLabel: "White fabric sent to Sai",
    fields: processingFields,
    tableColumns: processingColumns,
    emptyMessage: "No white processing records yet.",
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
  "Shubham Black Yarn": {
    title: "Shubham Syncotex - Black Yarn",
    endpoint: "createDirectProcessingRecord",
    resourcePath: "/direct-processing-records",
    recordsKey: "direct_processing_records",
    documentType: "processing",
    uploadTitle: "Black Processing Challan Preview",
    searchKey: "challan_number",
    summaryLabel: "Black fabric sent to Sagar",
    fields: processingFields,
    tableColumns: processingColumns,
    emptyMessage: "No black processing records yet.",
  },
  "Sagar Loom Tex Receipts": {
    title: "Sagar Loom Tex Fabric Incoming",
    recordsKey: "sagar_receipts",
    searchKey: "challan_number",
    summaryLabel: "Incoming fabric",
    readOnly: true,
    tableColumns: [
      { key: "date", label: "Date" },
      { key: "challan_number", label: "Challan #" },
      { key: "fabric_type", label: "Type", render: (value) => String(value).toUpperCase() },
      { key: "meters", label: "Meters" },
    ],
    emptyMessage: "No incoming Sagar fabric records yet.",
  },
};

const stockFields = [
  { name: "white_yarn_kg", label: "Opening White Yarn at Shubham (kg)", type: "number" },
  { name: "black_yarn_kg", label: "Opening Black Yarn at Shubham (kg)", type: "number" },
  {
    name: "white_fabric_meters",
    label: "Opening White Fabric at Sai Leela (meters)",
    type: "number",
  },
];

const passwordFields = [
  { name: "new_password", label: "New Password", type: "password" },
  { name: "confirm_password", label: "Confirm Password", type: "password" },
];

function createDefaultValues() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    "Manglam Yarn Purchases": {
      date: today,
      invoice_number: "",
      yarn_type: "white",
      yarn_weight_kg: "",
      notes: "",
    },
    "Shubham White Yarn": {
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
    "Sagar Loom Tex Receipts": {},
    "Shubham Black Yarn": {
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
          ? "border-fuchsia-400/40 bg-[linear-gradient(135deg,rgba(74,16,120,0.92),rgba(20,18,50,0.96))] text-white shadow-float"
          : "border-line bg-panel hover:-translate-y-0.5 hover:border-slate-500 hover:bg-panelSoft hover:shadow-md"
      }`}
    >
      <div className="font-display text-lg font-bold tracking-[0.04em]">{label}</div>
      <div className={`mt-2 text-sm ${active ? "text-fuchsia-100/90" : "text-slate-400"}`}>
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
    sagar_receipts: [],
    admin: {
      initial_white_yarn_stock_kg: 0,
      initial_black_yarn_stock_kg: 0,
      initial_white_fabric_stock_meters: 0,
      password_set: false,
    },
    current_user: null,
    dashboard: {
      white_yarn_with_shubham_kg: 0,
      black_yarn_with_shubham_kg: 0,
      white_fabric_with_sai_meters: 0,
      white_fabric_with_sagar_meters: 0,
      black_fabric_with_sagar_meters: 0,
      total_fabric_with_sagar_meters: 0,
      logged_fabric_balance_meters: 0,
      fabric_sent_direct_to_sagar_meters: 0,
      shubham_remaining_fabric_meters: 0,
      flow_summary: {
        manglam: { white_yarn_purchased_kg: 0, black_yarn_purchased_kg: 0 },
        shubham_white: {
          yarn_balance_kg: 0,
          fabric_produced_meters: 0,
          fabric_sent_to_sai_meters: 0,
        },
        shubham_black: {
          yarn_balance_kg: 0,
          fabric_produced_meters: 0,
          fabric_sent_to_sagar_meters: 0,
        },
        sai: {
          fabric_received_meters: 0,
          fabric_dyed_meters: 0,
          balance_meters: 0,
        },
        sagar: {
          white_fabric_received_meters: 0,
          black_fabric_received_meters: 0,
          total_fabric_received_meters: 0,
        },
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
  const [activeFlowNode, setActiveFlowNode] = useState("shubhamWhite");
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [adminModal, setAdminModal] = useState(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [adminMessage, setAdminMessage] = useState("");
  const [adminForm, setAdminForm] = useState({
    white_yarn_kg: "",
    black_yarn_kg: "",
    white_fabric_meters: "",
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
  const isReadOnlyTab = Boolean(currentConfig.readOnly);

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
    if (tab !== "Shubham White Yarn" && tab !== "Shubham Black Yarn") {
      return rawValues;
    }

    const yarnConsumed = Number(rawValues.yarn_consumed_kg || 0);
    const wastage = yarnConsumed ? roundToTwo(yarnConsumed * 0.04) : "";
    const liveBalance =
      tab === "Shubham White Yarn"
        ? records.dashboard.white_yarn_with_shubham_kg
        : records.dashboard.black_yarn_with_shubham_kg;
    const baseYarnBalance =
      editingRecordId && rawValues.yarn_balance_kg !== ""
        ? rawValues.yarn_balance_kg
        : yarnConsumed
          ? roundToTwo(liveBalance - yarnConsumed - Number(wastage || 0))
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
    if (isReadOnlyTab) {
      return;
    }
    setEditingRecordId(null);
    resetFormForTab(activeTab);
    setError("");
    setIsModalOpen(true);
  }

  function openEditModal(record) {
    if (isReadOnlyTab) {
      return;
    }
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
    if (isReadOnlyTab) {
      return;
    }
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
        white_yarn_kg: String(records.admin?.initial_white_yarn_stock_kg ?? 0),
        black_yarn_kg: String(records.admin?.initial_black_yarn_stock_kg ?? 0),
        white_fabric_meters: String(records.admin?.initial_white_fabric_stock_meters ?? 0),
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
        white_yarn_kg: Number(adminForm.white_yarn_kg || 0),
        black_yarn_kg: Number(adminForm.black_yarn_kg || 0),
        white_fabric_meters: Number(adminForm.white_fabric_meters || 0),
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
      <div className="flex min-h-screen items-center justify-center px-4 py-6 text-mist">
        <div className="rounded-[32px] border border-line bg-panel px-6 py-5 shadow-float">
          <div className="text-sm font-semibold text-slate-400">Checking secure session...</div>
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
    "Manglam Yarn Purchases":
      "Record black and white yarn separately so both Shubham stocks stay independent from purchase to output.",
    "Shubham White Yarn":
      "White yarn at Shubham converts into unfinished white fabric, which then moves onward to Sai Leela for dyeing.",
    "Shubham Black Yarn":
      "Black yarn at Shubham stays on a direct path to Sagar Loom Tex, with its own yarn balance and challan history.",
    "Sai Leela Processors":
      "Sai Leela handles only the white-fabric branch. Balance is white fabric received from Shubham minus total dyed meters.",
    "Sagar Loom Tex Receipts":
      "This table is auto-generated. White entries come from Sai Leela dyeing challans, and black entries come directly from Shubham black challans.",
  };

  const flowSummary = records.dashboard.flow_summary;
  const flowNodeDetails = {
    manglam: [
      `White yarn purchased: ${formatMetric(flowSummary.manglam.white_yarn_purchased_kg, "kg")}`,
      `Black yarn purchased: ${formatMetric(flowSummary.manglam.black_yarn_purchased_kg, "kg")}`,
    ],
    shubhamWhite: [
      `White yarn balance: ${formatMetric(flowSummary.shubham_white.yarn_balance_kg, "kg")}`,
      `White fabric produced: ${formatMetric(flowSummary.shubham_white.fabric_produced_meters, "m")}`,
      `Sent to Sai Leela: ${formatMetric(flowSummary.shubham_white.fabric_sent_to_sai_meters, "m")}`,
    ],
    shubhamBlack: [
      `Black yarn balance: ${formatMetric(flowSummary.shubham_black.yarn_balance_kg, "kg")}`,
      `Black fabric produced: ${formatMetric(flowSummary.shubham_black.fabric_produced_meters, "m")}`,
      `Sent directly to Sagar: ${formatMetric(flowSummary.shubham_black.fabric_sent_to_sagar_meters, "m")}`,
    ],
    sai: [
      `White fabric received: ${formatMetric(flowSummary.sai.fabric_received_meters, "m")}`,
      `White fabric dyed: ${formatMetric(flowSummary.sai.fabric_dyed_meters, "m")}`,
      `White fabric balance: ${formatMetric(flowSummary.sai.balance_meters, "m")}`,
    ],
    sagar: [
      `White fabric received from Sai: ${formatMetric(flowSummary.sagar.white_fabric_received_meters, "m")}`,
      `Black fabric received direct: ${formatMetric(flowSummary.sagar.black_fabric_received_meters, "m")}`,
      `Total fabric received: ${formatMetric(flowSummary.sagar.total_fabric_received_meters, "m")}`,
    ],
  };

  return (
    <div className="min-h-screen px-3 py-4 text-mist sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(217,70,239,0.22),transparent_24%),radial-gradient(circle_at_top_right,rgba(103,232,249,0.12),transparent_22%),linear-gradient(180deg,#0a1020_0%,#080c16_100%)] px-4 py-6 text-white shadow-float sm:rounded-[36px] sm:px-10 sm:py-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-center">
              <img
                src={logo}
                alt="Sagar Loom Tex Logo"
                className="mr-3 h-10 w-auto object-contain sm:mr-4 sm:h-14"
              />
              <div>
                <h1 className="font-display text-xl font-bold tracking-[0.08em] text-white sm:text-3xl">
                  SAGAR LOOM TEX
                </h1>
                <p className="mt-1 text-xs text-blue-200 sm:text-base">
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
                  <div className="break-all text-xs text-slate-300 sm:break-normal">
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
                      <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-64 rounded-3xl border border-line bg-night p-2 text-mist shadow-2xl">
                        <button
                          type="button"
                          onClick={() => openAdminModal("stock")}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-panel"
                        >
                          <span>Change Opening Stock</span>
                          <span className="text-slate-400">↗</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdminModal("clear")}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-panel"
                        >
                          <span>Clear All Data</span>
                          <span className="text-slate-400">↗</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdminModal("password")}
                          className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition hover:bg-panel"
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
              <div className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur sm:rounded-[28px] sm:p-5">
                <div className="text-sm font-semibold text-slate-200">Live production note</div>
                <div className="mt-3 text-sm leading-6 text-slate-300">
                  The app is now split into two cleaner branches: white yarn flows through Sai
                  Leela before reaching Sagar, while black yarn moves from Shubham directly to
                  Sagar with its own stock ledger.
                </div>
              </div>
            </div>
          </div>
        </section>

        {adminMessage ? (
          <div className="mt-4 rounded-2xl border border-fuchsia-500/25 bg-fuchsia-500/10 px-4 py-3 text-sm font-medium text-fuchsia-100">
            {adminMessage}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Shubham White Yarn"
            value={formatMetric(records.dashboard.white_yarn_with_shubham_kg, "kg")}
            subtitle="Live white-yarn stock available for the Sai Leela branch."
            accent="bg-fuchsia-500/20 text-fuchsia-100"
          />
          <StatCard
            label="Shubham Black Yarn"
            value={formatMetric(records.dashboard.black_yarn_with_shubham_kg, "kg")}
            subtitle="Live black-yarn stock available for direct Sagar production."
            accent="bg-violet-500/20 text-violet-100"
          />
          <StatCard
            label="Sai White Fabric"
            value={formatMetric(records.dashboard.white_fabric_with_sai_meters, "m")}
            subtitle="White fabric currently available at Sai Leela after dyeing."
            accent="bg-cyan-500/20 text-cyan-100"
          />
          <StatCard
            label="Fabric With Sagar"
            value={formatMetric(records.dashboard.total_fabric_with_sagar_meters, "m")}
            subtitle={`White ${formatMetric(records.dashboard.white_fabric_with_sagar_meters, "m")} · Black ${formatMetric(records.dashboard.black_fabric_with_sagar_meters, "m")}`}
            accent="bg-purple-500/20 text-purple-100"
          />
        </section>

        <section className="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="-mx-1 overflow-x-auto pb-1">
            <div className="flex min-w-max gap-3 px-1">
            {tabs.map((tab) => (
              <TabButton
                key={tab}
                label={tab}
                active={tab === activeTab}
                onClick={() => setActiveTab(tab)}
              />
            ))}
            </div>
          </div>
          <div className="grid gap-3 sm:flex sm:flex-row">
            {authUser.role === "admin" ? (
              <button
                type="button"
                onClick={() => openAdminModal("stock")}
                className="rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-5 py-3 text-sm font-semibold text-fuchsia-100 shadow-sm transition hover:bg-fuchsia-500/15"
              >
                Change Opening Stock
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setShowExportPanel((current) => !current)}
              className="rounded-2xl border border-line bg-panel px-5 py-3 text-sm font-semibold text-slate-200 shadow-sm transition hover:bg-panelSoft"
            >
              Export PDF
            </button>
            {!isReadOnlyTab ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-2xl bg-[linear-gradient(135deg,rgba(217,70,239,0.96),rgba(168,85,247,0.96))] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-950/40 transition hover:brightness-110"
              >
                New Entry
              </button>
            ) : null}
          </div>
        </section>

        {showExportPanel ? (
          <section className="mt-4 rounded-[28px] border border-line bg-panel/95 p-4 shadow-float backdrop-blur sm:p-5">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex-1">
                <h3 className="font-display text-lg font-bold tracking-[0.04em] text-white">Export production report</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Download a clean PDF report covering yarn purchases, processing, direct
                  transfers, and dyeing records for the selected period.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
                  {exportOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setExportRange(option.value)}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                        exportRange === option.value
                          ? "bg-[linear-gradient(135deg,rgba(217,70,239,0.96),rgba(168,85,247,0.96))] text-white shadow-lg"
                          : "border border-line bg-night text-slate-300 hover:bg-panelSoft"
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
                        className="rounded-2xl border border-line bg-night px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-glow focus:ring-2 focus:ring-fuchsia-500/20"
                      />
                    </label>
                    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                      <span>End Date</span>
                      <input
                        type="date"
                        name="end_date"
                        value={customRange.end_date}
                        onChange={handleCustomDateChange}
                        className="rounded-2xl border border-line bg-night px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-glow focus:ring-2 focus:ring-fuchsia-500/20"
                      />
                    </label>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowExportPanel(false)}
                  className="rounded-2xl border border-line px-5 py-3 text-sm font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exporting}
                  className="rounded-2xl bg-[linear-gradient(135deg,rgba(217,70,239,0.96),rgba(168,85,247,0.96))] px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
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
                <h2 className="font-display text-2xl font-bold tracking-[0.04em] text-white">{currentConfig.title}</h2>
                <p className="mt-1 text-sm text-slate-400">{autoInsightMap[activeTab]}</p>
              </div>
              <div className="rounded-2xl border border-line bg-night px-4 py-3 text-sm text-slate-300">
                {currentConfig.summaryLabel}:{" "}
                <span className="font-bold text-white">
                  {activeTab === "Manglam Yarn Purchases"
                    ? `${formatMetric(flowSummary.manglam.white_yarn_purchased_kg, "kg")} white / ${formatMetric(flowSummary.manglam.black_yarn_purchased_kg, "kg")} black`
                    : activeTab === "Shubham White Yarn"
                      ? formatMetric(flowSummary.shubham_white.fabric_sent_to_sai_meters, "m")
                      : activeTab === "Shubham Black Yarn"
                        ? formatMetric(flowSummary.shubham_black.fabric_sent_to_sagar_meters, "m")
                        : activeTab === "Sai Leela Processors"
                          ? formatMetric(flowSummary.sai.balance_meters, "m")
                          : formatMetric(flowSummary.sagar.total_fabric_received_meters, "m")}
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-line bg-night px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto] md:items-center lg:flex-1">
                <label className="flex flex-col gap-2 text-sm font-medium text-slate-300">
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
                    className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-glow focus:ring-2 focus:ring-fuchsia-500/20"
                  />
                </label>
                <button
                  type="button"
                  onClick={toggleSortDirection}
                  className="rounded-2xl bg-panelSoft px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-panel"
                >
                  Sort by Date: {sortState[activeTab] === "desc" ? "Newest" : "Oldest"}
                </button>
              </div>

              {!isReadOnlyTab && currentSelectedIds.length > 0 ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
                  <div className="text-sm font-semibold text-white">
                    Selected: {currentSelectedIds.length} records
                  </div>
                  <button
                    type="button"
                    onClick={handleEditSelected}
                    disabled={currentSelectedIds.length !== 1}
                    className="rounded-2xl bg-panelSoft px-4 py-2 text-sm font-semibold text-slate-100 shadow-sm transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-50"
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
                actionsEnabled={!isReadOnlyTab}
                onSelectRecord={handleSelectRecord}
                onEditRecord={openEditModal}
                onDeleteRecord={(row) => openDeleteModal([row.id])}
              />
            </div>
          </SectionCard>

          <SectionCard className="flex flex-col gap-5">
            <div>
              <h3 className="font-display text-xl font-bold tracking-[0.04em] text-white">
                {isReadOnlyTab ? "How this table works" : "Entry options"}
              </h3>
              <p className="mt-2 text-sm text-slate-400">
                {isReadOnlyTab
                  ? "Sagar receipts are created automatically from the upstream challans, so this screen stays read-only and easy to audit."
                  : "Manual entry stays fully available. Uploads only help prefill fields before you review and save."}
              </p>
            </div>

            {isReadOnlyTab ? (
              <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-5">
                <div className="text-sm font-bold uppercase tracking-[0.24em] text-cyan-100">
                  Automatic receipts
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  White receipts are generated from Sai Leela dyeing entries and black receipts are
                  generated from Shubham black-yarn records using the same challan number, date,
                  and meters.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-3xl border border-fuchsia-500/20 bg-fuchsia-500/10 p-5">
                  <div className="text-sm font-bold uppercase tracking-[0.24em] text-fuchsia-100">
                    Manual entry
                  </div>
                  <p className="mt-2 text-sm text-slate-300">
                    Open the modal form, capture the correct branch, and keep black and white stock
                    ledgers synced without relying on document upload.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateModal}
                    className="mt-4 rounded-2xl bg-night px-4 py-3 text-sm font-semibold text-slate-100 shadow-sm"
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
              </>
            )}

            {error ? <p className="text-sm text-ember">{error}</p> : null}
          </SectionCard>
        </section>

        <section className="mt-6">
          <SectionCard>
              <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-display text-2xl font-bold tracking-[0.04em] text-white">Production Flow</h3>
                <p className="mt-1 text-sm text-slate-400">
                  Click any node to inspect the simplified white-yarn and black-yarn routes from
                  purchase to final receipt at Sagar Loom Tex.
                </p>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,1fr]">
                <div className="flex flex-col items-center gap-4">
                  <FlowNode
                    active={activeFlowNode === "manglam"}
                    label="Manglam Yarn Agencies"
                    subtitle="Black and white yarn purchased"
                    onClick={() => setActiveFlowNode("manglam")}
                  />
                  <div className="text-3xl text-slate-300">↙</div>
                  <FlowNode
                    active={activeFlowNode === "shubhamWhite"}
                    label="Shubham White Yarn"
                    subtitle="White yarn converted for Sai Leela"
                    onClick={() => setActiveFlowNode("shubhamWhite")}
                  />
                  <div className="text-3xl text-slate-300">↓</div>
                  <FlowNode
                    active={activeFlowNode === "sai"}
                    label="Sai Leela Processors"
                    subtitle="White fabric dyeing branch"
                    onClick={() => setActiveFlowNode("sai")}
                  />
                </div>

                <div className="flex flex-col items-center gap-4">
                  <div className="hidden text-3xl text-slate-300 lg:block">↘</div>
                  <FlowNode
                    active={activeFlowNode === "shubhamBlack"}
                    label="Shubham Black Yarn"
                    subtitle="Black yarn converted direct to Sagar"
                    onClick={() => setActiveFlowNode("shubhamBlack")}
                  />
                  <div className="text-3xl text-slate-300">↓</div>
                  <FlowNode
                    active={activeFlowNode === "sagar"}
                    label="Sagar Loom Tex"
                    subtitle="Receives dyed white + direct black fabric"
                    onClick={() => setActiveFlowNode("sagar")}
                  />
                </div>
              </div>

              <div className="mt-4 rounded-[28px] border border-line bg-night p-5">
                <div className="text-sm font-bold uppercase tracking-[0.24em] text-slate-400">
                  {activeFlowNode} summary
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {flowNodeDetails[activeFlowNode].map((detail) => (
                    <div key={detail} className="rounded-2xl border border-line bg-panel px-4 py-4 text-sm font-semibold text-slate-100 shadow-sm">
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
          title="Change Opening Stock"
          description="Update the opening yarn stock at Shubham and the opening white-fabric stock at Sai Leela. Existing balances will recalculate immediately."
          fields={stockFields}
          values={adminForm}
          onChange={handleAdminFormChange}
          onClose={closeAdminModal}
          onSubmit={handleSetInitialStock}
          submitLabel="Save Opening Stock"
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
              className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-glow focus:ring-2 focus:ring-fuchsia-500/20"
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
          {(activeTab === "Shubham White Yarn" || activeTab === "Shubham Black Yarn") ? (
            <div className="rounded-3xl border border-line bg-night p-4 text-sm text-slate-300">
              Wastage is calculated at 4% of yarn consumed. Each Shubham branch recomputes against
              its own yarn stock on save, so white and black balances stay independent.
            </div>
          ) : null}
          {activeTab === "Sai Leela Processors" ? (
            <div className="rounded-3xl border border-line bg-night p-4 text-sm text-slate-300">
              Sai Leela handles only the white branch. Balance is based on white fabric received
              from Shubham White Yarn records minus dyed meters.
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
