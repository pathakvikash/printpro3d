// A template remounts on every navigation, so this gives each page a short fade-in (CSS only; reduced-motion handled in globals.css).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pp-page">{children}</div>;
}
