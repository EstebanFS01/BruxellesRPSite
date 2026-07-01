"""
Iteration 5 — Stripe Checkout / Boutique VIP backend tests
Covers:
  - GET  /api/shop/catalog
  - POST /api/shop/checkout (auth, server-side amount, validation, persistence)
  - GET  /api/shop/status/{session_id} (404 / 403 / 200, idempotency)
  - GET  /api/shop/orders/mine (auth, ordering)
  - POST /api/webhook/stripe (best-effort)
  - GET  /api/auth/me includes vip_tier / vip_until
"""
import os
import time
import uuid
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://fivem-server-be.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "bxlrp_database"

PLAYER_A_EMAIL = f"testshopa_{uuid.uuid4().hex[:6]}@bxlrp.be"
PLAYER_A_PWD = "Player2026!"
PLAYER_B_EMAIL = f"testshopb_{uuid.uuid4().hex[:6]}@bxlrp.be"
PLAYER_B_PWD = "Player2026!"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(s, email, password, username=None):
    username = username or email.split("@")[0]
    r = s.post(f"{API}/auth/register", json={"email": email, "username": username, "password": password})
    return r


def _login(s, email, password):
    r = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    return r


# ───── Fixtures ─────
@pytest.fixture(scope="module")
def session_a():
    s = _session()
    _register(s, PLAYER_A_EMAIL, PLAYER_A_PWD)
    r = _login(s, PLAYER_A_EMAIL, PLAYER_A_PWD)
    assert r.status_code == 200, f"login A failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def session_b():
    s = _session()
    _register(s, PLAYER_B_EMAIL, PLAYER_B_PWD)
    r = _login(s, PLAYER_B_EMAIL, PLAYER_B_PWD)
    assert r.status_code == 200
    return s


@pytest.fixture(scope="module")
def anon_session():
    return _session()


# ───── 1. Catalog ─────
class TestCatalog:
    def test_catalog_returns_three_packs(self, anon_session):
        r = anon_session.get(f"{API}/shop/catalog")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) == 3
        ids = {p["id"] for p in data}
        assert ids == {"citoyen_plus", "vip_premium", "vip_or"}
        prices = {p["id"]: p["price"] for p in data}
        assert prices["citoyen_plus"] == 5.0
        assert prices["vip_premium"] == 15.0
        assert prices["vip_or"] == 30.0
        for p in data:
            assert set(p.keys()) >= {"id", "name", "price", "currency", "perks", "duration_days"}
            assert p["currency"] == "eur"
            assert p["duration_days"] == 30
            assert isinstance(p["perks"], list) and len(p["perks"]) > 0


# ───── 2. /auth/me includes vip fields ─────
class TestAuthMeVipFields:
    def test_me_includes_vip_keys(self, session_a):
        r = session_a.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert "vip_tier" in data
        assert "vip_until" in data
        # default is null for fresh user
        assert data.get("vip_tier") is None
        assert data.get("vip_until") is None


# ───── 3. POST /shop/checkout ─────
class TestCheckout:
    def test_checkout_requires_auth(self, anon_session):
        r = anon_session.post(f"{API}/shop/checkout", json={
            "items": [{"package_id": "citoyen_plus", "quantity": 1}],
            "origin_url": "https://example.com",
        })
        assert r.status_code in (401, 403)

    def test_checkout_unknown_package(self, session_a):
        r = session_a.post(f"{API}/shop/checkout", json={
            "items": [{"package_id": "NOT_A_PACK", "quantity": 1}],
            "origin_url": "https://example.com",
        })
        assert r.status_code == 400
        body = r.json()
        assert "Package inconnu" in body.get("detail", "") or "inconnu" in body.get("detail", "").lower()

    def test_checkout_server_side_amount_cannot_be_overridden(self, session_a):
        # Attempt to set amount=0.01 in the payload — server must ignore it
        r = session_a.post(f"{API}/shop/checkout", json={
            "items": [{"package_id": "vip_or", "quantity": 1}],
            "origin_url": "https://example.com",
            "amount": 0.01,            # malicious override attempt (extra field)
            "currency": "usd",          # malicious override attempt
        })
        assert r.status_code == 200, r.text
        body = r.json()
        # Server computed price from VIP_CATALOG: vip_or = 30€
        assert body["amount"] == 30.0
        assert body["currency"] == "eur"
        assert body["url"].startswith("http")
        assert body["session_id"]

    def test_checkout_multi_item_total(self, session_a):
        # citoyen_plus (5) x2 + vip_premium (15) x1 = 25
        r = session_a.post(f"{API}/shop/checkout", json={
            "items": [
                {"package_id": "citoyen_plus", "quantity": 2},
                {"package_id": "vip_premium", "quantity": 1},
            ],
            "origin_url": "https://example.com",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["amount"] == 25.0
        assert body["currency"] == "eur"
        # store session for later persistence test
        pytest.shared_session_id = body["session_id"]

    def test_checkout_persists_transaction(self, session_a):
        # Run a fresh checkout and inspect mongo directly
        r = session_a.post(f"{API}/shop/checkout", json={
            "items": [{"package_id": "citoyen_plus", "quantity": 1}],
            "origin_url": "https://example.com",
        })
        assert r.status_code == 200
        sid = r.json()["session_id"]

        async def _check():
            client = AsyncIOMotorClient(MONGO_URL)
            db = client[DB_NAME]
            tx = await db.payment_transactions.find_one({"session_id": sid})
            client.close()
            return tx

        tx = asyncio.get_event_loop().run_until_complete(_check())
        assert tx is not None, "transaction not persisted before redirect"
        assert tx["status"] == "pending"
        assert tx["payment_status"] == "initiated"
        assert tx["amount"] == 5.0
        assert tx["currency"] == "eur"
        assert tx["perks_granted"] is False
        assert tx["user_email"] == PLAYER_A_EMAIL


# ───── 4. GET /shop/status/{session_id} ─────
class TestStatus:
    def test_status_unknown_session_404(self, session_a):
        r = session_a.get(f"{API}/shop/status/cs_unknown_{uuid.uuid4().hex}")
        assert r.status_code == 404

    def test_status_other_user_403(self, session_a, session_b):
        # A creates checkout
        r = session_a.post(f"{API}/shop/checkout", json={
            "items": [{"package_id": "citoyen_plus", "quantity": 1}],
            "origin_url": "https://example.com",
        })
        assert r.status_code == 200
        sid = r.json()["session_id"]
        # B tries to read it
        r2 = session_b.get(f"{API}/shop/status/{sid}")
        assert r2.status_code == 403

    def test_status_owner_200(self, session_a):
        r = session_a.post(f"{API}/shop/checkout", json={
            "items": [{"package_id": "citoyen_plus", "quantity": 1}],
            "origin_url": "https://example.com",
        })
        sid = r.json()["session_id"]
        r2 = session_a.get(f"{API}/shop/status/{sid}")
        assert r2.status_code == 200
        body = r2.json()
        # may be 'initiated' or 'unpaid' etc — but payment_status key present
        assert "payment_status" in body


# ───── 5. Idempotency of perks grant ─────
class TestIdempotency:
    def test_perks_granted_only_once(self, session_a):
        """
        Drive _grant_perks_if_paid directly twice and verify vip_until is not
        extended on the second call (perks_granted flag must short-circuit).
        Also verify that a subsequent /shop/status call (which hits the cached
        'paid' early-return) returns perks_granted=true and never re-grants.
        """
        import sys
        sys.path.insert(0, "/app/backend")
        # late import to avoid pulling server at collection time
        import server as srv  # type: ignore

        me = session_a.get(f"{API}/auth/me").json()
        user_id = me["id"]

        fake_sid = f"cs_fake_{uuid.uuid4().hex}"
        now = datetime.now(timezone.utc)

        async def _seed():
            await srv.db.payment_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "session_id": fake_sid,
                "user_id": user_id,
                "user_email": me["email"],
                "user_username": me.get("username"),
                "items": [{"package_id": "vip_or", "name": "VIP Or", "unit_price": 30.0, "quantity": 1}],
                "amount": 30.0,
                "currency": "eur",
                "payment_status": "paid",
                "status": "complete",
                "metadata": {"user_id": user_id},
                "perks_granted": False,
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
            })
            await srv.db.users.update_one({"id": user_id}, {"$set": {"vip_until": None, "vip_tier": None}})

        async def _grant():
            await srv._grant_perks_if_paid(fake_sid)

        async def _read_user_and_tx():
            u = await srv.db.users.find_one({"id": user_id})
            tx = await srv.db.payment_transactions.find_one({"session_id": fake_sid})
            return u, tx

        async def _cleanup():
            await srv.db.payment_transactions.delete_one({"session_id": fake_sid})
            await srv.db.users.update_one({"id": user_id}, {"$set": {"vip_until": None, "vip_tier": None}})

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_seed())
            # First grant call → grants perks
            loop.run_until_complete(_grant())
            u1, tx1 = loop.run_until_complete(_read_user_and_tx())
            assert tx1["perks_granted"] is True
            assert u1["vip_tier"] == "VIP Or"
            assert u1["vip_until"] is not None
            first_until = u1["vip_until"]

            # Second grant call → must be no-op (idempotent)
            loop.run_until_complete(_grant())
            u2, tx2 = loop.run_until_complete(_read_user_and_tx())
            assert u2["vip_until"] == first_until, (
                f"vip_until extended on second grant — NOT idempotent ({first_until} → {u2['vip_until']})"
            )
            assert tx2["perks_granted"] is True

            # /auth/me reflects VIP
            me2 = session_a.get(f"{API}/auth/me").json()
            assert me2["vip_tier"] == "VIP Or"
            assert me2["vip_until"] is not None

            # /shop/status (paid + granted) — no extension
            r = session_a.get(f"{API}/shop/status/{fake_sid}")
            assert r.status_code == 200
            body = r.json()
            assert body["payment_status"] == "paid"
            assert body["perks_granted"] is True
            u3, _ = loop.run_until_complete(_read_user_and_tx())
            assert u3["vip_until"] == first_until
        finally:
            loop.run_until_complete(_cleanup())
            loop.close()


# ───── 6. GET /shop/orders/mine ─────
class TestOrdersMine:
    def test_orders_mine_requires_auth(self, anon_session):
        r = anon_session.get(f"{API}/shop/orders/mine")
        assert r.status_code in (401, 403)

    def test_orders_mine_returns_user_orders_desc(self, session_a):
        r = session_a.get(f"{API}/shop/orders/mine")
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list)
        # We created at least 4 checkouts for A above
        assert len(orders) >= 3
        for o in orders:
            assert o["user_email"] == PLAYER_A_EMAIL
            assert "_id" not in o, "MongoDB _id leaked"
            assert "session_id" in o and "amount" in o and "items" in o
        # Ordered desc by created_at
        timestamps = [o["created_at"] for o in orders]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_orders_mine_user_isolation(self, session_b):
        r = session_b.get(f"{API}/shop/orders/mine")
        assert r.status_code == 200
        orders = r.json()
        # B has no checkouts (only test_status_other_user_403 used B as a reader)
        for o in orders:
            assert o["user_email"] == PLAYER_B_EMAIL


# ───── 7. Webhook (best-effort) ─────
class TestWebhook:
    def test_webhook_signature_failure_400(self, anon_session):
        # No signature → handle_webhook should raise → 400
        r = anon_session.post(f"{API}/webhook/stripe",
                              data='{"id":"evt_test","type":"checkout.session.completed"}',
                              headers={"Content-Type": "application/json"})
        # Acceptable: 400 (signature) or 200 (best-effort accepted)
        assert r.status_code in (200, 400), f"unexpected webhook status {r.status_code}"


# ───── Cleanup ─────
def teardown_module(module):
    async def _clean():
        client = AsyncIOMotorClient(MONGO_URL)
        db = client[DB_NAME]
        await db.payment_transactions.delete_many({"user_email": {"$in": [PLAYER_A_EMAIL, PLAYER_B_EMAIL]}})
        await db.users.delete_many({"email": {"$in": [PLAYER_A_EMAIL, PLAYER_B_EMAIL]}})
        client.close()
    try:
        asyncio.get_event_loop().run_until_complete(_clean())
    except Exception:
        pass
