import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon } from "@hugeicons/core-free-icons"

import { ProbabilityBars } from "@/features/prediction/components/ProbabilityBars"
import { InfoHint } from "@/features/prediction/components/InfoHint"
import { SummaryRing } from "@/features/prediction/components/SummaryRing"
import type {
  PredictionResponse,
  PredictionSummary,
  ProbabilityRow,
} from "@/features/prediction/types"
import { formatPercent, readThreshold } from "@/features/prediction/utils"

export function ResultsSection({
  result,
  predictedSummary,
  selectedEnsemble,
  modelRows,
  ensembleRows,
  onReset,
}: {
  result: PredictionResponse
  predictedSummary: PredictionSummary
  selectedEnsemble: string
  modelRows: ProbabilityRow[]
  ensembleRows: ProbabilityRow[]
  onReset: () => void
}) {
  const mainLabel = predictedSummary.label ?? "Pending"
  const mainFakeProbability = predictedSummary.fakeProbability
  const mainRealProbability = predictedSummary.realProbability
  const predictionThreshold = readThreshold(result.prediction)

  return (
    <section className="space-y-4">
      <Card className="rounded-[22px] border-border shadow-sm">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle>Main prediction</CardTitle>
              <CardDescription>
                The selected ensemble result and probability split.
              </CardDescription>
            </div>

            <Badge
              variant={
                mainLabel.toLowerCase().includes("fake")
                  ? "destructive"
                  : "secondary"
              }
            >
              {mainLabel}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
          <SummaryRing fake={mainFakeProbability} real={mainRealProbability} />

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/15 p-4">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Prediction label
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight">
                {mainLabel}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {predictedSummary.confidence != null ? (
                  <>confidence {formatPercent(predictedSummary.confidence)}</>
                ) : mainFakeProbability != null || mainRealProbability != null ? (
                  <>
                    fake {formatPercent(mainFakeProbability)} · real{" "}
                    {formatPercent(mainRealProbability)}
                  </>
                ) : (
                  <>No probability values returned by the backend.</>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Selected ensemble
                </div>
                <div className="mt-2 font-medium">{selectedEnsemble}</div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <span>Threshold</span>
                  <InfoHint content="This threshold comes from the backend's notebook-based EER setting for the selected model combination. The final label is decided by comparing fake probability against this value, so labels can differ from a simple 0.50 cutoff." />
                </div>
                <div className="mt-2 font-medium">
                  {predictionThreshold != null ? predictionThreshold.toFixed(4) : "-"}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Fake probability
                </div>
                <div className="mt-2 text-lg font-semibold text-destructive">
                  {formatPercent(mainFakeProbability)}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Real probability
                </div>
                <div className="mt-2 text-lg font-semibold">
                  {formatPercent(mainRealProbability)}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProbabilityBars
          title="Per-model predictions"
          description="Probability split per base model."
          rows={modelRows}
        />

        <ProbabilityBars
          title="Ensemble predictions"
          description="Probability split per ensemble output."
          rows={ensembleRows}
        />
      </div>

      <Card className="rounded-[22px] border-border shadow-sm">
        <CardHeader>
          <CardTitle>Backend response</CardTitle>
          <CardDescription>
            Raw payload returned by the backend for this request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="max-h-96 overflow-auto rounded-xl border border-border bg-background p-4 text-xs leading-relaxed">
            {JSON.stringify(result, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Button
        type="button"
        variant="outline"
        className="h-14 w-full rounded-[18px]"
        onClick={onReset}
      >
        <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
        Reset analysis
      </Button>
    </section>
  )
}
