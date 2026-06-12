from __future__ import annotations

from dataclasses import dataclass
from html.parser import HTMLParser
import re
from urllib.parse import urljoin, urlparse, urlunparse

from .config import Settings
from .fetchers import FetchError
from .robots import RateLimiter, RobotsChecker
from .security import BlockedUrlError, Resolver, resolve_host_addresses, validate_public_http_url


@dataclass(frozen=True)
class CompanyResearchInput:
    company_name: str
    website_url: str | None = None
    seed_urls: list[str] | None = None
    max_pages: int | None = None
    keywords: list[str] | None = None


class ResearchValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


class ResearchService:
    def __init__(
        self,
        settings: Settings,
        fetcher,
        resolver: Resolver = resolve_host_addresses,
    ):
        self.settings = settings
        self.fetcher = fetcher
        self.resolver = resolver

    def fetcher_status(self) -> dict:
        return self.fetcher.status()

    def research_company(self, request: CompanyResearchInput) -> dict:
        company_name = request.company_name.strip()
        if not company_name:
            raise ResearchValidationError("missing_company_name", "companyName is required.")

        seeds = self._validated_seed_urls(request)
        requested_max = request.max_pages or self.settings.max_pages
        max_pages = min(max(1, requested_max), self.settings.max_pages)
        keywords = _normalize_keywords([company_name, *(request.keywords or [])])

        rate_limiter = RateLimiter(self.settings.request_delay_seconds)
        robots = RobotsChecker(self.fetcher, self.settings.user_agent, rate_limiter)
        allowed_origins = {_origin(seed) for seed in seeds}
        queue = list(seeds)
        seen: set[str] = set()
        sources: list[dict] = []
        evidence: list[dict] = []
        warnings: list[str] = []
        errors: list[dict] = []

        while queue and len(sources) < max_pages:
            url = queue.pop(0)
            if url in seen:
                continue
            seen.add(url)

            try:
                url = validate_public_http_url(url, self.resolver)
            except BlockedUrlError as exc:
                warnings.append(f"skipped_blocked_url:{exc.code}:{url}")
                continue

            if _origin(url) not in allowed_origins:
                warnings.append(f"skipped_offsite_url:{url}")
                continue

            robots_decision = robots.allowed(url)
            warnings.extend(robots_decision.warnings)
            if not robots_decision.allowed:
                warnings.append(f"skipped_robots_disallow:{url}")
                continue

            try:
                rate_limiter.wait(url)
                result = self.fetcher.fetch(url)
            except FetchError as exc:
                errors.append({"sourceUrl": url, "code": exc.code, "message": exc.message})
                continue

            if 300 <= result.status_code < 400 and result.redirect_location:
                try:
                    redirect_url = validate_public_http_url(result.redirect_location, self.resolver)
                except BlockedUrlError as exc:
                    warnings.append(f"skipped_blocked_redirect:{exc.code}:{result.redirect_location}")
                    continue
                if _origin(redirect_url) in allowed_origins and redirect_url not in seen:
                    queue.insert(0, redirect_url)
                else:
                    warnings.append(f"skipped_offsite_redirect:{redirect_url}")
                continue

            if result.status_code >= 400:
                errors.append(
                    {
                        "sourceUrl": url,
                        "code": "http_error",
                        "message": f"HTTP status {result.status_code}",
                    }
                )
                continue

            try:
                final_url = validate_public_http_url(result.url, self.resolver)
            except BlockedUrlError as exc:
                warnings.append(f"skipped_blocked_final_url:{exc.code}:{result.url}")
                continue
            if _origin(final_url) not in allowed_origins:
                warnings.append(f"skipped_offsite_final_url:{final_url}")
                continue

            if result.content_type and not _looks_like_text(result.content_type):
                warnings.append(f"skipped_non_html_content:{final_url}")
                continue

            page = _extract_page(result.text, final_url)
            page_snippets = _extract_snippets(page.text, keywords)
            page_evidence = [
                {
                    "sourceUrl": final_url,
                    "snippet": snippet,
                    "label": "page_text",
                }
                for snippet in page_snippets
            ]
            evidence.extend(page_evidence)
            sources.append(
                {
                    "sourceUrl": final_url,
                    "statusCode": result.status_code,
                    "title": page.title,
                    "description": page.description,
                    "snippet": page_snippets[0] if page_snippets else _trim(page.text, 280),
                    "evidence": page_evidence,
                }
            )

            for link in _rank_links(page.links, final_url):
                if len(seen) + len(queue) >= max_pages * 6:
                    break
                try:
                    candidate = validate_public_http_url(link, self.resolver)
                except BlockedUrlError:
                    continue
                if _origin(candidate) == _origin(final_url) and candidate not in seen and candidate not in queue:
                    queue.append(candidate)

        status = "ok" if evidence else "partial" if sources else "error"
        return {
            "companyName": company_name,
            "status": status,
            "fetcher": self.fetcher_status(),
            "limits": {
                "maxPages": max_pages,
                "requestDelaySeconds": self.settings.request_delay_seconds,
            },
            "sources": sources,
            "evidence": evidence[:20],
            "warnings": _dedupe(warnings),
            "errors": errors,
        }

    def _validated_seed_urls(self, request: CompanyResearchInput) -> list[str]:
        raw_urls: list[str] = []
        if request.website_url:
            raw_urls.append(request.website_url)
        raw_urls.extend(request.seed_urls or [])
        if not raw_urls:
            raise ResearchValidationError(
                "missing_seed_url",
                "Provide websiteUrl or at least one seedUrls entry.",
            )

        urls: list[str] = []
        for raw_url in raw_urls:
            try:
                normalized = validate_public_http_url(raw_url, self.resolver)
            except BlockedUrlError as exc:
                raise ResearchValidationError(exc.code, exc.message) from exc
            if normalized not in urls:
                urls.append(normalized)
        return urls


@dataclass
class ExtractedPage:
    title: str | None
    description: str | None
    text: str
    links: list[str]


class _PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.text_parts: list[str] = []
        self.links: list[str] = []
        self.description: str | None = None
        self._ignored_stack: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs):
        attrs_dict = {name.lower(): value for name, value in attrs}
        tag = tag.lower()
        if tag in {"script", "style", "noscript", "svg"}:
            self._ignored_stack.append(tag)
        elif tag == "title":
            self._in_title = True
        elif tag == "a" and attrs_dict.get("href"):
            self.links.append(attrs_dict["href"])
        elif tag == "meta":
            name = (attrs_dict.get("name") or attrs_dict.get("property") or "").lower()
            if name in {"description", "og:description"} and attrs_dict.get("content"):
                self.description = attrs_dict["content"].strip()

    def handle_endtag(self, tag: str):
        tag = tag.lower()
        if self._ignored_stack and self._ignored_stack[-1] == tag:
            self._ignored_stack.pop()
        elif tag == "title":
            self._in_title = False

    def handle_data(self, data: str):
        value = data.strip()
        if not value or self._ignored_stack:
            return
        if self._in_title:
            self.title_parts.append(value)
        else:
            self.text_parts.append(value)


def _extract_page(html: str, url: str) -> ExtractedPage:
    parser = _PageParser()
    parser.feed(html)
    title = _normalize_space(" ".join(parser.title_parts)) or None
    description = _normalize_space(parser.description or "") or None
    text = _normalize_space(" ".join(parser.text_parts))
    links = [_normalize_link(url, href) for href in parser.links]
    return ExtractedPage(
        title=title,
        description=description,
        text=text,
        links=[link for link in links if link],
    )


def _extract_snippets(text: str, keywords: list[str]) -> list[str]:
    if not text:
        return []
    lowered_keywords = [keyword.lower() for keyword in keywords if keyword]
    sentences = re.split(r"(?<=[.!?])\s+|\n+", text)
    snippets: list[str] = []
    for sentence in sentences:
        normalized = _normalize_space(sentence)
        if not normalized:
            continue
        lowered = normalized.lower()
        if any(keyword in lowered for keyword in lowered_keywords):
            snippets.append(_trim(normalized, 320))
        if len(snippets) >= 3:
            break
    if not snippets:
        snippets.append(_trim(text, 320))
    return _dedupe(snippets)


def _rank_links(links: list[str], base_url: str) -> list[str]:
    normalized = [_normalize_link(base_url, link) for link in links]
    candidates = [link for link in normalized if link and _likely_html_url(link)]
    return sorted(_dedupe(candidates), key=_link_score, reverse=True)


def _normalize_link(base_url: str, href: str | None) -> str | None:
    if not href:
        return None
    href = href.strip()
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
        return None
    joined = urljoin(base_url, href)
    parsed = urlparse(joined)
    if parsed.scheme.lower() not in {"http", "https"}:
        return None
    parsed = parsed._replace(fragment="")
    return urlunparse(parsed)


def _link_score(url: str) -> int:
    path = urlparse(url).path.lower()
    score = 0
    for value, terms in (
        (130, ("product", "products", "catalog", "category", "collection", "range")),
        (120, ("solution", "solutions", "industry", "industries", "application", "applications")),
        (110, ("case", "cases", "project", "projects", "customer", "customers", "client", "clients")),
        (100, ("certification", "certificate", "quality", "compliance", "testing", "standard")),
        (90, ("about", "company", "profile", "who-we-are", "factory", "manufacturing")),
        (75, ("contact", "locations", "distributor", "dealers", "where-to-buy")),
        (55, ("news", "blog", "press")),
        (-50, ("careers", "jobs", "privacy", "terms", "legal")),
    ):
        if any(term in path for term in terms):
            score += value
    return score


def _likely_html_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    blocked_extensions = (
        ".7z",
        ".avi",
        ".css",
        ".doc",
        ".docx",
        ".gif",
        ".gz",
        ".ico",
        ".jpg",
        ".jpeg",
        ".js",
        ".mov",
        ".mp3",
        ".mp4",
        ".pdf",
        ".png",
        ".rar",
        ".svg",
        ".webp",
        ".xls",
        ".xlsx",
        ".zip",
    )
    return not path.endswith(blocked_extensions)


def _looks_like_text(content_type: str) -> bool:
    lowered = content_type.lower()
    return any(value in lowered for value in ("text/html", "application/xhtml+xml", "text/plain"))


def _normalize_keywords(values: list[str]) -> list[str]:
    keywords = [_normalize_space(value) for value in values if value and _normalize_space(value)]
    keywords.extend([
        "about",
        "product",
        "catalog",
        "solution",
        "industry",
        "application",
        "case",
        "project",
        "quality",
        "certification",
        "compliance",
        "contact",
    ])
    return _dedupe(keywords)


def _origin(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme.lower()}://{parsed.netloc.lower()}"


def _normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _trim(value: str, limit: int) -> str:
    value = _normalize_space(value)
    if len(value) <= limit:
        return value
    return f"{value[: limit - 1].rstrip()}..."


def _dedupe(values: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for value in values:
        if value not in seen:
            seen.add(value)
            output.append(value)
    return output
