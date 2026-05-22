import type { ChartConfig } from "@/components/ui/chart"

import type {
  ListEntry,
  PredictionSummary,
  ProbabilityRow,
} from "@/features/prediction/types"

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "-"
  if (bytes < 1024) return `${bytes} B`

  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

export function formatDuration(seconds: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return "-"
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const remainder = total % 60
  return `${minutes}:${String(remainder).padStart(2, "0")}`
}

export function formatPercent(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-"
  const normalized = value > 1 ? value : value * 100
  return `${normalized.toFixed(normalized >= 10 ? 1 : 2)}%`
}

export function formatLabel(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

function formatCombinationName(value: unknown) {
  if (typeof value === "string") {
    return formatLabel(value)
  }

  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatLabel(item))
      .filter((item): item is string => Boolean(item))
    return parts.length > 0 ? parts.join("+") : null
  }

  return null
}

function readNumber(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = value[key]
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate
    }
    if (typeof candidate === "string") {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

export function readThreshold(value: unknown) {
  if (!isRecord(value)) return null

  return readNumber(value, [
    "threshold",
    "eer_threshold",
    "decision_threshold",
  ])
}

function readString(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const formatted = formatLabel(value[key])
    if (formatted) return formatted
  }
  return null
}

function normalizeProbability(value: number | null) {
  if (value == null || !Number.isFinite(value)) return null
  if (value <= 1) return clamp(value, 0, 1)
  if (value <= 100) return clamp(value / 100, 0, 1)
  return null
}

export function summarizePrediction(value: unknown): PredictionSummary {
  if (typeof value === "string") {
    return {
      label: formatLabel(value),
      confidence: null,
      fakeProbability: null,
      realProbability: null,
      raw: value,
    }
  }

  if (typeof value === "number") {
    return {
      label: null,
      confidence: normalizeProbability(value),
      fakeProbability: null,
      realProbability: null,
      raw: value,
    }
  }

  if (!isRecord(value)) {
    return {
      label: null,
      confidence: null,
      fakeProbability: null,
      realProbability: null,
      raw: value,
    }
  }

  const label = readString(value, [
    "predicted_label",
    "predictedLabel",
    "prediction",
    "label",
    "class",
    "class_name",
    "result",
    "target",
  ])

  const directConfidence = normalizeProbability(
    readNumber(value, [
      "confidence",
      "score",
      "probability",
      "prob",
      "prediction_score",
    ])
  )

  let realProbability = normalizeProbability(
    readNumber(value, [
      "real_probability",
      "realProbability",
      "probability_real",
      "real_prob",
      "real",
    ])
  )
  let fakeProbability = normalizeProbability(
    readNumber(value, [
      "fake_probability",
      "fakeProbability",
      "probability_fake",
      "fake_prob",
      "fake",
    ])
  )

  const probabilities = value.probabilities
  if (isRecord(probabilities)) {
    realProbability ??= normalizeProbability(
      readNumber(probabilities, [
        "real",
        "real_probability",
        "realProbability",
        "probability_real",
        "real_prob",
      ])
    )
    fakeProbability ??= normalizeProbability(
      readNumber(probabilities, [
        "fake",
        "fake_probability",
        "fakeProbability",
        "probability_fake",
        "fake_prob",
      ])
    )
  }

  if (label && directConfidence != null) {
    const lowered = label.toLowerCase()
    if (lowered.includes("fake")) {
      fakeProbability ??= directConfidence
      realProbability ??= clamp(1 - directConfidence, 0, 1)
    } else if (lowered.includes("real")) {
      realProbability ??= directConfidence
      fakeProbability ??= clamp(1 - directConfidence, 0, 1)
    }
  }

  return {
    label,
    confidence: directConfidence,
    fakeProbability,
    realProbability,
    raw: value,
  }
}

function entriesFromValue(value: unknown, fallbackNames?: string[]): ListEntry[] {
  if (Array.isArray(value)) {
    return value.map((item, index) => {
      if (isRecord(item)) {
        const name =
          readString(item, [
            "name",
            "model",
            "model_name",
            "ensemble",
            "ensemble_name",
            "combination",
            "key",
          ]) ??
          formatCombinationName(item.models) ??
          formatCombinationName(item.features) ??
          formatCombinationName(item.model_names)

        return {
          name: name ?? fallbackNames?.[index] ?? `Ensemble ${index + 1}`,
          value: item,
        }
      }

      return {
        name: fallbackNames?.[index] ?? `Ensemble ${index + 1}`,
        value: item,
      }
    })
  }

  if (isRecord(value)) {
    return Object.entries(value).map(([name, entry]) => ({
      name,
      value: entry,
    }))
  }

  if (value == null) return []
  return [{ name: "Result", value }]
}

export function getErrorMessage(response: Response, fallbackBody: string) {
  try {
    const parsed = JSON.parse(fallbackBody) as unknown
    if (isRecord(parsed)) {
      const detail = readString(parsed, ["detail", "message", "error"])
      if (detail) return detail
    }
  } catch {
    // Ignore parse failures.
  }

  return (
    fallbackBody || response.statusText || `Request failed (${response.status})`
  )
}

export const probabilityChartConfig = {
  fake: { label: "Fake", color: "var(--chart-1)" },
  real: { label: "Real", color: "var(--chart-2)" },
} satisfies ChartConfig

export function toProbabilityRows(
  value: unknown,
  fallbackNames?: string[]
): ProbabilityRow[] {
  return entriesFromValue(value, fallbackNames)
    .map((entry) => {
      const summary = summarizePrediction(entry.value)
      const fake = summary.fakeProbability
      const real = summary.realProbability

      if (fake == null && real == null) return null

      return {
        name: entry.name,
        fake: fake ?? clamp(1 - (real ?? 0), 0, 1),
        real: real ?? clamp(1 - (fake ?? 0), 0, 1),
      }
    })
    .filter((item): item is ProbabilityRow => item !== null)
}
