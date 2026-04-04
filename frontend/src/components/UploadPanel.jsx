export function UploadPanel({
  title,
  documentType,
  preview,
  uploadError,
  uploading,
  onFileChange,
  onUsePreview,
}) {
  return (
    <div className="rounded-3xl border border-dashed border-line bg-panelSoft/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h4 className="font-display text-base font-bold tracking-[0.02em] text-white">{title}</h4>
          <p className="mt-1 text-sm text-slate-400">
            Upload a {documentType} for OCR + AI-assisted extraction. The form stays editable,
            and nothing is saved until you confirm manually.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-line bg-night px-4 py-3 text-sm font-semibold text-slate-200 shadow-sm">
          {uploading ? "Reading..." : "Upload Document"}
          <input
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={onFileChange}
          />
        </label>
      </div>

      {uploadError ? <p className="mt-3 text-sm text-ember">{uploadError}</p> : null}

      {preview ? (
        <div className="mt-4 rounded-3xl border border-line bg-night p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Detected fields preview</p>
              <p className="text-xs text-slate-400">{preview.filename}</p>
            </div>
            <button
              type="button"
              onClick={onUsePreview}
              className="rounded-2xl bg-[linear-gradient(135deg,rgba(217,70,239,0.96),rgba(168,85,247,0.96))] px-4 py-2 text-sm font-semibold text-white"
            >
              Reapply Preview
            </button>
          </div>
          {preview.message ? (
            <p className="mt-3 text-sm text-slate-400">{preview.message}</p>
          ) : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {Object.keys(preview.detected_fields).length === 0 ? (
              <div className="rounded-2xl bg-panel px-4 py-4 text-sm text-slate-400">
                Review detected values before saving.
              </div>
            ) : (
              Object.entries(preview.detected_fields).map(([key, value]) => (
                <div
                  key={key}
                  className={`rounded-2xl px-4 py-3 ${
                    preview.confidence?.[key] === "low"
                      ? "bg-fuchsia-500/10 ring-1 ring-fuchsia-500/30"
                      : "bg-panel"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                      {key.replaceAll("_", " ")}
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                        preview.confidence?.[key] === "high"
                          ? "bg-fuchsia-500/20 text-fuchsia-100"
                          : preview.confidence?.[key] === "medium"
                            ? "bg-violet-500/20 text-violet-100"
                            : "bg-purple-500/20 text-purple-100"
                      }`}
                    >
                      {preview.confidence?.[key] ?? "low"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">{String(value)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
