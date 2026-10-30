from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache
from pydantic import SecretStr, field_validator
from typing import Literal


class Settings(BaseSettings):
    app_name: str = "Dobbe Backend"
    debug: bool = False
    roboflow_api_key: str

    # Model configuration
    default_model_id: str = "p_fase_1_v2/4"
    research_provider: Literal["groq", "gemini"] = "groq"
    groq_api_key: SecretStr | None = None
    groq_research_model: str = "qwen/qwen3.8-27b"
    google_api_key: SecretStr | None = None
    google_research_model: str = "gemini-flash-latest"

    @field_validator("groq_api_key", "google_api_key", mode="before")
    @classmethod
    def empty_research_key_is_unconfigured(
        cls, value: str | SecretStr | None
    ) -> str | SecretStr | None:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    # File upload settings - Define constants clearly
    MAX_FILE_SIZE_MB: int = 10
    max_file_size: int = MAX_FILE_SIZE_MB * 1024 * 1024  # 10MB in bytes
    allowed_file_types: list = ["image/jpeg", "image/png", "image/jpg"]
    allowed_dicom_file_types: list = ["application/dicom", "application/octet-stream"]

    # File type extensions for validation
    ALLOWED_IMAGE_EXTENSIONS: list = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"]
    ALLOWED_DICOM_EXTENSIONS: list = [
        ".dcm",
        ".dicom",
        ".rvg",
        ".DCM",
        ".DICOM",
        ".RVG",
    ]

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache()
def get_settings() -> Settings:
    return Settings()
