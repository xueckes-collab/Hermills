from __future__ import annotations

from dataclasses import dataclass
import importlib.util
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .config import Settings


@dataclass(frozen=True)
class FetchResult:
    url: str
    status_code: int
    content_type: str
    text: str
    headers: dict[str, str]

    @property
    def redirect_location(self) -> str | None:
        location = self.headers.get("location")
        if not location:
            return None
        return urljoin(self.url, location)


class FetchError(RuntimeError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802
        return None


class UrllibFetcher:
    name = "urllib"

    def __init__(self, settings: Settings, warning: str | None = None):
        self.settings = settings
        self.warning = warning
        self._opener = build_opener(_NoRedirect)

    def status(self) -> dict:
        return {
            "name": self.name,
            "scraplingAvailable": False,
            "fallback": True,
            "warning": self.warning,
        }

    def fetch(self, url: str) -> FetchResult:
        request = Request(
            url,
            headers={
                "User-Agent": self.settings.user_agent,
                "Accept": "text/html,application/xhtml+xml,text/plain;q=0.8,*/*;q=0.1",
            },
            method="GET",
        )
        try:
            with self._opener.open(request, timeout=self.settings.timeout_seconds) as response:
                body = response.read(self.settings.max_response_bytes + 1)
                return self._to_result(url=response.geturl(), response=response, body=body)
        except HTTPError as exc:
            body = exc.read(self.settings.max_response_bytes + 1)
            return self._to_result(url=url, response=exc, body=body)
        except URLError as exc:
            raise FetchError("network_error", f"Failed to fetch {url}: {exc.reason}") from exc
        except OSError as exc:
            raise FetchError("network_error", f"Failed to fetch {url}: {exc}") from exc

    def _to_result(self, url: str, response: Any, body: bytes) -> FetchResult:
        if len(body) > self.settings.max_response_bytes:
            body = body[: self.settings.max_response_bytes]
        headers = {key.lower(): value for key, value in response.headers.items()}
        charset = response.headers.get_content_charset() or "utf-8"
        text = body.decode(charset, errors="replace")
        return FetchResult(
            url=url,
            status_code=getattr(response, "status", getattr(response, "code", 0)),
            content_type=response.headers.get("Content-Type", ""),
            text=text,
            headers=headers,
        )


class MissingScraplingFetcher:
    name = "scrapling"

    def __init__(self, settings: Settings):
        self.settings = settings

    def status(self) -> dict:
        return {
            "name": self.name,
            "scraplingAvailable": False,
            "fallback": False,
            "warning": "Scrapling is required by configuration but is not installed.",
        }

    def fetch(self, url: str) -> FetchResult:
        raise FetchError(
            "scrapling_not_installed",
            "Scrapling is not installed. Install `scrapling` or unset DEEP_RESEARCH_REQUIRE_SCRAPLING.",
        )


class ScraplingFetcher:
    name = "scrapling"

    def __init__(self, settings: Settings):
        self.settings = settings
        from scrapling.fetchers import Fetcher

        self._fetcher = Fetcher

    def status(self) -> dict:
        return {
            "name": self.name,
            "scraplingAvailable": True,
            "fallback": False,
            "warning": None,
        }

    def fetch(self, url: str) -> FetchResult:
        kwargs = {
            "headers": {"User-Agent": self.settings.user_agent},
            "timeout": self.settings.timeout_seconds,
            "follow_redirects": False,
        }
        try:
            page = self._fetcher.get(url, **kwargs)
        except TypeError:
            page = self._fetcher.get(
                url,
                headers={"User-Agent": self.settings.user_agent},
                timeout=self.settings.timeout_seconds,
            )
        except Exception as exc:  # Scrapling can wrap transport-specific exceptions.
            raise FetchError("scrapling_fetch_error", f"Scrapling failed to fetch {url}: {exc}") from exc

        text = _extract_text_from_scrapling_page(page)
        if len(text) > self.settings.max_response_bytes:
            text = text[: self.settings.max_response_bytes]
        status_code = int(
            getattr(page, "status", None)
            or getattr(page, "status_code", None)
            or getattr(getattr(page, "response", None), "status_code", None)
            or 200
        )
        final_url = str(getattr(page, "url", None) or url)
        headers = _extract_headers_from_scrapling_page(page)
        return FetchResult(
            url=final_url,
            status_code=status_code,
            content_type=headers.get("content-type", "text/html"),
            text=text,
            headers=headers,
        )


def _extract_headers_from_scrapling_page(page: Any) -> dict[str, str]:
    candidates = [
        getattr(page, "headers", None),
        getattr(getattr(page, "response", None), "headers", None),
    ]
    for candidate in candidates:
        if isinstance(candidate, dict):
            return {str(key).lower(): str(value) for key, value in candidate.items()}
    return {}


def _extract_text_from_scrapling_page(page: Any) -> str:
    for name in ("html", "body", "content", "text"):
        value = getattr(page, name, None)
        if callable(value):
            value = value()
        if value is None:
            continue
        if isinstance(value, bytes):
            return value.decode("utf-8", errors="replace")
        return str(value)
    return str(page)


class PlaywrightFetcher:
    name = "playwright"

    def __init__(self, settings: Settings):
        self.settings = settings
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright

        self._sync_playwright = sync_playwright
        self._timeout_error = PlaywrightTimeoutError

    def status(self) -> dict:
        return {
            "name": self.name,
            "playwrightAvailable": True,
            "fallback": False,
            "warning": None,
        }

    def fetch(self, url: str) -> FetchResult:
        timeout_ms = int(self.settings.timeout_seconds * 1000)
        try:
            with self._sync_playwright() as playwright:
                browser = playwright.chromium.launch(
                    headless=True,
                    args=["--disable-gpu", "--disable-dev-shm-usage"],
                )
                try:
                    page = browser.new_page(
                        user_agent=self.settings.user_agent,
                        viewport={"width": 1366, "height": 900},
                    )
                    response = page.goto(
                        url,
                        wait_until="networkidle",
                        timeout=timeout_ms,
                    )
                    text = page.content()
                    headers = {
                        str(key).lower(): str(value)
                        for key, value in (response.headers if response else {}).items()
                    }
                    if len(text) > self.settings.max_response_bytes:
                        text = text[: self.settings.max_response_bytes]
                    return FetchResult(
                        url=page.url or url,
                        status_code=int(response.status if response else 200),
                        content_type=headers.get("content-type", "text/html"),
                        text=text,
                        headers=headers,
                    )
                finally:
                    browser.close()
        except self._timeout_error as exc:
            raise FetchError("playwright_timeout", f"Playwright timed out fetching {url}: {exc}") from exc
        except Exception as exc:
            raise FetchError("playwright_fetch_error", f"Playwright failed to fetch {url}: {exc}") from exc


class LayeredFetcher:
    def __init__(self, fetchers: list[Any], warning: str | None = None):
        self.fetchers = fetchers
        self.name = "+".join(fetcher.name for fetcher in fetchers)
        self.warning = warning

    def status(self) -> dict:
        return {
            "name": self.name,
            "layers": [fetcher.status() for fetcher in self.fetchers],
            "fallback": len(self.fetchers) > 1,
            "warning": self.warning,
        }

    def fetch(self, url: str) -> FetchResult:
        last_error: FetchError | None = None
        for fetcher in self.fetchers:
            try:
                return fetcher.fetch(url)
            except FetchError as exc:
                last_error = exc
        if last_error:
            raise last_error
        raise FetchError("no_fetcher", "No fetcher is configured.")


def make_fetcher(settings: Settings):
    scrapling_available = importlib.util.find_spec("scrapling") is not None
    playwright_available = importlib.util.find_spec("playwright") is not None
    fetchers = []
    warnings = []
    if scrapling_available:
        try:
            fetchers.append(ScraplingFetcher(settings))
        except Exception as exc:
            warnings.append(f"Scrapling import failed: {exc}")
    elif settings.require_scrapling:
        return MissingScraplingFetcher(settings)
    else:
        warnings.append("Scrapling is not installed; using browser/urllib fallback.")

    if playwright_available:
        try:
            fetchers.append(PlaywrightFetcher(settings))
        except Exception as exc:
            warnings.append(f"Playwright import failed: {exc}")
    else:
        warnings.append("Playwright is not installed; dynamic JS pages may need urllib fallback.")

    fetchers.append(UrllibFetcher(settings, warning="; ".join(warnings) or None))
    return LayeredFetcher(fetchers, warning="; ".join(warnings) or None)
