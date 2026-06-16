// A template re-mounts on every navigation (unlike layout), so each PMS page
// fades its content in quickly — making page-to-page transitions feel smooth
// instead of snapping. Pairs with loading.tsx (skeleton shows first, then this
// fades the real content in). Kept short (200ms) so it never feels sluggish.
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="animate-fade-in motion-reduce:animate-none">{children}</div>
  );
}
