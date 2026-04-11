import { useEffect, useRef, useState } from "react";

function isIncomingRow(row) {
  return String(row.flow_direction ?? "").toLowerCase().startsWith("incoming");
}

function getRowToneClasses(row, selected) {
  if (selected) {
    return "bg-fuchsia-500/10 ring-1 ring-inset ring-fuchsia-400/40";
  }

  if (isIncomingRow(row)) {
    return "bg-emerald-500/10 ring-1 ring-inset ring-emerald-400/15";
  }

  return "bg-panel";
}

function getDetailCardToneClasses(row) {
  return isIncomingRow(row)
    ? "rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-3"
    : "rounded-2xl bg-night px-3 py-3";
}

function getDesktopRowToneClasses(row, selected) {
  if (selected) {
    return "bg-fuchsia-500/10 ring-1 ring-inset ring-fuchsia-400/40";
  }

  return isIncomingRow(row)
    ? "bg-emerald-500/10 hover:bg-emerald-500/15"
    : "hover:bg-panelSoft";
}

function renderCellContent(column, row) {
  const value = column.render ? column.render(row[column.key], row) : row[column.key];

  if (column.key === "flow_direction") {
    const incoming = isIncomingRow(row);
    return (
      <span
        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${
          incoming
            ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
            : "border-white/10 bg-night text-slate-200"
        }`}
      >
        {value}
      </span>
    );
  }

  return value;
}

function ActionsMenu({ isOpen, onToggle, onSelect, onEdit, onDelete, selected, actionsEnabled }) {
  if (!actionsEnabled) {
    return null;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-slate-400 transition hover:bg-panel hover:text-white"
        aria-label="Open record actions"
      >
        ⋮
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-line bg-night p-2 shadow-xl">
          <button
            type="button"
            onClick={onSelect}
            className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-panel ${
              selected ? "text-slate-500" : "text-slate-200"
            }`}
          >
            Select Record
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-panel"
          >
            Edit Record
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
          >
            Delete Record
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RecordsTable({
  columns,
  rows,
  emptyMessage,
  selectedRowIds,
  onSelectRecord,
  onEditRecord,
  onDeleteRecord,
  actionsEnabled = true,
  isRowActionable = null,
}) {
  const [openMenuRowId, setOpenMenuRowId] = useState(null);
  const containerRef = useRef(null);
  const rowIsActionable = (row) =>
    typeof isRowActionable === "function" ? isRowActionable(row) : Boolean(actionsEnabled);
  const primaryColumn = columns[0];
  const secondaryColumn = columns[1];
  const detailColumns = columns.slice(2);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenMenuRowId(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="overflow-hidden rounded-3xl border border-line">
      <div className="divide-y divide-line bg-panel md:hidden">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">{emptyMessage}</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.rowKey ?? row.id}
              className={`p-4 transition ${getRowToneClasses(
                row,
                selectedRowIds.includes(row.rowKey ?? row.id),
              )}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white">
                    {primaryColumn?.render
                      ? primaryColumn.render(row[primaryColumn.key], row)
                      : row[primaryColumn?.key]}
                  </div>
                  {secondaryColumn ? (
                    <div className="mt-1 text-sm text-slate-400">
                      <span className="font-semibold text-slate-300">{secondaryColumn.label}:</span>{" "}
                      {renderCellContent(secondaryColumn, row)}
                    </div>
                  ) : null}
                </div>
                <ActionsMenu
                  actionsEnabled={rowIsActionable(row)}
                  isOpen={openMenuRowId === row.id}
                  onToggle={() =>
                    setOpenMenuRowId((current) => (current === row.id ? null : row.id))
                  }
                  onSelect={() => {
                    onSelectRecord(row);
                    setOpenMenuRowId(null);
                  }}
                  onEdit={() => {
                    onEditRecord(row);
                    setOpenMenuRowId(null);
                  }}
                  onDelete={() => {
                    onDeleteRecord(row);
                    setOpenMenuRowId(null);
                  }}
                  selected={selectedRowIds.includes(row.rowKey ?? row.id)}
                />
              </div>

              {detailColumns.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {detailColumns.map((column) => (
                    <div
                      key={`${row.rowKey ?? row.id}-${column.key}`}
                      className={getDetailCardToneClasses(row)}
                    >
                      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                        {column.label}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-200">
                        {renderCellContent(column, row)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-line text-sm">
          <thead className="bg-night">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-400"
                >
                  {column.label}
                </th>
              ))}
              {actionsEnabled ? (
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-panel">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actionsEnabled ? 1 : 0)}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.rowKey ?? row.id}
                  className={`transition ${getDesktopRowToneClasses(
                    row,
                    selectedRowIds.includes(row.rowKey ?? row.id),
                  )}`}
                >
                  {columns.map((column) => (
                    <td key={`${row.rowKey ?? row.id}-${column.key}`} className="px-4 py-3 text-slate-200">
                      {renderCellContent(column, row)}
                    </td>
                  ))}
                  {actionsEnabled ? (
                    <td className="px-4 py-3 text-right">
                      <ActionsMenu
                        actionsEnabled={rowIsActionable(row)}
                        isOpen={openMenuRowId === row.id}
                        onToggle={() =>
                          setOpenMenuRowId((current) => (current === row.id ? null : row.id))
                        }
                        onSelect={() => {
                          onSelectRecord(row);
                          setOpenMenuRowId(null);
                        }}
                        onEdit={() => {
                          onEditRecord(row);
                          setOpenMenuRowId(null);
                        }}
                        onDelete={() => {
                          onDeleteRecord(row);
                          setOpenMenuRowId(null);
                        }}
                        selected={selectedRowIds.includes(row.rowKey ?? row.id)}
                      />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
