"""
BXL-RP backend tests — iteration 2.
Covers: Character Profile endpoints + Discord webhook integration on applications.
Existing iteration 1 endpoints are smoke-checked.
"""
import os
import uuid
import time
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fall back to frontend .env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL is required"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bxlrp.be"
ADMIN_PASSWORD = "BxlRP2026!"


# ───────── fixtures
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    assert r.json()["role"] == "admin"
    return s


@pytest.fixture(scope="session")
def player():
    """Register a fresh player and return (session, username, email)."""
    s = requests.Session()
    suffix = uuid.uuid4().hex[:8]
    username = f"TEST_p_{suffix}"
    email = f"test_p_{suffix}@bxlrp.be"
    password = "Test12345!"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "username": username, "password": password},
               timeout=15)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return s, username, email


@pytest.fixture(scope="session")
def player2():
    s = requests.Session()
    suffix = uuid.uuid4().hex[:8]
    username = f"TEST_q_{suffix}"
    email = f"test_q_{suffix}@bxlrp.be"
    r = s.post(f"{API}/auth/register",
               json={"email": email, "username": username, "password": "Test12345!"},
               timeout=15)
    assert r.status_code == 200
    return s, username, email


# ───────── Auth required on /profiles/me
class TestProfilesAuth:
    def test_get_profile_me_requires_auth(self):
        r = requests.get(f"{API}/profiles/me", timeout=10)
        assert r.status_code == 401, f"expected 401 unauth, got {r.status_code}"

    def test_put_profile_me_requires_auth(self):
        r = requests.put(f"{API}/profiles/me", json={"profession": "x"}, timeout=10)
        assert r.status_code == 401


# ───────── Profile CRUD
class TestProfileMe:
    def test_get_profile_me_creates_defaults(self, player):
        s, username, _ = player
        r = s.get(f"{API}/profiles/me", timeout=10)
        assert r.status_code == 200, r.text
        data = r.json()
        # default values
        assert data["username"] == username
        assert data["status"] == "vivant"
        assert data["is_public"] is True
        assert data["character_name"] is None
        assert data["profession"] is None
        assert "user_id" in data
        assert "updated_at" in data
        # mongodb internal id excluded
        assert "_id" not in data

    def test_get_profile_me_persists(self, player):
        """Second GET returns same persisted profile (user_id identical)."""
        s, _, _ = player
        r1 = s.get(f"{API}/profiles/me", timeout=10)
        r2 = s.get(f"{API}/profiles/me", timeout=10)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json()["user_id"] == r2.json()["user_id"]

    def test_put_profile_me_updates_all_fields(self, player):
        s, _, _ = player
        payload = {
            "character_name": "John Doe",
            "photo_url": "https://example.com/p.jpg",
            "profession": "Avocat",
            "faction": "BCSO",
            "address": "12 rue de Bruxelles",
            "phone_ic": "555-1234",
            "status": "en_fuite",
            "criminal_record": "Aucun",
            "biography": "Né à Bruxelles, ancien militaire.",
            "skills": "Tir, Conduite",
            "date_of_birth_ic": "1990-05-12",
            "is_public": True,
        }
        r = s.put(f"{API}/profiles/me", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        out = r.json()
        for k, v in payload.items():
            assert out[k] == v, f"field {k}: expected {v}, got {out.get(k)}"

        # verify persisted via GET
        g = s.get(f"{API}/profiles/me", timeout=10).json()
        for k, v in payload.items():
            assert g[k] == v

    def test_put_profile_me_set_private(self, player):
        s, _, _ = player
        r = s.put(f"{API}/profiles/me", json={"is_public": False}, timeout=10)
        assert r.status_code == 200
        assert r.json()["is_public"] is False
        # restore to public for downstream tests
        s.put(f"{API}/profiles/me", json={"is_public": True}, timeout=10)


# ───────── Public profile listing / by username
class TestPublicProfiles:
    def test_list_public_no_auth(self, player):
        # ensure player's profile exists and is public
        s, username, _ = player
        s.get(f"{API}/profiles/me", timeout=10)
        s.put(f"{API}/profiles/me", json={"is_public": True, "profession": "Ouvrier"}, timeout=10)

        r = requests.get(f"{API}/profiles", timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        usernames = [p["username"] for p in items]
        assert username in usernames
        # all returned must be public
        for p in items:
            assert p.get("is_public", True) is True
            assert "_id" not in p

    def test_get_profile_by_username_public(self, player):
        _, username, _ = player
        r = requests.get(f"{API}/profiles/{username}", timeout=10)
        assert r.status_code == 200
        assert r.json()["username"] == username

    def test_get_profile_by_username_404(self):
        r = requests.get(f"{API}/profiles/__nonexistent_user_xyz__", timeout=10)
        assert r.status_code == 404

    def test_get_profile_by_username_403_when_private(self, player2):
        s, username, _ = player2
        # ensure profile exists, set private
        s.get(f"{API}/profiles/me", timeout=10)
        s.put(f"{API}/profiles/me", json={"is_public": False}, timeout=10)

        r = requests.get(f"{API}/profiles/{username}", timeout=10)
        assert r.status_code == 403, f"expected 403 for private profile, got {r.status_code} {r.text}"

        # also: a private profile must NOT appear in public list
        lst = requests.get(f"{API}/profiles", timeout=10).json()
        assert username not in [p["username"] for p in lst]


# ───────── Application webhook integration (fire-and-forget)
class TestApplicationsWebhook:
    """Webhook must NOT break API responses (best-effort). 1 submit + 1 review only."""

    def test_submit_application_still_returns_201_like(self, player):
        s, _, _ = player
        # Avoid the "déjà en attente" 400 — only run if user has none pending.
        mine = s.get(f"{API}/applications/mine", timeout=10).json()
        if any(a["status"] == "pending" for a in mine):
            pytest.skip("Player already has a pending application")

        payload = {
            "character_name": "Webhook Tester",
            "age": 28,
            "background": "B" * 60,
            "rp_experience": "E" * 60,
            "why_join": "W" * 60,
        }
        r = s.post(f"{API}/applications", json=payload, timeout=15)
        assert r.status_code == 200, f"application submit failed: {r.status_code} {r.text}"
        body = r.json()
        assert body["status"] == "pending"
        assert body["character_name"] == "Webhook Tester"
        assert "id" in body

    def test_admin_review_still_works_with_webhook(self, admin_session, player):
        s, _, _ = player
        # Find pending app belonging to this player
        time.sleep(0.5)
        mine = s.get(f"{API}/applications/mine", timeout=10).json()
        pending = [a for a in mine if a["status"] == "pending"]
        if not pending:
            pytest.skip("No pending application to review")
        app_id = pending[0]["id"]

        r = admin_session.patch(
            f"{API}/applications/{app_id}",
            json={"status": "approved", "admin_note": "TEST webhook"},
            timeout=15,
        )
        assert r.status_code == 200, f"review failed: {r.status_code} {r.text}"
        assert r.json()["status"] == "approved"


# ───────── Iteration-1 smoke (cheap regression)
class TestSmoke:
    def test_server_info(self):
        r = requests.get(f"{API}/server/info", timeout=10)
        assert r.status_code == 200
        assert r.json()["name"] == "Bruxelles RôlePlay"

    def test_news_list(self):
        r = requests.get(f"{API}/news", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
