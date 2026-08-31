import { LineChart, Line, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function SpendingTrendChart({ data }: { data: Array<{ label: string; value: number }> }) {
  if (!data.length) {
    return <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-6 text-sm text-muted">No spending data yet.</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E1E8EF" />
          <XAxis dataKey="label" stroke="#667085" fontSize={12} />
          <YAxis stroke="#667085" fontSize={12} tickFormatter={(value) => `KES ${Number(value) / 1000}K`} />
          <Tooltip formatter={(value: number) => `KES ${Number(value).toLocaleString()}`} />
          <Line type="monotone" dataKey="value" stroke="#22C55E" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
