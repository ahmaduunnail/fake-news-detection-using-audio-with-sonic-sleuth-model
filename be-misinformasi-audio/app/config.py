import os
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"

TARGET_SR = 16000
CHUNK_DURATION = 4.0
CHUNK_SAMPLES = int(CHUNK_DURATION * TARGET_SR)
SILENCE_THRESHOLD = 0.01

N_FFT = 512
HOP_LENGTH = 160
N_MFCC = 13
N_LFCC = 20
N_CQT = 84

EXPECTED_FRAMES = 1 + (CHUNK_SAMPLES - N_FFT) // HOP_LENGTH
TOTAL_FEATURES = N_MFCC + N_LFCC + N_CQT

LABELS = {0: "real", 1: "fake"}
FEATURE_NAMES = ["MFCC", "LFCC", "CQT"]


def _parse_bool(name: str, default: bool) -> bool:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return raw_value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return float(raw_value)


def _parse_feature_list(name: str, default: list[str]) -> list[str]:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    values = [
        item.strip().upper()
        for item in re.split(r"[,+\s]+", raw_value)
        if item.strip()
    ]
    invalid = [value for value in values if value not in FEATURE_NAMES]
    if invalid:
        raise ValueError(
            f"{name} contains unsupported feature(s): {', '.join(invalid)}. "
            f"Supported: {', '.join(FEATURE_NAMES)}"
        )
    return values or default


# Fallback only. Each model/ensemble prediction should prefer the notebook-derived
# threshold from ENSEMBLE_NOTEBOOK_METRICS when available.
DECISION_THRESHOLD = _parse_float("DECISION_THRESHOLD", 0.1122)
RETURN_ALL_ENSEMBLES = _parse_bool("RETURN_ALL_ENSEMBLES", False)
PREDICT_BATCH_SIZE = int(os.getenv("PREDICT_BATCH_SIZE", "32"))

SUPPORTED_EXTENSIONS = {
    ".wav",
    ".mp3",
    ".mp4",
    ".avi",
    ".mkv",
    ".mov",
    ".flac",
    ".ogg",
    ".m4a",
}

MODEL_PATHS = [
    MODELS_DIR / "best_model_cqt.keras",
    MODELS_DIR / "best_model_lfcc.keras",
    MODELS_DIR / "best_model_mfcc.keras",
]

FEATURE_SLICES = {
    "MFCC": (0, N_MFCC),
    "LFCC": (N_MFCC, N_MFCC + N_LFCC),
    "CQT": (N_MFCC + N_LFCC, TOTAL_FEATURES),
}

FEATURE_DIM_MAP = {
    N_MFCC: ["MFCC"],
    N_LFCC: ["LFCC"],
    N_CQT: ["CQT"],
    N_MFCC + N_LFCC: ["MFCC", "LFCC"],
    N_MFCC + N_CQT: ["MFCC", "CQT"],
    N_LFCC + N_CQT: ["LFCC", "CQT"],
    TOTAL_FEATURES: ["MFCC", "LFCC", "CQT"],
}

# MFCC+CQT chosen as default: best Recall-Fake (33.33%) on OOD evaluation — LFCC collapses on modern deepfakes
DEFAULT_ENSEMBLE_FEATURES = _parse_feature_list(
    "DEFAULT_ENSEMBLE_FEATURES",
    ["MFCC", "CQT"],
)
ENSEMBLE_FEATURE_ORDER = _parse_feature_list(
    "ENSEMBLE_FEATURE_ORDER",
    ["MFCC", "LFCC", "CQT"],
)

# Source: ensemble evaluation notebook summary shared by the user.
# Names are normalized to the backend's public ensemble naming convention.
# optuna_weights: calibrated by Optuna (200 trials, TPE, AUC objective) on the
# generalization test set. Single-model entries have weight=1.0 (nothing to optimize).
ENSEMBLE_NOTEBOOK_METRICS = {
    "MFCC+LFCC+CQT": {
        "source_name": "Model_1_CQT + Model_2_LFCC + Model_3_MFCC",
        "accuracy": 0.6000,
        "precision": 0.8889,
        "recall": 0.1778,
        "f1_score": 0.2963,
        "auc": 0.8400,
        "eer": 0.2200,
        "eer_threshold": 0.0748,
        "tp": 8,
        "fp": 1,
        "tn": 49,
        "fn": 37,
        "optuna_weights": {"MFCC": 0.4518708588656703, "LFCC": 0.44692540070993425, "CQT": 0.10120374042439544},
    },
    "MFCC+LFCC": {
        "source_name": "Model_2_LFCC + Model_3_MFCC",
        "accuracy": 0.6105,
        "precision": 1.0000,
        "recall": 0.1778,
        "f1_score": 0.3019,
        "auc": 0.8400,
        "eer": 0.2200,
        "eer_threshold": 0.0570,
        "tp": 8,
        "fp": 0,
        "tn": 50,
        "fn": 37,
        "optuna_weights": {"MFCC": 0.39660853537287133, "LFCC": 0.6033914646271287},
    },
    "MFCC+CQT": {
        "source_name": "Model_1_CQT + Model_3_MFCC",
        "accuracy": 0.6526,
        "precision": 0.8333,
        "recall": 0.3333,
        "f1_score": 0.4762,
        "auc": 0.8373,
        "eer": 0.2200,
        "eer_threshold": 0.1122,
        "tp": 15,
        "fp": 3,
        "tn": 47,
        "fn": 30,
        "optuna_weights": {"MFCC": 0.5575167127360187, "CQT": 0.4424832872639813},
    },
    "MFCC": {
        "source_name": "Model_3_MFCC",
        "accuracy": 0.6526,
        "precision": 0.8750,
        "recall": 0.3111,
        "f1_score": 0.4590,
        "auc": 0.8320,
        "eer": 0.2400,
        "eer_threshold": 0.1037,
        "tp": 14,
        "fp": 2,
        "tn": 48,
        "fn": 31,
        "optuna_weights": {"MFCC": 1.0},
    },
    "LFCC+CQT": {
        "source_name": "Model_1_CQT + Model_2_LFCC",
        "accuracy": 0.6211,
        "precision": 1.0000,
        "recall": 0.2000,
        "f1_score": 0.3333,
        "auc": 0.7969,
        "eer": 0.2400,
        "eer_threshold": 0.0621,
        "tp": 9,
        "fp": 0,
        "tn": 50,
        "fn": 36,
        "optuna_weights": {"LFCC": 0.5468292670111703, "CQT": 0.45317073298882965},
    },
    "CQT": {
        "source_name": "Model_1_CQT",
        "accuracy": 0.6737,
        "precision": 0.8500,
        "recall": 0.3778,
        "f1_score": 0.5231,
        "auc": 0.7911,
        "eer": 0.2800,
        "eer_threshold": 0.0964,
        "tp": 17,
        "fp": 3,
        "tn": 47,
        "fn": 28,
        "optuna_weights": {"CQT": 1.0},
    },
    "LFCC": {
        "source_name": "Model_2_LFCC",
        "accuracy": 0.5263,
        "precision": 0.0000,
        "recall": 0.0000,
        "f1_score": 0.0000,
        "auc": 0.6920,
        "eer": 0.3400,
        "eer_threshold": 0.0117,
        "tp": 0,
        "fp": 0,
        "tn": 50,
        "fn": 45,
        "optuna_weights": {"LFCC": 1.0},
    },
}
