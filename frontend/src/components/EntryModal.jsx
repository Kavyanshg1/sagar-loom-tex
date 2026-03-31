function InputField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  readOnly = false,
  confidence = "",
  options = [],
}) {
  const isLowConfidence = confidence === "low" && value !== "";
  const sharedClassName = `rounded-2xl border px-4 py-3 text-sm outline-none transition ${
    readOnly
      ? "border-slate-100 bg-slate-50 text-slate-500"
      : isLowConfidence
        ? "border-amber-300 bg-amber-50 text-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
        : "border-slate-200 bg-white focus:border-ocean focus:ring-2 focus:ring-teal-100"
  }`;

  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        {isLowConfidence ? (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-700">
            Review
          </span>
        ) : null}
      </span>
      {type === "select" ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          disabled={readOnly}
          className={sharedClassName}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={readOnly}
          className={sharedClassName}
        />
      )}
    </label>
  );
}

export function EntryModal({
  open,
  title,
  description,
  fields,
  values,
  onChange,
  onClose,
  onSubmit,
  submitLabel,
  loading,
  fieldConfidence = {},
  children,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-2xl font-bold text-ink">{title}</h3>
            <p className="mt-2 text-sm text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={onSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields.map((field) => (
              <InputField
                key={field.name}
                label={field.label}
                name={field.name}
                type={field.type}
                value={values[field.name] ?? ""}
                onChange={onChange}
                placeholder={field.placeholder}
                readOnly={field.readOnly}
                confidence={fieldConfidence[field.name]}
                options={field.options}
              />
            ))}
          </div>

          {children}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-2xl bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
