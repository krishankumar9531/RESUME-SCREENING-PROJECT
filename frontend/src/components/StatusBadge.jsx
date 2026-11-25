export function getStatusStyle(status) {
  if (status === "Shortlisted") {
    return {
      pill: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
      dot: "bg-emerald-500",
      bar: "bg-emerald-500",
      text: "text-emerald-700",
    };
  }
  if (status === "Review") {
    return {
      pill: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
      dot: "bg-amber-500",
      bar: "bg-amber-500",
      text: "text-amber-700",
    };
  }
  return {
    pill: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
    text: "text-rose-700",
  };
}

export function StatusBadge({ status, size = "sm" }) {
  const style = getStatusStyle(status);
  const sizeClass = size === "md" ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-xs";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${sizeClass} ${style.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}
