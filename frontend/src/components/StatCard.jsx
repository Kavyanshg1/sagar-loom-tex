export function StatCard({ label, value, accent, subtitle }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-[linear-gradient(180deg,rgba(20,24,41,0.96),rgba(9,12,24,0.92))] p-4 shadow-float backdrop-blur-xl sm:p-5">
      <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] ${accent}`}>
        {label}
      </div>
      <div className="font-display text-2xl font-extrabold tracking-[0.02em] text-white sm:text-3xl">{value}</div>
      <div className="mt-2 text-sm text-slate-400">{subtitle}</div>
    </div>
  );
}
