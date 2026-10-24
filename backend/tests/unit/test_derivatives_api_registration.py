"""Smoke test for the first read-only derivatives endpoint."""
from app.main import app


def test_derivatives_snapshot_validation_route_is_registered():
    paths = {
        getattr(route, "path", None)
        for route in app.router.routes
        if getattr(route, "path", None)
    }
    assert "/api/v1/derivatives/validate-snapshot" in paths
