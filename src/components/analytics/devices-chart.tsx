"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["#144ee3", "#1eb036", "#eb568e", "#b0901e", "#777a85"];

interface Props {
  data: { device: string; clicks: number }[];
}

export function DevicesChart({ data }: Props) {
  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <h3 className="text-foreground mb-4 text-sm font-semibold">Devices</h3>
      {data.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">No device data yet</p>
      ) : (
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="50%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="clicks"
                nameKey="device"
                cx="50%"
                cy="50%"
                outerRadius={80}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-col gap-2">
            {data.map((item, i) => (
              <div key={item.device} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
                <span className="text-muted-foreground capitalize">{item.device}</span>
                <span className="text-foreground font-medium">{item.clicks}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
