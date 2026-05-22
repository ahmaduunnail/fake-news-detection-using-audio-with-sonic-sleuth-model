export type BackendConfig = {
  available_ensembles?: string[]
  default_ensemble?: string
  decision_threshold?: number
  threshold?: number
  return_all_ensembles?: boolean
  include_all_ensembles?: boolean
  [key: string]: unknown
}

export type PredictionResponse = {
  prediction?: unknown
  model_predictions?: unknown
  ensemble_predictions?: unknown
  available_ensembles?: string[]
  [key: string]: unknown
}

export type PredictionSummary = {
  label: string | null
  confidence: number | null
  fakeProbability: number | null
  realProbability: number | null
  raw: unknown
}

export type ListEntry = {
  name: string
  value: unknown
}

export type ProbabilityRow = {
  name: string
  fake: number
  real: number
}

export type ConfigStatus = "idle" | "loading" | "ready" | "offline"
