from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Audio Annotator"
    debug: bool = True

    database_url: str = "sqlite:///./annotator.db"

    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    access_token_ttl_min: int = 60

    cookie_name: str = "access_token"
    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:7777",
        "http://127.0.0.1:7777",
    ]

    # MinIO / S3-compatible
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket: str = "audios"
    minio_presign_ttl_sec: int = 600

    # Upload limits
    max_audio_size_mb: int = 50
    max_files_per_upload: int = 200
    max_files_per_sync: int = 500

    # Wallet — tỷ lệ quy đổi điểm sang VND
    point_to_vnd: int = 50  # 1 điểm = 50 VND
    min_withdrawal_points: int = 100  # ngưỡng rút tối thiểu


@lru_cache
def get_settings() -> Settings:
    return Settings()
