"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface MonthlyDatum {
  month: string;
  gross_cents: number;
  net_cents: number;
}

interface Props {
  data: MonthlyDatum[];
}

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function fmtBRL(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value / 100);
}

function monthLabel(yyyymm: string) {
  const m = parseInt(yyyymm.slice(5, 7), 10);
  return MONTH_SHORT[m - 1] || yyyymm.slice(5);
}

export function RevenueChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-sm text-gray-400">
        Sem dados de receita no período.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: monthLabel(d.month),
    Gross: d.gross_cents,
    Net: d.net_cents,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#94a3b8"
            tickFormatter={(v: number) => `R$${Math.round(v / 100000)}k`}
          />
          <Tooltip
            formatter={(value: number) => fmtBRL(value)}
            labelStyle={{ color: "#1f2937", fontWeight: 600 }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              fontSize: 12,
            }}
          />
          <Bar dataKey="Gross" fill="#6B7F5E" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Net" fill="#C9BBA4" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
