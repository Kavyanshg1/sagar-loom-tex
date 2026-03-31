export function StatCard({ label, value, accent, subtitle }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03))] p-4 shadow-float backdrop-blur-xl sm:p-5">
      <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${accent}`}>
        {label}
      </div>
      <div className="font-display text-2xl font-extrabold tracking-[0.04em] text-white sm:text-3xl">{value}</div>
      <div className="mt-2 text-sm text-slate-300">{subtitle}</div>
    </div>
  );
}
