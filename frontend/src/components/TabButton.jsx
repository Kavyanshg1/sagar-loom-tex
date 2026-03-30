export function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-max rounded-2xl px-4 py-3 text-left text-sm font-semibold transition sm:text-center ${
        active
          ? "bg-ink text-white shadow-lg"
          : "bg-white/80 text-slate-600 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
