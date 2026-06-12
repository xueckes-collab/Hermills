# Hermills Deep Research Sidecar

Local Python sidecar for first-pass company background research. The packaged Windows app starts it with `python -m deep_research`; the FastAPI app remains available for development tests.

## Features

- `GET /health`
- `POST /v1/research/company`
- Bearer-token authentication for research requests
- SSRF protection for `localhost`, private networks, link-local, reserved IPs, credentials in URLs, and non-HTTP schemes such as `file:`
- Robots.txt checks, same-origin crawling, per-host rate limiting, and a configurable page cap
- Scrapling-first fetcher, Playwright dynamic-page fallback, and a standard-library fallback
- Structured JSON output with `sourceUrl` and `snippet` evidence items

## Install

```powershell
cd services/deep-research
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Run

```powershell
$env:DEEP_RESEARCH_TOKEN = "change-me"
python -m deep_research
```

## Request

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8791/v1/research/company `
  -Headers @{ Authorization = "Bearer change-me" } `
  -ContentType "application/json" `
  -Body (@{
    companyName = "Example"
    websiteUrl = "https://www.example.com"
    maxPages = 3
  } | ConvertTo-Json)
```

## Configuration

| Environment variable | Default | Notes |
| --- | --- | --- |
| `DEEP_RESEARCH_TOKEN` | unset | Required for `POST /v1/research/company` |
| `DEEP_RESEARCH_HOST` | `127.0.0.1` | Used by `python -m deep_research` |
| `DEEP_RESEARCH_PORT` | `8791` | Used by `python -m deep_research` |
| `DEEP_RESEARCH_USER_AGENT` | `HermillsDeepResearch/0.1 (+https://hermills.local)` | Sent to public pages and robots.txt |
| `DEEP_RESEARCH_MAX_PAGES` | `5` | Hard cap for pages per request |
| `DEEP_RESEARCH_REQUEST_DELAY_SECONDS` | `1.0` | Per-host delay between fetches |
| `DEEP_RESEARCH_TIMEOUT_SECONDS` | `10.0` | Fetch timeout |
| `DEEP_RESEARCH_MAX_RESPONSE_BYTES` | `1500000` | Response body cap |
| `DEEP_RESEARCH_REQUIRE_SCRAPLING` | `false` | Return a clear fetch error instead of using urllib fallback |

## Tests

The tests use the standard library runner:

```powershell
cd services/deep-research
python -m unittest discover -s tests -t .
```
