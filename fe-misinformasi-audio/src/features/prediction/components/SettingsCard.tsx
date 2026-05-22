import type { FormEvent } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  PlayCircleIcon,
} from "@hugeicons/core-free-icons"

import { InfoHint } from "@/features/prediction/components/InfoHint"
import { Spinner } from "@/features/prediction/components/Spinner"

export function SettingsCard({
  defaultEnsemble,
  selectedEnsemble,
  ensembleOptions,
  includeAllEnsembles,
  isSubmitting,
  submitError,
  fileSize,
  configStatus,
  onSelectedEnsembleChange,
  onIncludeAllEnsemblesChange,
  onSubmit,
}: {
  defaultEnsemble: string
  selectedEnsemble: string
  ensembleOptions: string[]
  includeAllEnsembles: boolean
  isSubmitting: boolean
  submitError: string | null
  fileSize: string
  configStatus: "idle" | "loading" | "ready" | "offline"
  onSelectedEnsembleChange: (value: string) => void
  onIncludeAllEnsemblesChange: (value: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <Card className="rounded-[22px] border-border shadow-sm">
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Choose the ensemble and backend response options for this request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form id="predict-form" className="space-y-5" onSubmit={onSubmit}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ensemble">Ensemble</Label>
              <Badge variant="outline">default {defaultEnsemble}</Badge>
            </div>
            <Select value={selectedEnsemble} onValueChange={onSelectedEnsembleChange}>
              <SelectTrigger id="ensemble" className="w-full">
                <SelectValue placeholder="Select ensemble" />
              </SelectTrigger>
              <SelectContent>
                {ensembleOptions.map((ensemble) => (
                  <SelectItem key={ensemble} value={ensemble}>
                    {ensemble}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="include-all" className="text-sm">
                  Include all ensembles
                </Label>
                <InfoHint content="When enabled, the backend returns the full ensemble output instead of only the selected ensemble." />
              </div>
              <p className="text-xs text-muted-foreground">
                Returns the optional extra outputs for comparison.
              </p>
            </div>
            <Switch
              id="include-all"
              checked={includeAllEnsembles}
              onCheckedChange={onIncludeAllEnsemblesChange}
            />
          </div>

          <Button className="h-14 w-full text-base" disabled={isSubmitting} type="submit">
            {isSubmitting ? (
              <>
                <Spinner />
                Predicting...
              </>
            ) : (
              <>
                <HugeiconsIcon icon={PlayCircleIcon} strokeWidth={2} />
                Predict
              </>
            )}
          </Button>

          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">File size</span>
              <span className="font-medium">{fileSize}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Backend</span>
              <span className="font-medium">
                {configStatus === "ready"
                  ? "Ready"
                  : configStatus === "loading"
                    ? "Loading"
                    : configStatus === "offline"
                      ? "Offline"
                      : "Idle"}
              </span>
            </div>
          </div>

          {submitError ? (
            <Alert variant="destructive">
              <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
              <AlertTitle>Prediction failed</AlertTitle>
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}

          {isSubmitting ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
              <Spinner />
              Processing the file and generating predictions.
            </div>
          ) : null}
        </form>
      </CardContent>
    </Card>
  )
}
