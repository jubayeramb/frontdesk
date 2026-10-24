const bdt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

// 58000 -> "৳58,000". Western grouping so readers outside Bangladesh can parse it.
export function formatBdt(amount: number): string {
  return `৳${bdt.format(amount)}`;
}
