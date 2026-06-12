from typing import List, Optional
from urllib.parse import urlparse

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field

from .auth import make_token_dependency
from .config import Settings
from .fetchers import make_fetcher
from .research import CompanyResearchInput, ResearchService, ResearchValidationError


class CompanyResearchRequest(BaseModel):
    companyName: Optional[str] = Field(default=None, max_length=200)
    websiteUrl: Optional[str] = Field(default=None, max_length=2048)
    website: Optional[str] = Field(default=None, max_length=2048)
    email: Optional[str] = Field(default=None, max_length=320)
    seedUrls: List[str] = Field(default_factory=list, max_items=5)
    maxPages: Optional[int] = Field(default=None, ge=1, le=20)
    keywords: List[str] = Field(default_factory=list, max_items=20)
    mode: Optional[str] = Field(default=None, max_length=40)
    timeoutMs: Optional[int] = Field(default=None, ge=500, le=120000)


def create_app(
    settings: Settings | None = None,
    service: ResearchService | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    fetcher = make_fetcher(settings)
    service = service or ResearchService(settings=settings, fetcher=fetcher)
    token_dependency = make_token_dependency(settings)

    app = FastAPI(
        title="Hermills Deep Research Sidecar",
        version="0.1.0",
        docs_url="/docs",
        redoc_url=None,
    )

    @app.get("/health")
    def health() -> dict:
        return {
            "status": "ok",
            "service": "deep-research",
            "authConfigured": bool(settings.token),
            "fetcher": service.fetcher_status(),
            "limits": {
                "maxPages": settings.max_pages,
                "requestDelaySeconds": settings.request_delay_seconds,
                "timeoutSeconds": settings.timeout_seconds,
            },
        }

    @app.post("/v1/research/company", dependencies=[Depends(token_dependency)])
    def research_company(payload: CompanyResearchRequest) -> dict:
        website_url = payload.websiteUrl or payload.website
        company_name = _company_name_from_request(payload.companyName, website_url, payload.email)
        try:
            return service.research_company(
                CompanyResearchInput(
                    company_name=company_name,
                    website_url=website_url,
                    seed_urls=payload.seedUrls,
                    max_pages=payload.maxPages,
                    keywords=[*(payload.keywords or []), payload.email or ""],
                )
            )
        except ResearchValidationError as exc:
            raise HTTPException(
                status_code=400,
                detail={"code": exc.code, "message": exc.message},
            ) from exc

    return app


def _company_name_from_request(
    company_name: Optional[str],
    website_url: Optional[str],
    email: Optional[str],
) -> str:
    if company_name and company_name.strip():
        return company_name.strip()
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


app = create_app()
