"""
Iteration 4 — Factions DB-backed + Patron (owner) RBAC tests.
Covers:
- GET /factions (12 seeded, fields)
- GET /factions/{key}, /factions/mine
- POST /admin/factions/{key}/owner (assign/remove)
- PATCH /factions/{key} (owner vs admin vs unauthorized)
- PATCH /factions/{key}/recruitment (owner toggle)
- POST /business-applications when recruitment_open=False -> 400
- GET /business-applications (admin all, patron filtered, other -> 403)
- PATCH /business-applications/{id} (patron own faction only)
- POST /factions duplicate key -> 400; DELETE cascades business_applications
"""
import os
import time
import uuid
import pytest
import requests

def _load_backend_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v
    try:
        with open("/app/frontend/.env") as fh:
            for line in fh:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip()
    except FileNotFoundError:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")


BASE_URL = _load_backend_url().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@bxlrp.be"
ADMIN_PASS = "BxlRP2026!"

UNIQUE = uuid.uuid4().hex[:6]


def _login(email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return s


def _register(username, email, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={"username": username, "email": email, "password": password})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def admin_session():
    return _login(ADMIN_EMAIL, ADMIN_PASS)


@pytest.fixture(scope="module")
def patron_user():
    uname = f"TESTpat{UNIQUE}"
    email = f"testpat{UNIQUE}@bxlrp.be"
    pw = "Patron2026!"
    s = _register(uname, email, pw)
    me = s.get(f"{API}/auth/me").json()
    return {"session": s, "username": uname, "email": email, "password": pw, "id": me["id"]}


@pytest.fixture(scope="module")
def other_player():
    uname = f"TESToth{UNIQUE}"
    email = f"testoth{UNIQUE}@bxlrp.be"
    pw = "Other2026!"
    s = _register(uname, email, pw)
    me = s.get(f"{API}/auth/me").json()
    return {"session": s, "username": uname, "email": email, "password": pw, "id": me["id"]}


# ───────── GET /factions
class TestListFactions:
    def test_list_returns_12_seeded(self):
        r = requests.get(f"{API}/factions")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 12, f"expected >=12 factions, got {len(data)}"

    def test_faction_fields(self):
        data = requests.get(f"{API}/factions").json()
        lspd = next((f for f in data if f["key"] == "lspd"), None)
        assert lspd is not None, "lspd faction missing"
        for k in ("key", "name", "category", "description", "color", "icon_key",
                  "positions", "is_whitelist", "recruitment_open"):
            assert k in lspd, f"missing field: {k}"
        # owner_username key present (may be null)
        assert "owner_username" in lspd

    def test_get_single_faction(self):
        r = requests.get(f"{API}/factions/lspd")
        assert r.status_code == 200
        f = r.json()
        assert f["key"] == "lspd"
        assert "owner_username" in f

    def test_get_unknown_faction_404(self):
        r = requests.get(f"{API}/factions/doesnotexist")
        assert r.status_code == 404


# ───────── /factions/mine
class TestFactionsMine:
    def test_mine_unauth_401(self):
        r = requests.get(f"{API}/factions/mine")
        assert r.status_code == 401

    def test_mine_player_empty(self, other_player):
        r = other_player["session"].get(f"{API}/factions/mine")
        assert r.status_code == 200
        assert r.json() == []


# ───────── assign owner / patron flow
class TestPatronAssignment:
    def test_admin_assigns_patron(self, admin_session, patron_user):
        r = admin_session.post(f"{API}/admin/factions/lspd/owner",
                               json={"user_id": patron_user["id"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["owner_user_id"] == patron_user["id"]
        assert data["owner_username"] == patron_user["username"]

        # verify via GET
        f = requests.get(f"{API}/factions/lspd").json()
        assert f["owner_username"] == patron_user["username"]

    def test_mine_returns_owned(self, patron_user):
        r = patron_user["session"].get(f"{API}/factions/mine")
        assert r.status_code == 200
        keys = [f["key"] for f in r.json()]
        assert "lspd" in keys

    def test_non_admin_cannot_set_owner(self, other_player, patron_user):
        r = other_player["session"].post(
            f"{API}/admin/factions/lspd/owner",
            json={"user_id": patron_user["id"]},
        )
        assert r.status_code == 403


# ───────── PATCH /factions/{key}
class TestFactionUpdate:
    def test_patron_can_update(self, patron_user):
        new_desc = f"Updated desc {UNIQUE}"
        r = patron_user["session"].patch(
            f"{API}/factions/lspd",
            json={"description": new_desc, "color": "#1D4ED8",
                  "positions": ["Recrue", "Officier", "Capitaine"]},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["description"] == new_desc
        assert "Capitaine" in data["positions"]

        # persistence
        f = requests.get(f"{API}/factions/lspd").json()
        assert f["description"] == new_desc

    def test_admin_can_update_any(self, admin_session):
        r = admin_session.patch(f"{API}/factions/ems", json={"slots_max": 25})
        assert r.status_code == 200

    def test_non_owner_403(self, other_player):
        r = other_player["session"].patch(
            f"{API}/factions/lspd", json={"description": "hack"}
        )
        assert r.status_code == 403

    def test_unauth_401(self):
        r = requests.patch(f"{API}/factions/lspd", json={"description": "x"})
        assert r.status_code == 401


# ───────── recruitment toggle
class TestRecruitment:
    def test_patron_toggles_closed(self, patron_user):
        r = patron_user["session"].patch(
            f"{API}/factions/lspd/recruitment", json={"recruitment_open": False}
        )
        assert r.status_code == 200
        assert r.json()["recruitment_open"] is False
        f = requests.get(f"{API}/factions/lspd").json()
        assert f["recruitment_open"] is False

    def test_apply_when_closed_returns_400(self, other_player):
        r = other_player["session"].post(
            f"{API}/business-applications",
            json={
                "faction_key": "lspd",
                "faction_name": "LSPD",
                "position": "Recrue",
                "discord_id": "111111111111111111",
                "motivation": "test closed",
            },
        )
        assert r.status_code == 400
        assert "fermé" in r.json().get("detail", "").lower() or "ferme" in r.json().get("detail", "").lower()

    def test_non_owner_cannot_toggle(self, other_player):
        r = other_player["session"].patch(
            f"{API}/factions/lspd/recruitment", json={"recruitment_open": True}
        )
        assert r.status_code == 403

    def test_patron_reopens(self, patron_user):
        r = patron_user["session"].patch(
            f"{API}/factions/lspd/recruitment", json={"recruitment_open": True}
        )
        assert r.status_code == 200
        assert r.json()["recruitment_open"] is True


# ───────── GET /business-applications visibility
class TestBusinessAppsVisibility:
    @pytest.fixture(scope="class")
    def seeded_app(self, other_player):
        # ensure recruitment open at this point
        r = other_player["session"].post(
            f"{API}/business-applications",
            json={
                "faction_key": "lspd",
                "faction_name": "LSPD",
                "position": "Recrue",
                "discord_id": "222222222222222222",
                "motivation": "patron visibility test",
            },
        )
        assert r.status_code in (200, 201, 400), r.text
        if r.status_code == 400:
            # already had a pending — fine, find existing one
            return None
        return r.json()

    def test_admin_sees_all(self, admin_session, seeded_app):
        r = admin_session.get(f"{API}/business-applications")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_patron_sees_only_their_faction(self, patron_user, seeded_app):
        r = patron_user["session"].get(f"{API}/business-applications")
        assert r.status_code == 200
        apps = r.json()
        # All visible apps must be for lspd
        assert all(a["faction_key"] == "lspd" for a in apps), f"saw foreign apps: {[a['faction_key'] for a in apps]}"

    def test_random_player_forbidden(self):
        # fresh player owning nothing
        uname = f"TESTviz{UNIQUE}"
        s = _register(uname, f"testviz{UNIQUE}@bxlrp.be", "Visi2026!")
        r = s.get(f"{API}/business-applications")
        assert r.status_code == 403


# ───────── PATCH business-applications (patron review)
class TestPatronReview:
    def test_patron_can_approve_own_faction_app(self, patron_user, other_player):
        # Find a pending app for lspd from other_player
        apps = patron_user["session"].get(f"{API}/business-applications").json()
        pending = [a for a in apps if a["faction_key"] == "lspd" and a["status"] == "pending"]
        if not pending:
            # create one
            other_player["session"].post(
                f"{API}/business-applications",
                json={
                    "faction_key": "lspd", "faction_name": "LSPD",
                    "position": "Officier",
                    "discord_id": "333333333333333333",
                    "motivation": "review test",
                },
            )
            apps = patron_user["session"].get(f"{API}/business-applications").json()
            pending = [a for a in apps if a["faction_key"] == "lspd" and a["status"] == "pending"]
        assert pending, "no pending app for lspd"
        app_id = pending[0]["id"]
        r = patron_user["session"].patch(
            f"{API}/business-applications/{app_id}",
            json={"status": "approved", "admin_note": "ok"},
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "approved"

    def test_patron_cannot_review_other_faction(self, patron_user, other_player):
        # other_player submits for ems (where patron is NOT owner)
        sub = other_player["session"].post(
            f"{API}/business-applications",
            json={
                "faction_key": "ems", "faction_name": "EMS",
                "position": "Médecin",
                "discord_id": "444444444444444444",
                "motivation": "foreign faction app test",
            },
        )
        # may 400 if a previous run had a pending; handle either
        if sub.status_code == 400:
            # fetch existing pending via admin? We can't from patron view; skip
            pytest.skip("could not seed foreign faction app")
        assert sub.status_code in (200, 201), sub.text
        app_id = sub.json()["id"]
        r = patron_user["session"].patch(
            f"{API}/business-applications/{app_id}",
            json={"status": "approved"},
        )
        assert r.status_code == 403


# ───────── factions create / duplicate / cascade delete
class TestFactionCRUD:
    NEW_KEY = f"testfac{UNIQUE}"

    def test_create_faction(self, admin_session):
        r = admin_session.post(
            f"{API}/factions",
            json={
                "key": self.NEW_KEY,
                "name": "Test Faction",
                "category": "Civile",
                "description": "tmp",
                "color": "#888888",
                "icon_key": "shield",
                "image_url": None,
                "positions": ["Membre"],
                "is_whitelist": True,
                "slots_max": 10,
            },
        )
        assert r.status_code == 200, r.text
        assert r.json()["key"] == self.NEW_KEY

    def test_duplicate_key_400(self, admin_session):
        r = admin_session.post(
            f"{API}/factions",
            json={
                "key": self.NEW_KEY,
                "name": "dup",
                "category": "Civile",
                "description": "x duplicate",
                "color": "#999999",
                "icon_key": "shield",
                "positions": [],
                "is_whitelist": False,
                "slots_max": 0,
            },
        )
        assert r.status_code == 400

    def test_delete_cascades_business_apps(self, admin_session, other_player):
        # seed a business app for the new faction
        sub = other_player["session"].post(
            f"{API}/business-applications",
            json={
                "faction_key": self.NEW_KEY, "faction_name": "Test Faction",
                "position": "Membre",
                "discord_id": "555555555555555555",
                "motivation": "cascade delete test",
            },
        )
        assert sub.status_code in (200, 201, 400)
        app_id = sub.json().get("id") if sub.status_code in (200, 201) else None

        r = admin_session.delete(f"{API}/factions/{self.NEW_KEY}")
        assert r.status_code == 200

        # faction gone
        assert requests.get(f"{API}/factions/{self.NEW_KEY}").status_code == 404
        # cascaded app gone
        if app_id:
            all_apps = admin_session.get(f"{API}/business-applications").json()
            assert not any(a["id"] == app_id for a in all_apps), "app should be cascade-deleted"


# ───────── cleanup: remove patron ownership so subsequent test runs start fresh
class TestZCleanup:
    def test_remove_patron(self, admin_session):
        r = admin_session.post(f"{API}/admin/factions/lspd/owner", json={"user_id": None})
        assert r.status_code == 200
        assert r.json()["owner_user_id"] is None
