from pydantic import BaseModel, Field


class ModelMetadata(BaseModel):
    name: str
    path: str
    features: list[str]
    input_shape: list[int | None]


class EvaluationMetrics(BaseModel):
    source_name: str
    accuracy: float = Field(ge=0.0, le=1.0)
    precision: float = Field(ge=0.0, le=1.0)
    recall: float = Field(ge=0.0, le=1.0)
    f1_score: float = Field(ge=0.0, le=1.0)
    auc: float = Field(ge=0.0, le=1.0)
    eer: float = Field(ge=0.0, le=1.0)
    eer_threshold: float = Field(ge=0.0, le=1.0)
    tp: int = Field(ge=0)
    fp: int = Field(ge=0)
    tn: int = Field(ge=0)
    fn: int = Field(ge=0)


class AudioMetadata(BaseModel):
    filename: str
    input_sample_rate: int
    original_duration_seconds: float
    resampled_duration_seconds: float
    trimmed_duration_seconds: float
    chunk_count: int
    feature_shape: list[int]


class ModelPrediction(BaseModel):
    model_name: str
    features: list[str]
    fake_probability: float = Field(ge=0.0, le=1.0)
    real_probability: float = Field(ge=0.0, le=1.0)
    predicted_label: str
    threshold: float
    chunk_probabilities: list[float]
    evaluation: EvaluationMetrics | None = None


class EnsemblePrediction(BaseModel):
    ensemble_name: str
    model_names: list[str]
    fake_probability: float = Field(ge=0.0, le=1.0)
    real_probability: float = Field(ge=0.0, le=1.0)
    predicted_label: str
    threshold: float
    evaluation: EvaluationMetrics | None = None


class PredictionResponse(BaseModel):
    audio: AudioMetadata
    default_ensemble: str
    available_ensembles: list[str]
    include_all_ensembles: bool
    prediction: EnsemblePrediction
    model_predictions: list[ModelPrediction]
    ensemble_predictions: list[EnsemblePrediction]


class RuntimeConfigResponse(BaseModel):
    default_ensemble_features: list[str]
    default_ensemble: str
    ensemble_feature_order: list[str]
    decision_threshold: float
    return_all_ensembles: bool
    available_ensembles: list[str]
    ensemble_metrics: dict[str, EvaluationMetrics]


class HealthResponse(BaseModel):
    status: str
    loaded_models: int
    default_ensemble_features: list[str]
    default_ensemble: str
    ensemble_feature_order: list[str]
    decision_threshold: float
    return_all_ensembles: bool
    available_ensembles: list[str]
    ensemble_metrics: dict[str, EvaluationMetrics]
    models: list[ModelMetadata]
