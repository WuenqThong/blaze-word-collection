from functools import lru_cache
from ipaddress import ip_network
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", extra="ignore", hide_input_in_errors=True,
    )

    app_name: str = "Audio Annotator"
    environment: Literal["development", "test", "production"] = "development"
    debug: bool = True
    enable_legacy: bool = False
    database_url: str = "sqlite:///./annotator.db"
    frontend_dist: str = ""
    blaze_api_token: SecretStr = Field(default=SecretStr(''), exclude=True)
    blaze_translation_model: str = 'blaze-translate-1'
    jwt_secret: str = "dev-secret-change-me"
    jwt_alg: str = "HS256"
    access_token_ttl_min: int = 60
    cookie_name: str = "access_token"
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    cors_origins: list[str] = [
        "http://localhost:5173", "http://127.0.0.1:5173",
        "http://localhost:7777", "http://127.0.0.1:7777",
    ]
    trusted_proxy_ips: list[str] = Field(default_factory=list, description=(
        "Deployment contract only; middleware never reads forwarded headers. Configure "
        "Uvicorn --proxy-headers --forwarded-allow-ips with these exact proxy IPs/CIDRs, "
        "restrict backend ingress to those proxies, and have the proxy overwrite forwarded "
        "headers. Otherwise terminate TLS directly and disable proxy headers. Never use '*'."
    ))
    rate_limit_enabled: bool = True
    rate_limit_window_seconds: int = Field(default=60, ge=1, le=86400)
    rate_limit_auth: int = Field(default=60, ge=1)
    rate_limit_password: int = Field(default=30, ge=1)
    rate_limit_contributions: int = Field(default=120, ge=1)
    rate_limit_feedback: int = Field(default=60, ge=1)
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_secure: bool = False
    minio_bucket: str = "audios"
    minio_presign_ttl_sec: int = 600
    max_audio_size_mb: int = 50
    max_files_per_upload: int = 200
    max_files_per_sync: int = 500
    point_to_vnd: int = 50
    min_withdrawal_points: int = 100

    @model_validator(mode="after")
    def validate_security(self):
        for proxy in self.trusted_proxy_ips:
            network = ip_network(proxy, strict=False)
            if network.prefixlen == 0:
                raise ValueError("Trusted proxies must not include every address")
        if self.cookie_samesite == "none" and not self.cookie_secure:
            raise ValueError("SameSite=None requires secure cookies")
        if self.environment != "production":
            return self
        errors = []
        if self.debug:
            errors.append("debug must be disabled")
        secret = self.jwt_secret.strip()
        if (len(secret) < 32 or len(set(secret)) < 12
                or any(word in secret.lower() for word in ("change-me", "changeme", "dev-secret", "your-secret", "default", "example"))):
            errors.append("JWT secret must be a strong independently generated secret")
        if not self.cookie_secure:
            errors.append("secure cookies are required")
        if self.enable_legacy:
            errors.append("legacy must remain disabled for the production pilot")
        if not self.rate_limit_enabled:
            errors.append("rate limiting is required")
        for origin in self.cors_origins:
            parsed = urlsplit(origin)
            if (parsed.scheme != "https" or not parsed.hostname or "*" in origin
                    or parsed.username or parsed.password or parsed.query or parsed.fragment
                    or parsed.path not in ("", "/")):
                errors.append("CORS origins must be explicit HTTPS origins")
                break
        if errors:
            raise ValueError("Invalid production configuration: " + "; ".join(errors))
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
