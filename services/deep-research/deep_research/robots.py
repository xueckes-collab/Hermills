from __future__ import annotations

from dataclasses import dataclass
from time import monotonic, sleep
from urllib.parse import urlparse, urlunparse
from urllib.robotparser import RobotFileParser

from .fetchers import FetchError


class RateLimiter:
    def __init__(self, delay_seconds: float):
        self.delay_seconds = max(0.0, delay_seconds)
        self._last_fetch_by_host: dict[str, float] = {}

    def wait(self, url: str) -> None:
        if self.delay_seconds <= 0:
            return
        parsed = urlparse(url)
        key = parsed.netloc.lower()
        now = monotonic()
        last_fetch = self._last_fetch_by_host.get(key)
        if last_fetch is not None:
            remaining = self.delay_seconds - (now - last_fetch)
            if remaining > 0:
                sleep(remaining)
        self._last_fetch_by_host[key] = monotonic()


@dataclass
class RobotsDecision:
    allowed: bool
    warnings: list[str]


class RobotsChecker:
    def __init__(self, fetcher, user_agent: str, rate_limiter: RateLimiter):
        self.fetcher = fetcher
        self.user_agent = user_agent
        self.rate_limiter = rate_limiter
        self._cache: dict[str, RobotFileParser | None] = {}
        self._warnings_by_origin: dict[str, list[str]] = {}

    def allowed(self, url: str) -> RobotsDecision:
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}".lower()
        warnings: list[str] = []

        if origin not in self._cache:
            robots_url = urlunparse((parsed.scheme, parsed.netloc, "/robots.txt", "", "", ""))
            parser = RobotFileParser()
            parser.set_url(robots_url)
            try:
                self.rate_limiter.wait(robots_url)
                result = self.fetcher.fetch(robots_url)
                if result.status_code in {401, 403}:
                    parser.parse(["User-agent: *", "Disallow: /"])
                elif result.status_code >= 400:
                    parser = None
                    warnings.append(f"robots_unavailable:{origin}:status_{result.status_code}")
                else:
                    parser.parse(result.text.splitlines())
            except FetchError as exc:
                parser = None
                warnings.append(f"robots_unavailable:{origin}:{exc.code}")
            self._cache[origin] = parser
            self._warnings_by_origin[origin] = warnings
        else:
            warnings.extend(self._warnings_by_origin.get(origin, []))

        parser = self._cache[origin]
        if parser is None:
            return RobotsDecision(allowed=True, warnings=warnings)
        return RobotsDecision(
            allowed=parser.can_fetch(self.user_agent, url),
            warnings=warnings,
        )
