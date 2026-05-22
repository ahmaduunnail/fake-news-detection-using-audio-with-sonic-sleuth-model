from dataclasses import dataclass
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
from pydub import AudioSegment
from scipy.fftpack import dct

from app import config


@dataclass(frozen=True)
class AudioProcessingResult:
    chunks: np.ndarray
    input_sample_rate: int
    original_duration_seconds: float
    resampled_duration_seconds: float
    trimmed_duration_seconds: float

    @property
    def chunk_count(self) -> int:
        return int(self.chunks.shape[0])


class AudioPreprocessor:
    PEAK_NORM_DBFS = -3.0
    TRIM_TOP_DB = 30

    def __init__(
        self,
        target_sr: int = config.TARGET_SR,
        chunk_duration: float = config.CHUNK_DURATION,
        silence_threshold: float = config.SILENCE_THRESHOLD,
    ) -> None:
        self.target_sr = target_sr
        self.chunk_duration = chunk_duration
        self.chunk_samples = int(chunk_duration * target_sr)
        self.silence_threshold = silence_threshold

    def load_audio(self, file_path: Path) -> tuple[np.ndarray, int]:
        try:
            audio, sr = sf.read(str(file_path), dtype="float32")
            return np.asarray(audio, dtype=np.float32), int(sr)
        except Exception:
            audio_segment = AudioSegment.from_file(str(file_path))
            audio = np.array(audio_segment.get_array_of_samples(), dtype=np.float32)
            audio = audio / float(2 ** (8 * audio_segment.sample_width - 1))
            if audio_segment.channels > 1:
                audio = audio.reshape((-1, audio_segment.channels))
            return np.asarray(audio, dtype=np.float32), int(audio_segment.frame_rate)

    @staticmethod
    def to_mono(audio: np.ndarray) -> np.ndarray:
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)
        return audio.astype(np.float32, copy=False)

    def resample(self, audio: np.ndarray, sr: int) -> np.ndarray:
        if sr == self.target_sr:
            return audio
        return librosa.resample(audio, orig_sr=sr, target_sr=self.target_sr).astype(
            np.float32,
            copy=False,
        )

    def peak_normalize(self, audio: np.ndarray) -> np.ndarray:
        peak = float(np.max(np.abs(audio))) if len(audio) else 0.0
        if peak < 1e-9:
            return audio
        target_amp = 10.0 ** (self.PEAK_NORM_DBFS / 20.0)
        return (audio * (target_amp / peak)).astype(np.float32, copy=False)

    def trim_silence(self, audio: np.ndarray) -> np.ndarray:
        if len(audio) == 0:
            return audio
        trimmed, _ = librosa.effects.trim(audio, top_db=self.TRIM_TOP_DB)
        return trimmed.astype(np.float32, copy=False) if len(trimmed) > 0 else audio

    def chunk_and_repeat(self, audio: np.ndarray) -> np.ndarray:
        audio_len = len(audio)
        if audio_len == 0:
            return np.zeros((1, self.chunk_samples), dtype=np.float32)

        if audio_len < self.chunk_samples:
            num_repeats = int(np.ceil(self.chunk_samples / audio_len))
            repeated = np.tile(audio, num_repeats)[: self.chunk_samples]
            return repeated.reshape(1, self.chunk_samples).astype(np.float32, copy=False)

        num_full_chunks = audio_len // self.chunk_samples
        remainder = audio_len % self.chunk_samples
        chunks = [
            audio[i * self.chunk_samples : (i + 1) * self.chunk_samples]
            for i in range(num_full_chunks)
        ]

        if remainder > 0:
            remainder_audio = audio[num_full_chunks * self.chunk_samples :]
            num_repeats = int(np.ceil(self.chunk_samples / len(remainder_audio)))
            repeated = np.tile(remainder_audio, num_repeats)[: self.chunk_samples]
            chunks.append(repeated)

        return np.array(chunks, dtype=np.float32)

    def process(self, file_path: Path) -> AudioProcessingResult:
        audio, sr = self.load_audio(file_path)
        audio = self.to_mono(audio)
        original_duration = len(audio) / float(sr) if sr else 0.0

        audio = self.resample(audio, sr)
        resampled_duration = len(audio) / float(self.target_sr)

        audio = self.peak_normalize(audio)
        audio = self.trim_silence(audio)
        trimmed_duration = len(audio) / float(self.target_sr)

        chunks = self.chunk_and_repeat(audio)
        return AudioProcessingResult(
            chunks=chunks,
            input_sample_rate=sr,
            original_duration_seconds=original_duration,
            resampled_duration_seconds=resampled_duration,
            trimmed_duration_seconds=trimmed_duration,
        )


class AudioFeatureExtractor:
    def __init__(
        self,
        sr: int = config.TARGET_SR,
        n_fft: int = config.N_FFT,
        hop_length: int = config.HOP_LENGTH,
        n_mfcc: int = config.N_MFCC,
        n_lfcc: int = config.N_LFCC,
        n_cqt: int = config.N_CQT,
    ) -> None:
        self.sr = sr
        self.n_fft = n_fft
        self.hop_length = hop_length
        self.n_mfcc = n_mfcc
        self.n_lfcc = n_lfcc
        self.n_cqt = n_cqt
        self.expected_frames = config.EXPECTED_FRAMES
        self.total_features = config.TOTAL_FEATURES
        self.bins_per_octave = 12
        self.fmin = librosa.note_to_hz("C1")

    def extract_mfcc(self, audio_chunk: np.ndarray) -> np.ndarray:
        mfcc = librosa.feature.mfcc(
            y=audio_chunk,
            sr=self.sr,
            n_mfcc=self.n_mfcc,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            center=False,
        )
        return mfcc.T.astype(np.float32, copy=False)

    def extract_lfcc(self, audio_chunk: np.ndarray) -> np.ndarray:
        stft = librosa.stft(
            audio_chunk,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            center=False,
        )
        log_spec = np.log(np.abs(stft) + 1e-9)
        lfcc = dct(log_spec.T, type=2, norm="ortho", axis=-1)[:, : self.n_lfcc]
        return lfcc.astype(np.float32, copy=False)

    def extract_cqt(self, audio_chunk: np.ndarray) -> np.ndarray:
        cqt = librosa.cqt(
            audio_chunk,
            sr=self.sr,
            hop_length=self.hop_length,
            n_bins=self.n_cqt,
            bins_per_octave=self.bins_per_octave,
            fmin=self.fmin,
        )
        cqt_db = librosa.amplitude_to_db(np.abs(cqt), ref=np.max)
        return cqt_db.T.astype(np.float32, copy=False)

    @staticmethod
    def _cmvn(features: np.ndarray) -> np.ndarray:
        mean = features.mean(axis=0, keepdims=True)
        std = features.std(axis=0, keepdims=True) + 1e-6
        return ((features - mean) / std).astype(np.float32, copy=False)

    def extract_single_chunk(self, chunk: np.ndarray) -> np.ndarray:
        chunk = np.asarray(chunk, dtype=np.float32)
        chunk = np.squeeze(chunk)

        if len(chunk) < config.CHUNK_SAMPLES:
            chunk = np.pad(chunk, (0, config.CHUNK_SAMPLES - len(chunk)), mode="constant")
        elif len(chunk) > config.CHUNK_SAMPLES:
            chunk = chunk[: config.CHUNK_SAMPLES]

        feature_list = [
            self.extract_mfcc(chunk),
            self.extract_lfcc(chunk),
            self.extract_cqt(chunk),
        ]
        min_frames = min(feature.shape[0] for feature in feature_list)
        feature_list = [feature[:min_frames] for feature in feature_list]
        features = np.concatenate(feature_list, axis=1)

        if features.shape[0] < self.expected_frames:
            pad_frames = self.expected_frames - features.shape[0]
            features = np.pad(features, ((0, pad_frames), (0, 0)), mode="constant")
        elif features.shape[0] > self.expected_frames:
            features = features[: self.expected_frames]

        return self._cmvn(features)

    def extract_features(self, chunks: np.ndarray) -> np.ndarray:
        chunks = np.asarray(chunks, dtype=np.float32)
        return np.stack(
            [self.extract_single_chunk(chunk) for chunk in chunks],
            axis=0,
        ).astype(np.float32, copy=False)


def slice_features_for_model(
    full_features: np.ndarray,
    feature_names: list[str],
) -> np.ndarray:
    ordered_features = ["MFCC", "LFCC", "CQT"]
    slices = []
    for feature_name in ordered_features:
        if feature_name in feature_names:
            start, end = config.FEATURE_SLICES[feature_name]
            if full_features.ndim == 2:
                slices.append(full_features[:, start:end])
            else:
                slices.append(full_features[:, :, start:end])

    if not slices:
        raise ValueError("At least one feature name must be selected.")

    axis = 1 if full_features.ndim == 2 else 2
    return np.concatenate(slices, axis=axis).astype(np.float32, copy=False)
