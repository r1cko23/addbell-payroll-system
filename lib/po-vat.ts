/** PH VAT on purchase orders: the typed item amounts are VAT-inclusive, VAT-exclusive, or not subject to VAT. */
export type PoVatMode = "vat_inclusive" | "vat_exclusive" | "non_vat";

export const PO_VAT_MODES: { value: PoVatMode; label: string }[] = [
  { value: "vat_inclusive", label: "VAT Inc" },
  { value: "vat_exclusive", label: "VAT Ex" },
  { value: "non_vat", label: "Non-VAT" },
];

const VAT_RATE = 1.12;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function poVatTotals(itemsTotal: number, mode: PoVatMode) {
  const amount = round2(itemsTotal);
  if (mode === "vat_inclusive") {
    const subtotal = round2(amount / VAT_RATE);
    return { subtotal, vatAmount: round2(amount - subtotal), totalAmount: amount };
  }
  if (mode === "vat_exclusive") {
    const totalAmount = round2(amount * VAT_RATE);
    return { subtotal: amount, vatAmount: round2(totalAmount - amount), totalAmount };
  }
  return { subtotal: amount, vatAmount: 0, totalAmount: amount };
}
