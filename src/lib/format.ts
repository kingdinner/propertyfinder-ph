export function formatPeso(centavos: number, transaction: "sale" | "rent" = "sale"): string {
  const formatted = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(centavos / 100);
  return transaction === "rent" ? `${formatted}/mo` : formatted;
}

export function formatArea(sqm: number): string {
  return `${new Intl.NumberFormat("en-PH").format(sqm)} sqm`;
}
