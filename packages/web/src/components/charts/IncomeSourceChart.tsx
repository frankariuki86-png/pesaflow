import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function IncomeSourceChart({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data.length) {
    return <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-sm text-muted">No income source data yet.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E1E8EF" />
          <XAxis type="number" stroke="#667085" tickFormatter={(value) => `KES ${Number(value) / 1000}K`} />
          <YAxis type="category" dataKey="name" width={80} stroke="#667085" fontSize={12} />
          <Tooltip formatter={(value: number) => `KES ${Number(value).toLocaleString()}`} />
          <Bar dataKey="value" fill="#10B981" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
