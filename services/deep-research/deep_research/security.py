from __future__ import annotations

import ipaddress
import socket
from collections.abc import Callable, Iterable
from urllib.parse import ParseResult, urlparse, urlunparse


class BlockedUrlError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


Resolver = Callable[[str], Iterable[ipaddress.IPv4Address | ipaddress.IPv6Address | str]]

_EXTRA_BLOCKED_NETWORKS = (
    ipaddress.ip_network("100.64.0.0/10"),
)


def resolve_host_addresses(hostname: str) -> list[ipaddress.IPv4Address | ipaddress.IPv6Address]:
    ip_literal = _parse_ip_literal(hostname)
    if ip_literal is not None:
        return [ip_literal]

    try:
        results = socket.getaddrinfo(hostname, None, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise BlockedUrlError(
            "dns_resolution_failed",
            f"Could not resolve host `{hostname}`.",
        ) from exc

    addresses: list[ipaddress.IPv4Address | ipaddress.IPv6Address] = []
    for result in results:
        raw_address = result[4][0]
        address = ipaddress.ip_address(raw_address)
        if address not in addresses:
            addresses.append(address)
    return addresses


def validate_public_http_url(url: str, resolver: Resolver = resolve_host_addresses) -> str:
    parsed = _parse_url(url)
    try:
        hostname = parsed.hostname
    except ValueError as exc:
        raise BlockedUrlError("invalid_url", "URL is not valid.") from exc
    if not hostname:
        raise BlockedUrlError("missing_host", "URL must include a host.")

    hostname = hostname.rstrip(".").lower()
    if parsed.username or parsed.password:
        raise BlockedUrlError("credentials_not_allowed", "Credentials in URLs are not allowed.")
    if _is_local_hostname(hostname):
        raise BlockedUrlError("blocked_host", f"Host `{hostname}` is local or internal.")

    ip_literal = _parse_ip_literal(hostname)
    if ip_literal is None and "." not in hostname:
        raise BlockedUrlError(
            "single_label_host_not_allowed",
            f"Host `{hostname}` is not a public fully qualified domain name.",
        )

    addresses = [_coerce_address(address) for address in resolver(hostname)]
    if not addresses:
        raise BlockedUrlError("dns_resolution_failed", f"Could not resolve host `{hostname}`.")
    blocked = [address for address in addresses if _is_blocked_address(address)]
    if blocked:
        raise BlockedUrlError(
            "blocked_network",
            f"Host `{hostname}` resolves to a blocked address.",
        )

    normalized = parsed._replace(
        scheme=parsed.scheme.lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
    )
    return urlunparse(normalized)


def _parse_url(url: str) -> ParseResult:
    if not isinstance(url, str) or not url.strip():
        raise BlockedUrlError("empty_url", "URL must be a non-empty string.")
    try:
        parsed = urlparse(url.strip())
    except ValueError as exc:
        raise BlockedUrlError("invalid_url", "URL is not valid.") from exc
    if parsed.scheme.lower() not in {"http", "https"}:
        raise BlockedUrlError(
            "unsupported_scheme",
            "Only http and https URLs are allowed.",
        )
    return parsed


def _parse_ip_literal(hostname: str):
    value = hostname.strip("[]")
    try:
        return ipaddress.ip_address(value)
    except ValueError:
        return None


def _coerce_address(address):
    if isinstance(address, (ipaddress.IPv4Address, ipaddress.IPv6Address)):
        return address
    return ipaddress.ip_address(str(address))


def _is_local_hostname(hostname: str) -> bool:
    return (
        hostname in {"localhost", "localhost.localdomain", "0"}
        or hostname.endswith(".localhost")
        or hostname.endswith(".local")
    )


def _is_blocked_address(address) -> bool:
    if (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    ):
        return True
    return any(address in network for network in _EXTRA_BLOCKED_NETWORKS)
