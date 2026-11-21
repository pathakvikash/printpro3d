// Shared header + container for the feature pages. Server component.
export default function PageShell({ title, lead, wide = false, children }: { title: string; lead: string; wide?: boolean; children?: React.ReactNode }) {
  return (
    <section className="py-12 sm:py-16 bg-gray-50 dark:bg-gray-900">
      <div className={`${wide ? 'max-w-6xl' : 'max-w-3xl'} mx-auto px-4 sm:px-6 space-y-6`}>
        <header>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">{lead}</p>
        </header>
        {children}
      </div>
    </section>
  );
}
