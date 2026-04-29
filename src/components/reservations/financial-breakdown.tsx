import { formatCurrency } from "@/lib/utils/format";

export interface FinancialBreakdownInput {
  base_amount_cents: number;
  cleaning_fee_cents: number;
  extra_guest_fee_cents: number;
  discount_cents: number;
  platform_fee_cents: number;
  tax_cents: number;
  nights?: number;
}

export function computeBreakdown(input: FinancialBreakdownInput) {
  const subtotal_cents =
    input.base_amount_cents +
    input.cleaning_fee_cents +
    input.extra_guest_fee_cents -
    input.discount_cents;
  const total_cents = subtotal_cents + input.tax_cents;
  const net_amount_cents = total_cents - input.platform_fee_cents;
  return { subtotal_cents, total_cents, net_amount_cents };
}

interface Props {
  input: FinancialBreakdownInput;
  className?: string;
}

export function FinancialBreakdown({ input, className }: Props) {
  const { subtotal_cents, total_cents, net_amount_cents } = computeBreakdown(input);
  const nightlyRate =
    input.nights && input.nights > 0
      ? Math.round(input.base_amount_cents / input.nights)
      : null;

  return (
    <div className={`bg-gray-50 rounded-lg p-4 space-y-2 text-sm ${className || ""}`}>
      <Row
        label={
          input.nights && nightlyRate
            ? `Base (${formatCurrency(nightlyRate)} × ${input.nights} ${input.nights === 1 ? "noite" : "noites"})`
            : "Base"
        }
        value={formatCurrency(input.base_amount_cents)}
      />
      {input.cleaning_fee_cents > 0 && (
        <Row label="Cleaning fee" value={formatCurrency(input.cleaning_fee_cents)} />
      )}
      {input.extra_guest_fee_cents > 0 && (
        <Row
          label="Extra guests"
          value={formatCurrency(input.extra_guest_fee_cents)}
        />
      )}
      {input.discount_cents > 0 && (
        <Row
          label="Discount"
          value={`− ${formatCurrency(input.discount_cents)}`}
          tone="positive"
        />
      )}
      <Row label="Subtotal" value={formatCurrency(subtotal_cents)} muted />
      {input.tax_cents > 0 && (
        <Row label="Tax" value={formatCurrency(input.tax_cents)} muted />
      )}

      <div className="pt-2 mt-2 border-t border-gray-200">
        <Row
          label="Total"
          value={formatCurrency(total_cents)}
          strong
        />
      </div>
      {input.platform_fee_cents > 0 && (
        <>
          <Row
            label="Platform fee"
            value={`− ${formatCurrency(input.platform_fee_cents)}`}
            muted
          />
          <Row label="Net" value={formatCurrency(net_amount_cents)} tone="positive" strong />
        </>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  muted = false,
  strong = false,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  strong?: boolean;
  tone?: "positive";
}) {
  return (
    <div
      className={`flex justify-between gap-2 ${
        muted ? "text-gray-500" : "text-gray-700"
      }`}
    >
      <span className={strong ? "font-semibold text-gray-900" : ""}>{label}</span>
      <span
        className={`font-mono ${strong ? "font-bold text-base text-gray-900" : ""} ${
          tone === "positive" ? "text-green-700" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
