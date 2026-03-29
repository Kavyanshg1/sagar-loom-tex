export function StatCard({ label, value, accent, subtitle }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-float backdrop-blur">
      <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${accent}`}>
        {label}
      </div>
      <div className="text-3xl font-extrabold text-ink">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{subtitle}</div>
    </div>
  );
}
