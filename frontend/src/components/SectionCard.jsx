export function SectionCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.025))] p-4 shadow-float backdrop-blur-xl sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
