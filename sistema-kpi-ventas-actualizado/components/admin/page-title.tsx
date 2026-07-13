export function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 w-full max-w-full rounded-3xl border border-white/70 bg-white/85 p-4 shadow-soft backdrop-blur sm:p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">Backus KPI</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">{description}</p>
    </div>
  );
}
