export function TabButton({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-max rounded-2xl px-4 py-3 text-left text-sm font-semibold transition sm:text-center ${
        active
          ? "bg-[linear-gradient(135deg,rgba(217,70,239,0.92),rgba(168,85,247,0.92))] text-white shadow-lg shadow-fuchsia-950/40"
          : "border border-line bg-panelSoft/65 text-slate-300 hover:border-fuchsia-500/40 hover:bg-panel"
      }`}
    >
      {label}
    </button>
  );
}
