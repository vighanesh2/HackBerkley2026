export default function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-dvh flex-col items-center px-6 py-16 pt-24">
      <div className="w-full max-w-lg">
        <div className="skeleton-shimmer mx-auto h-14 w-14 rounded-2xl" />
        <div className="skeleton-shimmer mx-auto mt-6 h-8 w-56 rounded-lg" />
        <div className="skeleton-shimmer mx-auto mt-3 h-4 w-full max-w-md rounded" />
        <div className="skeleton-shimmer mx-auto mt-2 h-4 w-4/5 max-w-sm rounded" />

        <div className="mt-8 space-y-3">
          <div className="skeleton-shimmer h-4 w-40 rounded" />
          <div className="skeleton-shimmer h-12 w-full rounded-lg" />
        </div>

        <div className="mt-5 space-y-3">
          <div className="skeleton-shimmer h-4 w-32 rounded" />
          <div className="skeleton-shimmer h-28 w-full rounded-lg" />
          <div className="skeleton-shimmer h-9 w-48 rounded-lg" />
        </div>

        <div className="skeleton-shimmer mt-4 h-12 w-full rounded-lg" />

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <div className="skeleton-shimmer h-8 w-36 rounded-full" />
          <div className="skeleton-shimmer h-8 w-40 rounded-full" />
          <div className="skeleton-shimmer h-8 w-44 rounded-full" />
        </div>
      </div>
    </div>
  );
}
