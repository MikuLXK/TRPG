interface DataRowProps {
  label: string;
  value: string;
}

export default function DataRow({ label, value }: DataRowProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3">
      <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{label}</div>
      <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{value || '—'}</div>
    </div>
  );
}
