import ipaddress
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from deep_research.security import BlockedUrlError, validate_public_http_url


def resolver_with(address):
    def resolve(_hostname):
        return [ipaddress.ip_address(address)]

    return resolve


class SecurityTest(unittest.TestCase):
    def test_rejects_file_scheme(self):
        with self.assertRaises(BlockedUrlError) as ctx:
            validate_public_http_url("file:///etc/passwd")
        self.assertEqual(ctx.exception.code, "unsupported_scheme")

    def test_rejects_localhost(self):
        with self.assertRaises(BlockedUrlError) as ctx:
            validate_public_http_url("http://localhost:8080")
        self.assertEqual(ctx.exception.code, "blocked_host")

    def test_rejects_private_ip_literal(self):
        with self.assertRaises(BlockedUrlError) as ctx:
            validate_public_http_url("http://10.0.0.1")
        self.assertEqual(ctx.exception.code, "blocked_network")

    def test_rejects_private_dns_result(self):
        with self.assertRaises(BlockedUrlError) as ctx:
            validate_public_http_url("https://example.com", resolver_with("192.168.1.10"))
        self.assertEqual(ctx.exception.code, "blocked_network")

    def test_allows_public_https_url_and_removes_fragment(self):
        url = validate_public_http_url(
            "https://Example.COM/about#team",
            resolver_with("93.184.216.34"),
        )
        self.assertEqual(url, "https://example.com/about")

    def test_rejects_credentials(self):
        with self.assertRaises(BlockedUrlError) as ctx:
            validate_public_http_url(
                "https://user:pass@example.com/",
                resolver_with("93.184.216.34"),
            )
        self.assertEqual(ctx.exception.code, "credentials_not_allowed")

    def test_rejects_malformed_url(self):
        with self.assertRaises(BlockedUrlError) as ctx:
            validate_public_http_url("https://[::1")
        self.assertEqual(ctx.exception.code, "invalid_url")


if __name__ == "__main__":
    unittest.main()
