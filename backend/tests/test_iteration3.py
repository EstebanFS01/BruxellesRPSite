"""
BXL-RP backend tests — iteration 3.
Covers: RBAC permissions, admin management, cascade delete users,
business applications, audit log, application delete, Discord ID on application.

Discord role assignment is BEST-EFFORT — webhook spamming intentionally minimized.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                    break
    except Exception:
        pass
assert BASE_URL, "REACT_APP_BACKEND_URL required"
API = f"{BASE_URL}/api"
ADMIN_EMAIL = "admin@bxlrp.be"
ADMIN_PASSWORD = "BxlRP2026!"


# ───── Fixtures
@pytest.fixture(scope="module")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return s


@pytest.fixture(scope="module")
def player_session():
    s = requests.Session()
    suf = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register",
               json={"email": f"test_pl_{suf}@bxlrp.be",
                     "username": f"TEST_pl_{suf}",
                     "password": "Test12345!"}, timeout=15)
    assert r.status_code == 200, r.text
    return s, r.json()["id"], r.json()["username"]


@pytest.fixture(scope="module")
def player2_session():
    s = requests.Session()
    suf = uuid.uuid4().hex[:8]
    r = s.post(f"{API}/auth/register",
               json={"email": f"test_pl2_{suf}@bxlrp.be",
                     "username": f"TEST_pl2_{suf}",
                     "password": "Test12345!"}, timeout=15)
    assert r.status_code == 200
    return s, r.json()["id"], r.json()["username"]


@pytest.fixture(scope="module")
def created_subadmin(admin_session):
    """Create a sub-admin with only manage_news permission."""
    suf = uuid.uuid4().hex[:8]
    email = f"test_sub_{suf}@bxlrp.be"
    username = f"TEST_sub_{suf}"
    pwd = "SubTest12345!"
    r = admin_session.post(f"{API}/admin/admins",
                           json={"email": email, "username": username,
                                 "password": pwd, "permissions": ["manage_news"]},
                           timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "id" in body
    # Now login as this subadmin
    sub = requests.Session()
    lr = sub.post(f"{API}/auth/login", json={"email": email, "password": pwd}, timeout=15)
    assert lr.status_code == 200, lr.text
    assert lr.json()["role"] == "admin"
    return {"session": sub, "id": body["id"], "email": email, "username": username, "password": pwd}


# ───── Permissions / RBAC
class TestPermsEndpoint:
    def test_perms_super_admin(self, admin_session):
        r = admin_session.get(f"{API}/auth/perms", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "admin"
        assert d["is_super_admin"] is True
        assert set(d["all_perms"]) == {
            "manage_news", "manage_whitelist", "manage_business",
            "manage_users", "manage_admins", "view_audit",
        }
        # super-admin has all
        assert set(d["permissions"]) >= set(d["all_perms"]) or d["is_super_admin"]

    def test_perms_player(self, player_session):
        s, _, _ = player_session
        r = s.get(f"{API}/auth/perms", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "player"
        assert d["is_super_admin"] is False
        assert d["permissions"] == []

    def test_perms_unauth(self):
        r = requests.get(f"{API}/auth/perms", timeout=10)
        assert r.status_code == 401


# ───── Admin creation & RBAC enforcement
class TestAdminManagement:
    def test_subadmin_can_create_news(self, created_subadmin):
        sub = created_subadmin["session"]
        r = sub.post(f"{API}/news", json={
            "title": "TEST sub news", "excerpt": "x" * 5,
            "content": "y" * 5, "category": "Test",
        }, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["title"] == "TEST sub news"

    def test_subadmin_denied_applications(self, created_subadmin):
        sub = created_subadmin["session"]
        r = sub.get(f"{API}/applications", timeout=10)
        assert r.status_code == 403

    def test_subadmin_denied_users(self, created_subadmin):
        sub = created_subadmin["session"]
        r = sub.get(f"{API}/admin/users", timeout=10)
        assert r.status_code == 403

    def test_subadmin_denied_create_admin(self, created_subadmin):
        sub = created_subadmin["session"]
        r = sub.post(f"{API}/admin/admins", json={
            "email": "x@x.com", "username": "TEST_x", "password": "abcdef", "permissions": []
        }, timeout=10)
        assert r.status_code == 403

    def test_subadmin_denied_audit(self, created_subadmin):
        sub = created_subadmin["session"]
        r = sub.get(f"{API}/admin/audit", timeout=10)
        assert r.status_code == 403

    def test_list_admins_super(self, admin_session, created_subadmin):
        r = admin_session.get(f"{API}/admin/admins", timeout=10)
        assert r.status_code == 200
        body = r.json()
        assert "admins" in body and "all_perms" in body
        usernames = [a["username"] for a in body["admins"]]
        assert created_subadmin["username"] in usernames

    def test_patch_admin_perms(self, admin_session, created_subadmin):
        sub_id = created_subadmin["id"]
        r = admin_session.patch(f"{API}/admin/admins/{sub_id}",
                                json={"permissions": ["manage_news", "manage_business"]},
                                timeout=10)
        assert r.status_code == 200
        assert set(r.json()["permissions"]) == {"manage_news", "manage_business"}
        # Verify via GET
        lst = admin_session.get(f"{API}/admin/admins", timeout=10).json()["admins"]
        target = next(a for a in lst if a["id"] == sub_id)
        assert set(target["permissions"]) == {"manage_news", "manage_business"}

    def test_patch_super_admin_blocked(self, admin_session):
        admins = admin_session.get(f"{API}/admin/admins", timeout=10).json()["admins"]
        super_admin = next(a for a in admins if a.get("is_super_admin"))
        r = admin_session.patch(f"{API}/admin/admins/{super_admin['id']}",
                                json={"permissions": []}, timeout=10)
        assert r.status_code == 400


# ───── User cascade delete
class TestUserCascadeDelete:
    def test_cannot_delete_self(self, admin_session):
        admins = admin_session.get(f"{API}/admin/admins", timeout=10).json()["admins"]
        super_admin = next(a for a in admins if a.get("is_super_admin"))
        r = admin_session.delete(f"{API}/admin/users/{super_admin['id']}", timeout=10)
        assert r.status_code == 400

    def test_cannot_delete_super_admin(self, admin_session, created_subadmin):
        # super-admin is also self in this case; covered above. Use other path:
        # we created via fixture; verify deleting super via another admin returns 400.
        # Here we just re-assert via same admin (still 400 by self-check or super flag)
        admins = admin_session.get(f"{API}/admin/admins", timeout=10).json()["admins"]
        super_admin = next(a for a in admins if a.get("is_super_admin"))
        r = admin_session.delete(f"{API}/admin/users/{super_admin['id']}", timeout=10)
        assert r.status_code == 400

    def test_cascade_delete_player(self, admin_session, player2_session):
        s, uid, uname = player2_session
        # Create profile + business app for this user to verify cascade
        s.get(f"{API}/profiles/me", timeout=10)
        s.post(f"{API}/business-applications", json={
            "faction_key": "lspd", "faction_name": "LSPD", "position": "Officier",
            "motivation": "M" * 30, "discord_id": "111111111111111111"
        }, timeout=10)

        # Confirm profile exists publicly
        r0 = requests.get(f"{API}/profiles/{uname}", timeout=10)
        assert r0.status_code == 200

        # Delete
        r = admin_session.delete(f"{API}/admin/users/{uid}", timeout=10)
        assert r.status_code == 200, r.text

        # Verify cascade: profile gone, user gone
        r1 = requests.get(f"{API}/profiles/{uname}", timeout=10)
        assert r1.status_code == 404
        users = admin_session.get(f"{API}/admin/users", timeout=10).json()
        assert all(u["id"] != uid for u in users)


# ───── Discord ID on application + delete
class TestApplicationDiscordAndDelete:
    @pytest.fixture(scope="class")
    def submitted_app(self, player_session):
        s, _, _ = player_session
        mine = s.get(f"{API}/applications/mine", timeout=10).json()
        pending = [a for a in mine if a["status"] == "pending"]
        if pending:
            return pending[0]["id"]
        # Submit with discord_id
        r = s.post(f"{API}/applications", json={
            "character_name": "Discord Tester",
            "age": 25,
            "discord_id": "999999999999999999",  # not in guild, role assign will fail silently
            "background": "B" * 60,
            "rp_experience": "E" * 60,
            "why_join": "W" * 60,
        }, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["discord_id"] == "999999999999999999"
        return body["id"]

    def test_review_returns_discord_role_given_field(self, admin_session, submitted_app):
        r = admin_session.patch(f"{API}/applications/{submitted_app}",
                                json={"status": "approved", "admin_note": "TEST"},
                                timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "approved"
        # field present, value can be true or false (best-effort)
        assert "discord_role_given" in body
        assert body["discord_role_given"] in (True, False, None)

    def test_delete_pending_application_400(self, admin_session, player_session):
        # Submit a new pending app on a brand new player so it's clearly pending
        s = requests.Session()
        suf = uuid.uuid4().hex[:6]
        s.post(f"{API}/auth/register", json={
            "email": f"test_a_{suf}@bxlrp.be",
            "username": f"TEST_a_{suf}",
            "password": "Test12345!"
        }, timeout=10)
        r = s.post(f"{API}/applications", json={
            "character_name": "Pending Guy", "age": 22,
            "background": "B" * 60, "rp_experience": "E" * 60, "why_join": "W" * 60
        }, timeout=10)
        assert r.status_code == 200
        app_id = r.json()["id"]
        d = admin_session.delete(f"{API}/applications/{app_id}", timeout=10)
        assert d.status_code == 400

    def test_delete_reviewed_application_ok(self, admin_session, submitted_app):
        d = admin_session.delete(f"{API}/applications/{submitted_app}", timeout=10)
        assert d.status_code == 200
        # Verify gone
        lst = admin_session.get(f"{API}/applications", timeout=10).json()
        assert all(a["id"] != submitted_app for a in lst)


# ───── Business applications
class TestBusinessApplications:
    @pytest.fixture(scope="class")
    def biz_app(self, player_session):
        s, _, _ = player_session
        # ensure unique faction not yet pending
        r = s.post(f"{API}/business-applications", json={
            "faction_key": "bcso", "faction_name": "BCSO",
            "position": "Adjoint", "discord_id": "888888888888888888",
            "motivation": "M" * 40,
        }, timeout=10)
        if r.status_code == 400:
            # already exists — find it
            mine = s.get(f"{API}/business-applications/mine", timeout=10).json()
            existing = next((b for b in mine if b["faction_key"] == "bcso" and b["status"] == "pending"), None)
            assert existing
            return existing["id"]
        assert r.status_code == 200, r.text
        return r.json()["id"]

    def test_duplicate_pending_400(self, player_session, biz_app):
        s, _, _ = player_session
        r = s.post(f"{API}/business-applications", json={
            "faction_key": "bcso", "faction_name": "BCSO",
            "position": "Sergent", "motivation": "M" * 30,
        }, timeout=10)
        assert r.status_code == 400

    def test_list_mine(self, player_session, biz_app):
        s, _, _ = player_session
        r = s.get(f"{API}/business-applications/mine", timeout=10)
        assert r.status_code == 200
        assert any(a["id"] == biz_app for a in r.json())

    def test_list_all_admin(self, admin_session, biz_app):
        r = admin_session.get(f"{API}/business-applications", timeout=10)
        assert r.status_code == 200
        assert any(a["id"] == biz_app for a in r.json())

    def test_list_all_unauth_403(self, player_session, biz_app):
        s, _, _ = player_session
        r = s.get(f"{API}/business-applications", timeout=10)
        assert r.status_code == 403

    def test_delete_pending_400(self, admin_session, biz_app):
        r = admin_session.delete(f"{API}/business-applications/{biz_app}", timeout=10)
        assert r.status_code == 400

    def test_approve_then_delete(self, admin_session, biz_app):
        r = admin_session.patch(f"{API}/business-applications/{biz_app}",
                                json={"status": "approved", "admin_note": "TEST ok"},
                                timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "approved"

        d = admin_session.delete(f"{API}/business-applications/{biz_app}", timeout=10)
        assert d.status_code == 200


# ───── Audit log
class TestAuditLog:
    def test_audit_log_accumulates(self, admin_session):
        r = admin_session.get(f"{API}/admin/audit", timeout=10)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        # We've performed many actions above; expect entries for several types
        actions = {it["action"] for it in items}
        # At minimum should contain a subset of our triggered actions
        expected_any = {"admin_created", "admin_perms_updated", "user_deleted",
                        "news_created", "business_approved", "business_deleted",
                        "app_approved", "app_deleted"}
        assert actions & expected_any, f"no expected audit actions found; got {actions}"
        # entries should have admin_username + created_at
        sample = items[0]
        assert "admin_username" in sample
        assert "created_at" in sample
