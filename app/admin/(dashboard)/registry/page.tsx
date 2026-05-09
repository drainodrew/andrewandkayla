/**
 * Admin registry management page.
 * Placeholder for now since registry items haven't been added yet.
 */
export default function AdminRegistryPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-heading text-3xl text-deep-sage mb-4">Registry</h1>
      <div className="bg-white rounded-xl border border-sage/30 p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-sage/20 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-deep-sage/60"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 11.25v8.25a1.5 1.5 0 01-1.5 1.5H5.25a1.5 1.5 0 01-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 109.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1114.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
            />
          </svg>
        </div>
        <h2 className="font-heading text-xl text-deep-sage mb-2">
          Coming soon
        </h2>
        <p className="text-sm text-dark/60 max-w-md mx-auto">
          Registry management will be available here once registry items
          have been added. You will be able to see which items have been
          claimed and by whom.
        </p>
      </div>
    </div>
  );
}
