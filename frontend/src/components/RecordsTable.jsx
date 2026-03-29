import { useEffect, useRef, useState } from "react";

function ActionsMenu({ isOpen, onToggle, onSelect, onEdit, onDelete, selected }) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-slate-500 transition hover:bg-slate-100 hover:text-ink"
        aria-label="Open record actions"
      >
        ⋮
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <button
            type="button"
            onClick={onSelect}
            className={`flex w-full rounded-xl px-3 py-2 text-left text-sm transition hover:bg-slate-100 ${
              selected ? "text-slate-400" : "text-slate-700"
            }`}
          >
            Select Record
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="flex w-full rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
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
}) {
  const [openMenuRowId, setOpenMenuRowId] = useState(null);
  const containerRef = useRef(null);

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
    <div ref={containerRef} className="overflow-hidden rounded-3xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-[0.18em] text-slate-500"
                >
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-4 py-8 text-center text-sm text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={`transition ${
                    selectedRowIds.includes(row.id)
                      ? "bg-amber-50/80 ring-1 ring-inset ring-amber-200"
                      : "hover:bg-slate-50"
                  }`}
                >
                  {columns.map((column) => (
                    <td key={`${row.id}-${column.key}`} className="px-4 py-3 text-slate-700">
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <ActionsMenu
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
                      selected={selectedRowIds.includes(row.id)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
