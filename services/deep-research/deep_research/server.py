from __future__ import annotations

from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from typing import Any
from urllib.parse import urlparse

from .config import Settings
from .fetchers import make_fetcher
from .research import CompanyResearchInput, ResearchService, ResearchValidationError


class JsonResearchHandler(BaseHTTPRequestHandler):
    server_version = "HermillsDeepResearch/0.1"
    service: ResearchService
    settings: Settings

    def do_GET(self) -> None:  # noqa: N802
        if self.path != "/health":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": {"code": "not_found", "message": "Not found."}})
            return
        self._send_json(HTTPStatus.OK, {
            "status": "ok",
            "service": "deep-research",
            "authConfigured": bool(self.settings.token),
            "fetcher": self.service.fetcher_status(),
            "limits": {
                "maxPages": self.settings.max_pages,
                "requestDelaySeconds": self.settings.request_delay_seconds,
                "timeoutSeconds": self.settings.timeout_seconds,
            },
        })

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/research/company":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": {"code": "not_found", "message": "Not found."}})
            return
        auth_error = self._auth_error()
        if auth_error:
            self._send_json(auth_error[0], {"detail": {"code": auth_error[1], "message": auth_error[2]}})
            return
        try:
            payload = self._read_json_body()
            result = self.service.research_company(_company_research_input(payload))
            self._send_json(HTTPStatus.OK, result)
        except ResearchValidationError as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"detail": {"code": exc.code, "message": exc.message}})
        except ValueError as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"detail": {"code": "bad_request", "message": str(exc)}})
        except Exception as exc:  # Keep the desktop flow alive; Hermills will fall back.
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": {"code": "research_failed", "message": str(exc)}})

    def log_message(self, _format: str, *_args: Any) -> None:
        return

    def _auth_error(self) -> tuple[HTTPStatus, str, str] | None:
        if not self.settings.token:
            return HTTPStatus.SERVICE_UNAVAILABLE, "auth_token_not_configured", "Deep research token is not configured."
        header = self.headers.get("authorization") or ""
        if not header.lower().startswith("bearer "):
            return HTTPStatus.UNAUTHORIZED, "missing_bearer_token", "Missing bearer token."
        token = header.split(" ", 1)[1].strip()
        if token != self.settings.token:
            return HTTPStatus.UNAUTHORIZED, "invalid_bearer_token", "Invalid bearer token."
        return None

    def _read_json_body(self) -> dict[str, Any]:
        raw_length = self.headers.get("content-length") or "0"
        try:
            length = int(raw_length)
        except ValueError as exc:
            raise ValueError("Invalid content length.") from exc
        if length <= 0:
            return {}
        if length > 1_000_000:
            raise ValueError("Request body is too large.")
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise ValueError("Request body must be valid JSON.") from exc
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def _send_json(self, status: HTTPStatus, body: dict[str, Any]) -> None:
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def run_server(settings: Settings | None = None, service: ResearchService | None = None) -> None:
    settings = settings or Settings.from_env()
    service = service or ResearchService(settings=settings, fetcher=make_fetcher(settings))

    class Handler(JsonResearchHandler):
        pass

    Handler.settings = settings
    Handler.service = service
    httpd = ThreadingHTTPServer((settings.host, settings.port), Handler)
    httpd.serve_forever()


def _company_research_input(payload: dict[str, Any]) -> CompanyResearchInput:
    website_url = _string_value(payload, "websiteUrl") or _string_value(payload, "website")
    company_name = _string_value(payload, "companyName") or _company_name_from_request(
        website_url,
        _string_value(payload, "email"),
    )
    seed_urls = payload.get("seedUrls")
    keywords = payload.get("keywords")
    return CompanyResearchInput(
        company_name=company_name,
        website_url=website_url,
        seed_urls=seed_urls if isinstance(seed_urls, list) else [],
        max_pages=_int_value(payload, "maxPages"),
        keywords=keywords if isinstance(keywords, list) else [],
    )


def _company_name_from_request(website_url: str | None, email: str | None) -> str:
    domain = ""
    if website_url:
        parsed = urlparse(website_url if "://" in website_url else f"https://{website_url}")
        domain = parsed.hostname or ""
    if not domain and email and "@" in email:
        domain = email.rsplit("@", 1)[1]
    if domain:
        base = domain.lower().removeprefix("www.").split(".")[0]
        return " ".join(part.capitalize() for part in base.replace("_", "-").split("-") if part) or "Customer"
    return "Customer"


def _string_value(payload: dict[str, Any], key: str) -> str | None:
    value = payload.get(key)
    if not isinstance(value, str):
        return None
    value = value.strip()
    return value or None


def _int_value(payload: dict[str, Any], key: str) -> int | None:
    value = payload.get(key)
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.strip().isdigit():
        return int(value)
    return None
