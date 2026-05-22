from dataclasses import dataclass
from itertools import combinations
import logging
from pathlib import Path
import re

import keras
import numpy as np

from app import config
from app.audio_features import (
    AudioFeatureExtractor,
    AudioPreprocessor,
    slice_features_for_model,
)

logger = logging.getLogger(__name__)


@dataclass
class LoadedModel:
    name: str
    path: Path
    features: list[str]
    input_shape: tuple[int | None, ...]
    model: keras.Model


class EnsemblePredictor:
    def __init__(self) -> None:
        self.preprocessor = AudioPreprocessor()
        self.feature_extractor = AudioFeatureExtractor()
        self.models: list[LoadedModel] = []
        self._loaded = False

    def load_models(self) -> None:
        if self._loaded:
            return

        loaded_models: list[LoadedModel] = []
        for model_path in config.MODEL_PATHS:
            if not model_path.exists():
                logger.warning("Model file not found, skipping: %s", model_path)
                continue

            logger.info("Loading model: %s", model_path.name)
            model = keras.models.load_model(model_path, compile=False)
            input_shape = tuple(model.input_shape)
            feature_count = int(input_shape[-1])
            features = config.FEATURE_DIM_MAP.get(feature_count)
            if features is None:
                raise ValueError(
                    f"Cannot map model input feature count {feature_count} "
                    f"for {model_path.name}."
                )

            feature_key = "+".join(features)
            loaded_models.append(
                LoadedModel(
                    name=feature_key,
                    path=model_path,
                    features=features,
                    input_shape=input_shape,
                    model=model,
                )
            )
            logger.info("Loaded model '%s' with input shape %s", feature_key, input_shape)

        if not loaded_models:
            raise RuntimeError(f"No .keras model files found in {config.MODELS_DIR}")

        self.models = loaded_models
        self._loaded = True

    def metadata(self) -> list[dict]:
        self.load_models()
        return [
            {
                "name": loaded_model.name,
                "path": str(loaded_model.path),
                "features": loaded_model.features,
                "input_shape": list(loaded_model.input_shape),
            }
            for loaded_model in self.models
        ]

    def _available_model_names(self) -> list[str]:
        self.load_models()
        available = {model.name for model in self.models}
        return [
            name for name in config.ENSEMBLE_FEATURE_ORDER if name in available
        ]

    def default_ensemble_name(self) -> str:
        self.load_models()
        default_names = set(config.DEFAULT_ENSEMBLE_FEATURES)
        available = set(self._available_model_names())
        if default_names.issubset(available):
            ordered = [
                name for name in config.ENSEMBLE_FEATURE_ORDER if name in default_names
            ]
            return "+".join(ordered)

        return "+".join(self._available_model_names())

    def available_ensemble_names(self) -> list[str]:
        names = self._available_model_names()
        ensemble_names = []
        for size in range(1, len(names) + 1):
            for combo in combinations(names, size):
                ensemble_names.append("+".join(combo))
        return ensemble_names

    @staticmethod
    def evaluation_for_name(name: str) -> dict | None:
        return config.ENSEMBLE_NOTEBOOK_METRICS.get(name)

    def available_ensemble_metrics(self) -> dict[str, dict]:
        return {
            name: metrics
            for name in self.available_ensemble_names()
            if (metrics := self.evaluation_for_name(name)) is not None
        }

    def threshold_for_name(self, name: str) -> float:
        metrics = self.evaluation_for_name(name)
        if metrics is not None:
            return float(metrics["eer_threshold"])
        return config.DECISION_THRESHOLD

    def normalize_ensemble_name(self, ensemble_name: str | None) -> str:
        selected = ensemble_name or self.default_ensemble_name()
        requested = [
            item.strip().upper()
            for item in re.split(r"[,+\s]+", selected)
            if item.strip()
        ]
        if not requested:
            requested = self.default_ensemble_name().split("+")

        available = set(self._available_model_names())
        invalid = [name for name in requested if name not in available]
        if invalid:
            raise ValueError(
                f"Unknown model feature(s): {', '.join(invalid)}. "
                f"Available features: {', '.join(self._available_model_names())}"
            )

        ordered = [
            name
            for name in config.ENSEMBLE_FEATURE_ORDER
            if name in set(requested)
        ]
        normalized = "+".join(ordered)
        if normalized not in self.available_ensemble_names():
            raise ValueError(
                f"Unknown ensemble '{selected}'. "
                f"Valid ensembles: {', '.join(self.available_ensemble_names())}"
            )
        return normalized

    @staticmethod
    def _label(probability: float, threshold: float) -> str:
        return config.LABELS[1] if probability >= threshold else config.LABELS[0]

    def _predict_models(
        self,
        full_features: np.ndarray,
        model_names: list[str],
    ) -> list[dict]:
        predictions = []
        model_by_name = {loaded_model.name: loaded_model for loaded_model in self.models}

        for model_name in model_names:
            loaded_model = model_by_name[model_name]
            threshold = self.threshold_for_name(model_name)
            evaluation = self.evaluation_for_name(model_name)
            sliced = slice_features_for_model(full_features, loaded_model.features)
            logger.info(
                "Running inference with model '%s' on %d chunk(s), batch_size=%d",
                model_name, sliced.shape[0], config.PREDICT_BATCH_SIZE,
            )
            chunk_probabilities = loaded_model.model.predict(
                sliced, batch_size=config.PREDICT_BATCH_SIZE, verbose=0
            ).flatten()
            fake_probability = float(np.mean(chunk_probabilities))
            logger.info(
                "Model '%s': fake_probability=%.4f", model_name, fake_probability
            )
            predictions.append(
                {
                    "model_name": loaded_model.name,
                    "features": loaded_model.features,
                    "fake_probability": fake_probability,
                    "real_probability": 1.0 - fake_probability,
                    "predicted_label": self._label(fake_probability, threshold),
                    "threshold": threshold,
                    "evaluation": evaluation,
                    "chunk_probabilities": [
                        float(value) for value in chunk_probabilities.tolist()
                    ],
                }
            )
        return predictions

    def _build_ensembles(
        self,
        model_predictions: list[dict],
    ) -> list[dict]:
        prediction_by_name = {
            prediction["model_name"]: prediction for prediction in model_predictions
        }
        names = [
            name
            for name in config.ENSEMBLE_FEATURE_ORDER
            if name in prediction_by_name
        ]
        ensemble_predictions = []

        for size in range(1, len(names) + 1):
            for combo in combinations(names, size):
                ensemble_name = "+".join(combo)
                evaluation = self.evaluation_for_name(ensemble_name)
                optuna_weights = (evaluation or {}).get("optuna_weights", {})

                if optuna_weights and len(combo) > 1:
                    fake_probability = float(
                        sum(
                            optuna_weights.get(name, 1.0 / len(combo))
                            * prediction_by_name[name]["fake_probability"]
                            for name in combo
                        )
                    )
                else:
                    fake_probability = float(
                        np.mean(
                            [prediction_by_name[name]["fake_probability"] for name in combo]
                        )
                    )

                threshold = self.threshold_for_name(ensemble_name)
                ensemble_predictions.append(
                    {
                        "ensemble_name": ensemble_name,
                        "model_names": list(combo),
                        "fake_probability": fake_probability,
                        "real_probability": 1.0 - fake_probability,
                        "predicted_label": self._label(fake_probability, threshold),
                        "threshold": threshold,
                        "evaluation": evaluation,
                    }
                )

        return ensemble_predictions

    def predict_file(
        self,
        file_path: Path,
        filename: str,
        ensemble_name: str | None = None,
        include_all_ensembles: bool | None = None,
    ) -> dict:
        self.load_models()
        selected_ensemble_name = self.normalize_ensemble_name(ensemble_name)
        selected_model_names = selected_ensemble_name.split("+")
        should_include_all = (
            config.RETURN_ALL_ENSEMBLES
            if include_all_ensembles is None
            else include_all_ensembles
        )
        model_names_to_predict = (
            self._available_model_names() if should_include_all else selected_model_names
        )

        logger.info(
            "predict_file: file=%s ensemble=%s threshold=%.2f",
            filename, selected_ensemble_name, self.threshold_for_name(selected_ensemble_name),
        )
        audio_result = self.preprocessor.process(file_path)
        logger.info(
            "Audio processed: %d chunk(s), %.2fs trimmed",
            audio_result.chunk_count, audio_result.trimmed_duration_seconds,
        )
        full_features = self.feature_extractor.extract_features(audio_result.chunks)
        model_predictions = self._predict_models(
            full_features,
            model_names_to_predict,
        )
        ensemble_predictions = self._build_ensembles(model_predictions)

        selected = next(
            (
                prediction
                for prediction in ensemble_predictions
                if prediction["ensemble_name"] == selected_ensemble_name
            ),
            None,
        )
        if selected is None:
            raise ValueError(
                f"Selected ensemble '{selected_ensemble_name}' was not produced. "
                f"Predicted model set: {', '.join(model_names_to_predict)}"
            )

        if not should_include_all:
            ensemble_predictions = [selected]

        return {
            "audio": {
                "filename": filename,
                "input_sample_rate": audio_result.input_sample_rate,
                "original_duration_seconds": audio_result.original_duration_seconds,
                "resampled_duration_seconds": audio_result.resampled_duration_seconds,
                "trimmed_duration_seconds": audio_result.trimmed_duration_seconds,
                "chunk_count": audio_result.chunk_count,
                "feature_shape": list(full_features.shape),
            },
            "default_ensemble": selected_ensemble_name,
            "available_ensembles": self.available_ensemble_names(),
            "include_all_ensembles": should_include_all,
            "prediction": selected,
            "model_predictions": model_predictions,
            "ensemble_predictions": ensemble_predictions,
        }


predictor = EnsemblePredictor()
