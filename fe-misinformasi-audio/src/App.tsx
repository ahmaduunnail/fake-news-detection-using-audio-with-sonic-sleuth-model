import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react"

import { ThemeSwitcher } from "@/components/theme-switcher"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"

import {
  DEFAULT_API_BASE_URL,
  DEFAULT_ENSEMBLE,
} from "@/features/prediction/constants"
import { BackendStatusIndicator } from "@/features/prediction/components/BackendStatusIndicator"
import { HeroUploadSection } from "@/features/prediction/components/HeroUploadSection"
import { PreviewCard } from "@/features/prediction/components/PreviewCard"
import { ResultsSection } from "@/features/prediction/components/ResultsSection"
import { SettingsCard } from "@/features/prediction/components/SettingsCard"
import type {
  BackendConfig,
  PredictionResponse,
} from "@/features/prediction/types"
import {
  formatBytes,
  formatDuration,
  getErrorMessage,
  summarizePrediction,
  toProbabilityRows,
} from "@/features/prediction/utils"

export default function App() {
  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
    []
  )

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const [selectedEnsemble, setSelectedEnsemble] = useState(DEFAULT_ENSEMBLE)
  const [ensembleOptions, setEnsembleOptions] = useState<string[]>([
    DEFAULT_ENSEMBLE,
  ])
  const [includeAllEnsembles, setIncludeAllEnsembles] = useState(false)
  const [configStatus, setConfigStatus] = useState<
    "idle" | "loading" | "ready" | "offline"
  >("idle")
  const [config, setConfig] = useState<BackendConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const previewRef = useRef<HTMLDivElement | null>(null)
  const resultRef = useRef<HTMLDivElement | null>(null)
  const previewUrlRef = useRef<string | null>(null)

  const handleSelectedFile = useCallback((file: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }

    if (
      file &&
      (file.type.startsWith("audio/") || file.type.startsWith("video/"))
    ) {
      const objectUrl = URL.createObjectURL(file)
      previewUrlRef.current = objectUrl
      setPreviewUrl(objectUrl)
    } else {
      setPreviewUrl(null)
    }

    setSelectedFile(file)
    setMediaDuration(null)
    setResult(null)
    setSubmitError(null)
  }, [])

  const handleReset = useCallback(() => {
    handleSelectedFile(null)
    setSelectedEnsemble(config?.default_ensemble ?? DEFAULT_ENSEMBLE)
    setIncludeAllEnsembles(
      typeof config?.return_all_ensembles === "boolean"
        ? config.return_all_ensembles
        : false
    )
  }, [config, handleSelectedFile])

  const loadConfig = useCallback(
    async (signal?: AbortSignal) => {
      setConfigStatus("loading")
      setConfigError(null)

      try {
        const response = await fetch(`${apiBaseUrl}/config`, { signal })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const payload = (await response.json()) as BackendConfig
        if (signal?.aborted) return

        setConfig(payload)

        const nextEnsembles = Array.isArray(payload.available_ensembles)
          ? payload.available_ensembles.filter(Boolean)
          : []

        const selectedDefault =
          typeof payload.default_ensemble === "string" && payload.default_ensemble
            ? payload.default_ensemble
            : DEFAULT_ENSEMBLE

        if (nextEnsembles.length > 0) {
          setEnsembleOptions((current) =>
            Array.from(
              new Set([
                selectedDefault,
                DEFAULT_ENSEMBLE,
                ...nextEnsembles,
                ...current,
              ])
            )
          )
        }

        setSelectedEnsemble(selectedDefault)

        const nextIncludeAll =
          typeof payload.return_all_ensembles === "boolean"
            ? payload.return_all_ensembles
            : payload.include_all_ensembles
        if (typeof nextIncludeAll === "boolean") {
          setIncludeAllEnsembles(nextIncludeAll)
        }

        setConfigStatus("ready")
      } catch (error) {
        if (signal?.aborted) return
        setConfigStatus("offline")
        setConfigError(
          error instanceof Error ? error.message : "Unable to load backend config"
        )
      }
    },
    [apiBaseUrl]
  )

  const checkBackendConnection = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const response = await fetch(`${apiBaseUrl}/config`, { signal })
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        if (signal?.aborted) return

        setConfigStatus("ready")
        setConfigError(null)
      } catch (error) {
        if (signal?.aborted) return
        setConfigStatus("offline")
        setConfigError(
          error instanceof Error ? error.message : "Unable to reach backend"
        )
      }
    },
    [apiBaseUrl]
  )

  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      void loadConfig(controller.signal)
    }, 0)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [loadConfig])

  useEffect(() => {
    const controller = new AbortController()
    const interval = window.setInterval(() => {
      void checkBackendConnection(controller.signal)
    }, 5000)

    return () => {
      window.clearInterval(interval)
      controller.abort()
    }
  }, [checkBackendConnection])

  useEffect(
    () => () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = null
      }
    },
    []
  )

  useEffect(() => {
    if (selectedFile && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [selectedFile])

  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [result])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedFile) {
      setSubmitError("Pilih file audio atau video terlebih dahulu.")
      return
    }

    const formData = new FormData()
    formData.append("file", selectedFile)
    formData.append("ensemble", selectedEnsemble)
    if (includeAllEnsembles) {
      formData.append("include_all_ensembles", "true")
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch(`${apiBaseUrl}/predict`, {
        method: "POST",
        body: formData,
      })

      const responseText = await response.text()
      if (!response.ok) {
        throw new Error(getErrorMessage(response, responseText))
      }

      let payload: PredictionResponse
      try {
        payload = responseText ? (JSON.parse(responseText) as PredictionResponse) : {}
      } catch {
        throw new Error("Backend returned an invalid JSON response.")
      }

      setResult(payload)

      const nextEnsembles = Array.isArray(payload.available_ensembles)
        ? payload.available_ensembles.filter(Boolean)
        : []
      if (nextEnsembles.length > 0) {
        setEnsembleOptions((current) =>
          Array.from(new Set([...nextEnsembles, ...current, selectedEnsemble]))
        )
      }
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Prediction request failed."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const predictedSummary = summarizePrediction(result?.prediction)
  const modelRows = toProbabilityRows(result?.model_predictions)
  const ensembleRows = toProbabilityRows(
    result?.ensemble_predictions,
    Array.isArray(result?.available_ensembles)
      ? result.available_ensembles.filter(
          (ensemble): ensemble is string =>
            typeof ensemble === "string" && ensemble.trim().length > 0
        )
      : undefined
  )

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top_left,var(--app-bg-accent-1),transparent_34%),radial-gradient(circle_at_bottom_right,var(--app-bg-accent-2),transparent_30%),linear-gradient(180deg,var(--app-bg-start),var(--app-bg-end))]">
      <div className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <div className="text-lg font-semibold tracking-tight">
              Audio misinformation prediction
            </div>
            <div className="text-xs text-muted-foreground">
              Upload one file, then review the result cards and charts.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BackendStatusIndicator configStatus={configStatus} />
            <ThemeSwitcher />
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {configError ? (
          <Alert variant="destructive">
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
            <AlertTitle>Config unavailable</AlertTitle>
            <AlertDescription>{configError}</AlertDescription>
          </Alert>
        ) : null}

        {!result ? (
          <HeroUploadSection
            selectedFile={selectedFile}
            onSelectFile={handleSelectedFile}
          />
        ) : null}

        {selectedFile ? (
          <section
            ref={previewRef}
            className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
          >
            <PreviewCard
              selectedFile={selectedFile}
              previewUrl={previewUrl}
              fileName={selectedFile.name ?? "-"}
              fileType={selectedFile.type || "unknown"}
              fileDuration={formatDuration(mediaDuration)}
              onLoadedMetadata={setMediaDuration}
            />

            <SettingsCard
              defaultEnsemble={DEFAULT_ENSEMBLE}
              selectedEnsemble={selectedEnsemble}
              ensembleOptions={ensembleOptions}
              includeAllEnsembles={includeAllEnsembles}
              isSubmitting={isSubmitting}
              submitError={submitError}
              fileSize={formatBytes(selectedFile.size)}
              configStatus={configStatus}
              onSelectedEnsembleChange={setSelectedEnsemble}
              onIncludeAllEnsemblesChange={setIncludeAllEnsembles}
              onSubmit={handleSubmit}
            />
          </section>
        ) : null}

        {result ? (
          <div ref={resultRef}>
            <ResultsSection
              result={result}
              predictedSummary={predictedSummary}
              selectedEnsemble={selectedEnsemble}
              modelRows={modelRows}
              ensembleRows={ensembleRows}
              onReset={handleReset}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}
