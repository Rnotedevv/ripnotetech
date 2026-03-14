export function Card({ title, description, children, className = '' }) {
  return (
    <section className={`rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl ${className}`}>
      {(title || description) && (
        <div className="mb-5">
          {title ? <h3 className="text-lg font-semibold text-white">{title}</h3> : null}
          {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
        </div>
      )}
      {children}
    </section>
  );
}
