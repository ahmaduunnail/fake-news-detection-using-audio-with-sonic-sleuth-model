import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"

import type { ProbabilityRow } from "@/features/prediction/types"
import {
  formatPercent,
  probabilityChartConfig,
} from "@/features/prediction/utils"

export function ProbabilityBars({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: ProbabilityRow[]
}) {
  return (
    <Card className="rounded-[22px] border-border shadow-sm">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <ChartContainer config={probabilityChartConfig} className="h-80 w-full">
            <BarChart
              data={rows}
              barCategoryGap={18}
              barGap={2}
              margin={{ left: 0, right: 8, top: 8 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tickMargin={12}
              />
              <YAxis
                tickFormatter={(value) => formatPercent(Number(value))}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => [formatPercent(Number(value)), name]}
                  />
                }
              />
              <Bar dataKey="fake" stackId="a" fill="var(--chart-1)" radius={12} />
              <Bar dataKey="real" stackId="a" fill="var(--chart-2)" radius={12} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
            No graph data returned yet.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
