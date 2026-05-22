import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Pie,
  PieChart,
  Cell,
} from "recharts"

import {
  formatPercent,
  probabilityChartConfig,
} from "@/features/prediction/utils"

export function SummaryRing({
  fake,
  real,
}: {
  fake: number | null
  real: number | null
}) {
  const data = [
    { name: "Fake", value: fake ?? 0 },
    { name: "Real", value: real ?? 0 },
  ]

  return (
    <ChartContainer config={probabilityChartConfig} className="h-64 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => [formatPercent(Number(value)), name]}
            />
          }
        />
        <Pie
          data={data}
          dataKey="value"
          innerRadius={42}
          outerRadius={92}
          paddingAngle={6}
          cornerRadius={16}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry.name === "Fake" ? "var(--chart-1)" : "var(--chart-2)"}
            />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
