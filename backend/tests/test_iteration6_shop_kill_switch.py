"""Iteration 6 — Shop kill-switch tests.

Coverage:
- GET /api/shop/settings (public) returns defaults
- PATCH /api/shop/settings requires manage_business
- Partial updates work (only purchases_enabled flips without resetting message)
- POST /api/shop/checkout returns 400 with disabled_message when disabled
- Re-enabling restores checkout
- Audit log entry 'shop_settings_updated' created on each PATCH
- Sub-admin without manage_business → 403
"""
import os
import time
import uuid

import pytest
import requests

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if not url:
        # Fallback: parse from frontend .env (test environment)
        try:
            with open("/app/frontend/.env") as f:
                for line in f:
                    if line.startswith("REACT_APP_BACKEND_URL="):
                        url = line.split("=", 1)[1].strip()
                        break
        except FileNotFoundError:
            pass
    if not url:
        raise RuntimeError("REACT_APP_BACKEND_URL not set")
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bxlrp.be"
ADMIN_PASSWORD = "BxlRP2026!"


# ───────────── helpers ─────────────
def _login(session: requests.Session, email: str, password: str) -> int:
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r.status_code


def _register(session: requests.Session, email: str, password: str, username: str) -> int:
    r = session.post(
        f"{API}/auth/register",
        json={"email": email, "password": password, "username": username},
    )
    return r.status_code


# ───────────── fixtures ─────────────
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    assert _login(s, ADMIN_EMAIL, ADMIN_PASSWORD) == 200, "Admin login failed — check seed"
    yield s
    # Restore shop to enabled state at end
    s.patch(
        f"{API}/shop/settings",
        json={
            "purchases_enabled": True,
            "disabled_message": "La boutique est temporairement indisponible. Ouvre un ticket Discord pour acheter ton pack VIP manuellement.",
            "discord_ticket_url": "https://discord.gg/bxlrp",
        },
    )


@pytest.fixture(scope="module")
def player_session():
    s = requests.Session()
    uniq = uuid.uuid4().hex[:8]
    email = f"testiter6_{uniq}@bxlrp.be"
    password = "PlayerPwd2026!"
    username = f"iter6_{uniq}"
    status = _register(s, email, password, username)
    assert status in (200, 201), f"register failed {status}"
    # Auto-login after register or login explicitly
    me = s.get(f"{API}/auth/me")
    if me.status_code != 200:
        assert _login(s, email, password) == 200
    return s


@pytest.fixture(scope="module")
def sub_admin_creds(admin_session):
    """Create a sub-admin without manage_business permission."""
    uniq = uuid.uuid4().hex[:8]
    email = f"subadmin6_{uniq}@bxlrp.be"
    password = "SubPwd2026!"
    username = f"sub6_{uniq}"
    r = admin_session.post(
        f"{API}/admin/admins",
        json={
            "email": email,
            "username": username,
            "password": password,
            "permissions": ["manage_news"],  # no manage_business
        },
    )
    assert r.status_code == 200, f"create sub-admin failed: {r.status_code} {r.text}"
    return {"email": email, "password": password, "username": username}


@pytest.fixture(scope="module")
def sub_admin_session(sub_admin_creds):
    s = requests.Session()
    assert _login(s, sub_admin_creds["email"], sub_admin_creds["password"]) == 200
    return s


# ───────────── tests ─────────────
class TestShopSettingsPublic:
    def test_get_shop_settings_public_no_auth(self):
        r = requests.get(f"{API}/shop/settings")
        assert r.status_code == 200
        data = r.json()
        assert "purchases_enabled" in data
        assert "disabled_message" in data
        assert "discord_ticket_url" in data
        assert isinstance(data["purchases_enabled"], bool)
        # Default message and URL should be non-empty
        assert len(data["disabled_message"]) > 0
        assert data["discord_ticket_url"].startswith("http")


class TestShopSettingsPatchAuth:
    def test_patch_requires_auth(self):
        r = requests.patch(f"{API}/shop/settings", json={"purchases_enabled": False})
        assert r.status_code in (401, 403)

    def test_patch_sub_admin_without_manage_business_403(self, sub_admin_session):
        r = sub_admin_session.patch(f"{API}/shop/settings", json={"purchases_enabled": False})
        assert r.status_code == 403, f"expected 403, got {r.status_code} body={r.text}"


class TestShopSettingsPatchAdmin:
    def test_partial_update_only_flag_keeps_message(self, admin_session):
        # First set a known message + url
        r = admin_session.patch(
            f"{API}/shop/settings",
            json={
                "disabled_message": "Custom message ITER6",
                "discord_ticket_url": "https://discord.gg/iter6-test",
                "purchases_enabled": True,
            },
        )
        assert r.status_code == 200
        # Now flip ONLY purchases_enabled
        r2 = admin_session.patch(f"{API}/shop/settings", json={"purchases_enabled": False})
        assert r2.status_code == 200
        d = r2.json()
        assert d["purchases_enabled"] is False
        assert d["disabled_message"] == "Custom message ITER6"
        assert d["discord_ticket_url"] == "https://discord.gg/iter6-test"

    def test_update_text_fields_only(self, admin_session):
        r = admin_session.patch(
            f"{API}/shop/settings",
            json={
                "disabled_message": "Edited message X",
                "discord_ticket_url": "https://discord.gg/edited-Y",
            },
        )
        assert r.status_code == 200
        d = r.json()
        assert d["disabled_message"] == "Edited message X"
        assert d["discord_ticket_url"] == "https://discord.gg/edited-Y"
        # purchases_enabled should remain whatever it was (False from prev test)
        assert d["purchases_enabled"] is False

    def test_get_after_patch_persists(self, admin_session):
        r = requests.get(f"{API}/shop/settings")
        assert r.status_code == 200
        d = r.json()
        assert d["disabled_message"] == "Edited message X"
        assert d["discord_ticket_url"] == "https://discord.gg/edited-Y"
        assert d["purchases_enabled"] is False


class TestCheckoutGated:
    def test_checkout_blocked_when_disabled(self, admin_session, player_session):
        # Ensure disabled with known message
        admin_session.patch(
            f"{API}/shop/settings",
            json={"purchases_enabled": False, "disabled_message": "BLOCKED ITER6"},
        )
        r = player_session.post(
            f"{API}/shop/checkout",
            json={
                "items": [{"package_id": "citoyen_plus", "quantity": 1}],
                "origin_url": BASE_URL,
            },
        )
        assert r.status_code == 400
        # detail should be the disabled_message
        try:
            detail = r.json().get("detail", "")
        except Exception:
            detail = r.text
        assert "BLOCKED ITER6" in detail

    def test_checkout_allowed_after_reenable(self, admin_session, player_session):
        r = admin_session.patch(f"{API}/shop/settings", json={"purchases_enabled": True})
        assert r.status_code == 200
        assert r.json()["purchases_enabled"] is True
        # Now checkout should not be blocked by gate (may still depend on Stripe config — accept 200 or non-400-disabled)
        r2 = player_session.post(
            f"{API}/shop/checkout",
            json={
                "items": [{"package_id": "citoyen_plus", "quantity": 1}],
                "origin_url": BASE_URL,
            },
        )
        # Should not be 400 with the BLOCKED message
        if r2.status_code == 400:
            assert "BLOCKED ITER6" not in r2.text
        else:
            assert r2.status_code in (200, 201), f"unexpected: {r2.status_code} {r2.text}"


class TestAuditLog:
    def test_audit_log_contains_shop_settings_updated(self, admin_session):
        # Trigger a patch
        admin_session.patch(f"{API}/shop/settings", json={"purchases_enabled": True})
        time.sleep(0.3)
        r = admin_session.get(f"{API}/admin/audit")
        assert r.status_code == 200, f"audit endpoint: {r.status_code} {r.text}"
        body = r.json()
        items = body if isinstance(body, list) else body.get("items") or body.get("audit") or []
        assert any(it.get("action") == "shop_settings_updated" for it in items), (
            f"shop_settings_updated not found in audit log; sample: {items[:3]}"
        )
