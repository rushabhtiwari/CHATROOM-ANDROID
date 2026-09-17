from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "staging", "production"] = "development"
    company_domain: str
    issuer_url: str
    database_url: str
    google_client_id: str = ""
    google_client_secret: str = ""
    key_encryption_key: str
    session_secret: str
    initial_admin_emails: str = ""
    portal_url: str
    portal_client_secret: str
    dev_login_enabled: bool = False

    @model_validator(mode="after")
    def _check_production_safety(self) -> "Settings":
        if self.environment == "production" and self.dev_login_enabled:
            raise ValueError("DEV_LOGIN_ENABLED must not be true when ENVIRONMENT=production")
        if self.environment in ("staging", "production") and not self.issuer_url.startswith(
            "https://"
        ):
            raise ValueError("ISSUER_URL must use https outside development")
        return self

    @property
    def admin_emails(self) -> set[str]:
        return {e.strip().lower() for e in self.initial_admin_emails.split(",") if e.strip()}

    @property
    def portal_redirect_uri(self) -> str:
        return f"{self.portal_url}/api/auth/callback/identity"

    @property
    def secure_cookies(self) -> bool:
        return self.issuer_url.startswith("https://")


@lru_cache
def get_settings() -> Settings:
    return Settings()
