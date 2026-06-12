from dataclasses import dataclass
import os


def _env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env_float(name: str, default: float, minimum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(minimum, value)


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return min(maximum, max(minimum, value))


@dataclass(frozen=True)
class Settings:
    token: str | None = None
    host: str = "127.0.0.1"
    port: int = 8791
    user_agent: str = "HermillsDeepResearch/0.1 (+https://hermills.local)"
    max_pages: int = 5
    request_delay_seconds: float = 1.0
    timeout_seconds: float = 10.0
    max_response_bytes: int = 1_500_000
    require_scrapling: bool = False

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            token=os.getenv("DEEP_RESEARCH_TOKEN"),
            host=os.getenv("DEEP_RESEARCH_HOST", "127.0.0.1"),
            port=_env_int("DEEP_RESEARCH_PORT", 8791, 1, 65535),
            user_agent=os.getenv(
                "DEEP_RESEARCH_USER_AGENT",
                "HermillsDeepResearch/0.1 (+https://hermills.local)",
            ),
            max_pages=_env_int("DEEP_RESEARCH_MAX_PAGES", 5, 1, 20),
            request_delay_seconds=_env_float(
                "DEEP_RESEARCH_REQUEST_DELAY_SECONDS",
                1.0,
                0.0,
            ),
            timeout_seconds=_env_float("DEEP_RESEARCH_TIMEOUT_SECONDS", 10.0, 0.5),
            max_response_bytes=_env_int(
                "DEEP_RESEARCH_MAX_RESPONSE_BYTES",
                1_500_000,
                50_000,
                10_000_000,
            ),
            require_scrapling=_env_bool("DEEP_RESEARCH_REQUIRE_SCRAPLING", False),
        )
