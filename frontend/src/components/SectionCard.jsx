export function SectionCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[28px] border border-white/70 bg-white/90 p-4 shadow-float backdrop-blur sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
