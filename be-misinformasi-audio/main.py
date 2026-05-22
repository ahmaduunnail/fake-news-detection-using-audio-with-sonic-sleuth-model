from contextlib import asynccontextmanager
import logging
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from app import config
from app.model_service import predictor
from app.schemas import (
    HealthResponse,
    ModelMetadata,
    PredictionResponse,
    RuntimeConfigResponse,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up: loading models from %s", config.MODELS_DIR)
    predictor.load_models()
    logger.info("Models loaded. Default ensemble: %s", predictor.default_ensemble_name())
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="Misinformasi Audio Detection API",
    description="Ensemble inference API for public-figure deepfake audio detection.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> dict:
    models = [ModelMetadata(**metadata) for metadata in predictor.metadata()]
    return {
        "status": "ok",
        "loaded_models": len(models),
        "default_ensemble_features": config.DEFAULT_ENSEMBLE_FEATURES,
        "default_ensemble": predictor.default_ensemble_name(),
        "ensemble_feature_order": config.ENSEMBLE_FEATURE_ORDER,
        "decision_threshold": config.DECISION_THRESHOLD,
        "return_all_ensembles": config.RETURN_ALL_ENSEMBLES,
        "available_ensembles": predictor.available_ensemble_names(),
        "ensemble_metrics": predictor.available_ensemble_metrics(),
        "models": models,
    }


@app.get("/config", response_model=RuntimeConfigResponse)
def runtime_config() -> dict:
    return {
        "default_ensemble_features": config.DEFAULT_ENSEMBLE_FEATURES,
        "default_ensemble": predictor.default_ensemble_name(),
        "ensemble_feature_order": config.ENSEMBLE_FEATURE_ORDER,
        "decision_threshold": config.DECISION_THRESHOLD,
        "return_all_ensembles": config.RETURN_ALL_ENSEMBLES,
        "available_ensembles": predictor.available_ensemble_names(),
        "ensemble_metrics": predictor.available_ensemble_metrics(),
    }


@app.get("/models", response_model=list[ModelMetadata])
def models() -> list[ModelMetadata]:
    return [ModelMetadata(**metadata) for metadata in predictor.metadata()]


@app.post("/predict", response_model=PredictionResponse)
async def predict(
    file: UploadFile = File(...),
    ensemble: str | None = Form(default=None),
    include_all_ensembles: bool | None = Form(default=None),
) -> dict:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in config.SUPPORTED_EXTENSIONS:
        supported = ", ".join(sorted(config.SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file extension '{suffix}'. Supported: {supported}",
        )

    uploaded = await file.read()
    if not uploaded:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    temp_path: Path | None = None
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_file.write(uploaded)
            temp_path = Path(temp_file.name)

        return predictor.predict_file(
            file_path=temp_path,
            filename=file.filename or temp_path.name,
            ensemble_name=ensemble,
            include_all_ensembles=include_all_ensembles,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
