import hmac

from fastapi import Header, HTTPException

from .config import Settings


def make_token_dependency(settings: Settings):
    async def require_token(authorization: str | None = Header(default=None)) -> None:
        if not settings.token:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "auth_token_not_configured",
                    "message": "DEEP_RESEARCH_TOKEN must be set before using research endpoints.",
                },
            )

        scheme, _, value = (authorization or "").partition(" ")
        if scheme.lower() != "bearer" or not value:
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "missing_bearer_token",
                    "message": "Use Authorization: Bearer <token>.",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not hmac.compare_digest(value, settings.token):
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "invalid_bearer_token",
                    "message": "The bearer token is invalid.",
                },
                headers={"WWW-Authenticate": "Bearer"},
            )

    return require_token
