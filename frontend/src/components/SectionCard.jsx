export function SectionCard({ children, className = "" }) {
  return (
    <section
      className={`rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(17,22,38,0.94),rgba(7,10,20,0.88))] p-4 shadow-float backdrop-blur-xl sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
