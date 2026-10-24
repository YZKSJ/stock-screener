"""Smoke tests for read-only derivatives route registration."""
from app.main import app

def test_derivatives_routes_are_registered():
    paths = {
        getattr(route, "path", None)
        for route in app.router.routes
        if getattr(route, "path", None)
    }
    assert "/api/v1/derivatives/validate-snapshot" in paths
    assert "/api/v1/derivatives/history/daily" in paths
    assert "/api/v1/derivatives/scan/daily" in paths
