import ipaddress
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from deep_research.app import create_app
from deep_research.config import Settings
from deep_research.fetchers import FetchResult
from deep_research.research import ResearchService


def public_resolver(_hostname):
    return [ipaddress.ip_address("93.184.216.34")]


class FakeFetcher:
    def status(self):
        return {
            "name": "fake",
            "scraplingAvailable": False,
            "fallback": False,
            "warning": None,
        }

    def fetch(self, url):
        if url.endswith("/robots.txt"):
            return FetchResult(
                url=url,
                status_code=200,
                content_type="text/plain",
                text="User-agent: *\nAllow: /\n",
                headers={},
            )
        if url.endswith("/about"):
            html = """
            <html><head><title>About Example Co</title></head>
            <body>Example Co was founded in 2020 and is headquartered in Berlin.</body></html>
            """
        else:
            html = """
            <html><head><title>Example Co</title>
            <meta name="description" content="Example Co homepage"></head>
            <body>Example Co builds public research tools.
            <a href="/about">About us</a>
            <a href="http://127.0.0.1/admin">Admin</a></body></html>
            """
        return FetchResult(
            url=url,
            status_code=200,
            content_type="text/html; charset=utf-8",
            text=html,
            headers={},
        )


class AppTest(unittest.TestCase):
    def make_client(self, token="secret"):
        settings = Settings(
            token=token,
            max_pages=3,
            request_delay_seconds=0,
            timeout_seconds=1,
        )
        service = ResearchService(settings, FakeFetcher(), resolver=public_resolver)
        return TestClient(create_app(settings=settings, service=service))

    def test_health_reports_fetcher_and_auth(self):
        response = self.make_client().get("/health")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertTrue(body["authConfigured"])
        self.assertEqual(body["fetcher"]["name"], "fake")

    def test_research_requires_bearer_token(self):
        response = self.make_client().post(
            "/v1/research/company",
            json={"companyName": "Example Co", "websiteUrl": "https://example.com"},
        )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"]["code"], "missing_bearer_token")

    def test_research_rejects_blocked_url(self):
        response = self.make_client().post(
            "/v1/research/company",
            headers={"Authorization": "Bearer secret"},
            json={"companyName": "Local", "websiteUrl": "http://localhost:8000"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"]["code"], "blocked_host")

    def test_research_returns_structured_evidence(self):
        response = self.make_client().post(
            "/v1/research/company",
            headers={"Authorization": "Bearer secret"},
            json={"companyName": "Example Co", "websiteUrl": "https://example.com", "maxPages": 2},
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["status"], "ok")
        self.assertEqual(len(body["sources"]), 2)
        self.assertGreaterEqual(len(body["evidence"]), 1)
        self.assertIn("sourceUrl", body["evidence"][0])
        self.assertIn("snippet", body["evidence"][0])
        self.assertIn("Example Co", body["evidence"][0]["snippet"])

    def test_unconfigured_token_returns_clear_error(self):
        response = self.make_client(token=None).post(
            "/v1/research/company",
            headers={"Authorization": "Bearer secret"},
            json={"companyName": "Example Co", "websiteUrl": "https://example.com"},
        )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["detail"]["code"], "auth_token_not_configured")


if __name__ == "__main__":
    unittest.main()
