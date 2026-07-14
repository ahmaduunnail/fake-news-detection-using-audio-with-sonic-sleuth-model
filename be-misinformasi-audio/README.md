# Misinformasi Audio Backend

> [!IMPORTANT]  
> Tolong untuk download model terlebh dahulu, cukuo di unzip di folder ini, nanti akan muncul folder '/models'
>
> https://drive.google.com/file/d/1dyRN-xzrsyqR6WnGynnBK_P56eD431C2/view?usp=sharing.


FastAPI backend for audio deepfake/misinformation inference using the existing
Keras models in `models/`.

## Runtime

Use `uv` and the project virtual environment only.

```bash
uv --cache-dir /private/tmp/uv-cache run uvicorn main:app --host 127.0.0.1 --port 8000
```

## Ensemble Contract

The backend follows the notebook ensemble pipeline:

- Load audio.
- Convert to mono.
- Resample to 16 kHz.
- Peak-normalize to `-3 dBFS`.
- Trim leading/trailing silence with `librosa.effects.trim(top_db=30)`.
- Split into 4-second chunks.
- Extract MFCC, LFCC, and CQT into `(chunks, 397, 117)`.
- Slice features per model:
  - `MFCC`: `[0:13]`
  - `LFCC`: `[13:33]`
  - `CQT`: `[33:117]`
- Predict per chunk.
- Average chunk probabilities into one file-level probability per model.
- Average model probabilities for ensemble predictions.

The sigmoid output is interpreted as probability of `fake`.
Classification thresholds are selected by the backend per model/ensemble using
the notebook EER summary when available.

The default ensemble is `MFCC+CQT`. By default the API only runs the selected
ensemble's models. You can opt into notebook-style all-combination output with
`include_all_ensembles=true`.

Runtime config can be adjusted with environment variables before starting the
server:

```bash
DEFAULT_ENSEMBLE_FEATURES=MFCC,CQT \
ENSEMBLE_FEATURE_ORDER=MFCC,LFCC,CQT \
RETURN_ALL_ENSEMBLES=false \
uv --cache-dir /private/tmp/uv-cache run uvicorn main:app --host 127.0.0.1 --port 8000
```

## Endpoints

- `GET /health`: backend status and loaded model metadata.
- `GET /config`: active ensemble configuration.
- `GET /models`: loaded model metadata.
- `POST /predict`: multipart upload inference.

Example:

```bash
curl -X POST http://127.0.0.1:8000/predict \
  -F file=@/path/to/audio.wav
```

Optional form fields:

- `ensemble`: e.g. `MFCC+CQT`, `MFCC`, `CQT`, `MFCC+LFCC+CQT`.
- `include_all_ensembles`: `true` to return every available combination.
