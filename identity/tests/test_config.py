import pytest
from pydantic import ValidationError

from app.config import Settings


def test_production_refuses_dev_login():
    with pytest.raises(ValidationError, match="DEV_LOGIN_ENABLED"):
        Settings(
            environment="production", dev_login_enabled=True, issuer_url="https://auth.yourco.com"
        )


def test_production_requires_https_issuer():
    with pytest.raises(ValidationError, match="https"):
        Settings(environment="production", issuer_url="http://auth.yourco.com")


def test_admin_emails_are_normalised():
    parsed = Settings(initial_admin_emails=" Boss@YourCo.com, ,ops@yourco.com")
    assert parsed.admin_emails == {"boss@yourco.com", "ops@yourco.com"}
