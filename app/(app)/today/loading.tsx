export default function Loading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-9 w-52 rounded bg-surface-alt" />
      <div className="h-72 rounded-3xl bg-surface-alt" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-2xl bg-surface-alt" />
        <div className="h-28 rounded-2xl bg-surface-alt" />
        <div className="h-28 rounded-2xl bg-surface-alt" />
      </div>
    </div>
  );
}
