// Title-case helper used to normalize brand / model / category values so we
// never end up with duplicates that differ only by capitalization.
export function toTitleCase(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

// "Herman Miller" -> "HM", "Steelcase" -> "S", "" -> "GEN"
export function brandInitials(brand: string | null | undefined): string {
  const t = toTitleCase(brand);
  if (!t) return "GEN";
  return (
    t
      .split(" ")
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4) || "GEN"
  );
}
