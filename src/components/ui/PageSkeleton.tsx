export default function PageSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-6 w-2/3" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="skeleton h-4 w-1/3" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="flex gap-3 py-2 border-b border-gray-100">
                <div className="skeleton h-7 w-7 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
