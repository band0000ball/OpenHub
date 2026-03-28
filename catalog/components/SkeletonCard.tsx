export default function SkeletonCard() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="読み込み中"
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="flex gap-2">
          <div className="h-3 w-16 rounded bg-gray-200" />
          <div className="h-3 w-24 rounded bg-gray-200" />
        </div>
        <div className="flex gap-1">
          <div className="h-3 w-10 rounded bg-gray-200" />
          <div className="h-3 w-10 rounded bg-gray-200" />
          <div className="h-3 w-10 rounded bg-gray-200" />
        </div>
        <div className="space-y-1">
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-5/6 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
