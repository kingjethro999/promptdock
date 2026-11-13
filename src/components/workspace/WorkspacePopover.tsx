/**
 * The floating panel used by the top-bar menus (product updates, support).
 * The trigger and open state belong to the caller; this is the shared surface.
 */
export default function WorkspacePopover({
  label,
  role = "dialog",
  className = "",
  style,
  children,
}: {
  label: string;
  role?: "dialog" | "status";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`updates-popover ${className}`.trim()}
      role={role}
      aria-label={label}
      style={style}
    >
      {children}
    </div>
  );
}
