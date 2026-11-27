// "Part of Orrery" strip above the header. Server component; hidden unless NEXT_PUBLIC_ORRERY_URL is set to an http(s) URL.
export default function OrreryStrip() {
  const url = process.env.NEXT_PUBLIC_ORRERY_URL?.trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  return (
    <div className="flex h-8 items-center justify-center gap-2 border-b border-gray-200 bg-gray-100 px-4 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
      <span>Part of Orrery</span>
      <a href={url} className="font-medium text-indigo-700 underline hover:no-underline dark:text-indigo-300">Open Orrery</a>
    </div>
  );
}
