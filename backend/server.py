from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import bcrypt
import jwt
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

try:
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest, CheckoutSessionResponse, CheckoutStatusResponse,
    )
    STRIPE_AVAILABLE = True
except ImportError:
    STRIPE_AVAILABLE = False
    StripeCheckout = CheckoutSessionRequest = CheckoutSessionResponse = CheckoutStatusResponse = None


# ───────── Mongo
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ───────── App
app = FastAPI(title="BXL-RP API")
api_router = APIRouter(prefix="/api")

JWT_ALGORITHM = "HS256"


# ───────── Helpers
def _now():
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": _now() + timedelta(minutes=60 * 24),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": _now() + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=86400, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=604800, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token invalide")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Utilisateur introuvable")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expirée")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalide")


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return user


# ───────── Permissions
ALL_PERMS = [
    "manage_news",
    "manage_whitelist",
    "manage_server_settings",
    "manage_entreprises",
    "manage_business",
    "manage_users",
    "manage_admins",
    "view_audit",
]


def user_has_perm(user: dict, perm: str) -> bool:
    if user.get("role") != "admin":
        return False
    perms = user.get("permissions") or []
    return user.get("is_super_admin") is True or "*" in perms or perm in perms


def require_perm(perm: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Accès administrateur requis")
        if not user_has_perm(user, perm):
            raise HTTPException(status_code=403, detail=f"Permission requise : {perm}")
        return user
    return dep


async def audit_log(admin: dict, action: str, target_type: str = None, target_id: str = None,
                    target_label: str = None, metadata: dict = None):
    try:
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "admin_id": admin.get("id"),
            "admin_username": admin.get("username"),
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "target_label": target_label,
            "metadata": metadata or {},
            "created_at": _now().isoformat(),
        })
    except Exception as e:
        logging.getLogger(__name__).warning("Audit log failed: %s", e)


# ───────── Discord bot role helper
async def discord_assign_role(discord_user_id: str) -> bool:
    """Assign the whitelist role to a Discord user. Returns True if succeeded."""
    token = os.environ.get("DISCORD_BOT_TOKEN", "").strip()
    guild = os.environ.get("DISCORD_GUILD_ID", "").strip()
    role = os.environ.get("DISCORD_WL_ROLE_ID", "").strip()
    if not (token and guild and role and discord_user_id):
        return False
    try:
        async with httpx.AsyncClient(timeout=8.0) as cli:
            r = await cli.put(
                f"https://discord.com/api/v10/guilds/{guild}/members/{discord_user_id}/roles/{role}",
                headers={"Authorization": f"Bot {token}"},
            )
            if r.status_code in (204, 200):
                return True
            logging.getLogger(__name__).warning("Discord role assign failed (%s): %s", r.status_code, r.text[:200])
            return False
    except Exception as e:
        logging.getLogger(__name__).warning("Discord role assign exception: %s", e)
        return False


# ───────── Models
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    username: str = Field(min_length=3, max_length=32)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    username: str
    role: str
    created_at: datetime
    vip_tier: Optional[str] = None
    vip_until: Optional[str] = None


class NewsIn(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    excerpt: str = Field(min_length=2, max_length=300)
    content: str = Field(min_length=2)
    category: str = "Général"
    image_url: Optional[str] = None


class News(BaseModel):
    id: str
    title: str
    excerpt: str
    content: str
    category: str
    image_url: Optional[str] = None
    author: str
    created_at: datetime


class ApplicationIn(BaseModel):
    character_name: str = Field(min_length=2, max_length=64)
    age: int = Field(ge=15, le=99)
    discord_id: Optional[str] = Field(default=None, max_length=32, description="Discord user ID for auto WL role")
    background: str = Field(min_length=20, max_length=4000)
    rp_experience: str = Field(min_length=10, max_length=2000)
    why_join: str = Field(min_length=10, max_length=2000)


class Application(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    email: str
    character_name: str
    age: int
    discord_id: Optional[str] = None
    background: str
    rp_experience: str
    why_join: str
    status: Literal["pending", "approved", "rejected"]
    admin_note: Optional[str] = None
    reviewed_by: Optional[str] = None
    discord_role_given: Optional[bool] = None
    created_at: datetime


class ApplicationReview(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: Optional[str] = None


class AdminCreateIn(BaseModel):
    email: EmailStr
    username: str = Field(min_length=3, max_length=32)
    password: str = Field(min_length=6, max_length=128)
    permissions: List[str] = Field(default_factory=list)


class AdminPermsUpdate(BaseModel):
    permissions: List[str]


class BusinessApplicationIn(BaseModel):
    faction_key: str = Field(min_length=2, max_length=32)
    faction_name: str = Field(min_length=2, max_length=64)
    position: str = Field(min_length=2, max_length=64)
    discord_id: Optional[str] = Field(default=None, max_length=32)
    motivation: str = Field(min_length=10, max_length=4000)


class BusinessReview(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: Optional[str] = None


class FactionIn(BaseModel):
    key: str = Field(min_length=2, max_length=32, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(min_length=2, max_length=64)
    category: str = Field(min_length=2, max_length=32)
    description: str = Field(min_length=2, max_length=2000)
    color: str = Field(default="#E4B823", max_length=16)
    icon_key: str = Field(default="briefcase", max_length=24)
    image_url: Optional[str] = Field(default=None, max_length=500)
    positions: List[str] = Field(default_factory=list)
    slots_max: Optional[int] = Field(default=None, ge=0, le=999)
    is_whitelist: bool = True


class FactionUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=64)
    category: Optional[str] = Field(default=None, max_length=32)
    description: Optional[str] = Field(default=None, max_length=2000)
    color: Optional[str] = Field(default=None, max_length=16)
    icon_key: Optional[str] = Field(default=None, max_length=24)
    image_url: Optional[str] = Field(default=None, max_length=500)
    positions: Optional[List[str]] = None
    slots_max: Optional[int] = Field(default=None, ge=0, le=999)


class RecruitmentToggle(BaseModel):
    recruitment_open: bool


class FactionOwnerSet(BaseModel):
    user_id: Optional[str] = None  # set to None to remove owner


class CharacterProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    username: str
    character_name: Optional[str] = None
    photo_url: Optional[str] = None
    profession: Optional[str] = None
    faction: Optional[str] = None
    address: Optional[str] = None
    phone_ic: Optional[str] = None
    status: Literal["vivant", "en_fuite", "decede", "inconnu"] = "vivant"
    criminal_record: Optional[str] = None
    biography: Optional[str] = None
    skills: Optional[str] = None
    date_of_birth_ic: Optional[str] = None
    is_public: bool = True
    updated_at: datetime


class ProfileIn(BaseModel):
    character_name: Optional[str] = Field(default=None, max_length=64)
    photo_url: Optional[str] = Field(default=None, max_length=500)
    profession: Optional[str] = Field(default=None, max_length=100)
    faction: Optional[str] = Field(default=None, max_length=100)
    address: Optional[str] = Field(default=None, max_length=200)
    phone_ic: Optional[str] = Field(default=None, max_length=30)
    status: Optional[Literal["vivant", "en_fuite", "decede", "inconnu"]] = None
    criminal_record: Optional[str] = Field(default=None, max_length=2000)
    biography: Optional[str] = Field(default=None, max_length=5000)
    skills: Optional[str] = Field(default=None, max_length=1000)
    date_of_birth_ic: Optional[str] = Field(default=None, max_length=20)
    is_public: Optional[bool] = None


# ───────── Discord Webhook
async def send_discord_webhook(embed: dict):
    url = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as cli:
            await cli.post(url, json={"embeds": [embed]})
    except Exception as e:
        logging.getLogger(__name__).warning("Discord webhook failed: %s", e)



# ───────── Auth routes
@api_router.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=400, detail="Ce pseudo est déjà pris")

    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "role": "player",
        "created_at": _now().isoformat(),
    }
    await db.users.insert_one(doc)

    access = create_access_token(user_id, email, "player")
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)

    return {
        "id": user_id, "email": email, "username": payload.username, "role": "player",
        "created_at": doc["created_at"],
        "access_token": access,
    }


@api_router.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")

    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)

    return {
        "id": user["id"], "email": user["email"], "username": user["username"], "role": user["role"],
        "created_at": user["created_at"],
        "access_token": access,
    }


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return UserOut(
        id=user["id"], email=user["email"], username=user["username"], role=user["role"],
        created_at=datetime.fromisoformat(user["created_at"]) if isinstance(user["created_at"], str) else user["created_at"],
        vip_tier=user.get("vip_tier"),
        vip_until=user.get("vip_until"),
    )


# ───────── Public info
@api_router.get("/server/info")
async def server_info():
    # Count of approved applications = whitelisted players (mock player count)
    approved = await db.applications.count_documents({"status": "approved"})
    total_users = await db.users.count_documents({})
    pending = await db.applications.count_documents({"status": "pending"})
    return {
        "name": "Bruxelles RôlePlay",
        "tag": "BXL-RP",
        "country": "Belgique",
        "connect": os.environ.get("SERVER_CONNECT", "connect cfx.re/join/mxlqy9"),
        "discord": os.environ.get("DISCORD_INVITE", "https://discord.gg/bxrp"),
        "founded": "2026",
        "max_slots": 128,
        "players_online": min(approved + 12, 128),
        "whitelisted": approved,
        "members": total_users,
        "pending_apps": pending,
        "uptime": "99.8%",
    }


# ───────── News routes
@api_router.get("/news", response_model=List[News])
async def list_news():
    items = await db.news.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for n in items:
        if isinstance(n["created_at"], str):
            n["created_at"] = datetime.fromisoformat(n["created_at"])
    return items


@api_router.post("/news", response_model=News)
async def create_news(payload: NewsIn, admin: dict = Depends(require_perm("manage_news"))):
    nid = str(uuid.uuid4())
    doc = {
        "id": nid,
        "title": payload.title,
        "excerpt": payload.excerpt,
        "content": payload.content,
        "category": payload.category,
        "image_url": payload.image_url,
        "author": admin["username"],
        "created_at": _now().isoformat(),
    }
    await db.news.insert_one(doc)
    await audit_log(admin, "news_created", "news", nid, payload.title)
    out = {**doc, "created_at": datetime.fromisoformat(doc["created_at"])}
    out.pop("_id", None)
    return out


@api_router.delete("/news/{news_id}")
async def delete_news(news_id: str, admin: dict = Depends(require_perm("manage_news"))):
    n = await db.news.find_one({"id": news_id})
    res = await db.news.delete_one({"id": news_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Actualité introuvable")
    await audit_log(admin, "news_deleted", "news", news_id, (n or {}).get("title"))
    return {"ok": True}


# ───────── Whitelist applications
@api_router.post("/applications", response_model=Application)
async def submit_application(payload: ApplicationIn, user: dict = Depends(get_current_user)):
    existing = await db.applications.find_one({"user_id": user["id"], "status": "pending"})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà une candidature en attente")

    aid = str(uuid.uuid4())
    doc = {
        "id": aid,
        "user_id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "character_name": payload.character_name,
        "age": payload.age,
        "discord_id": payload.discord_id,
        "background": payload.background,
        "rp_experience": payload.rp_experience,
        "why_join": payload.why_join,
        "status": "pending",
        "admin_note": None,
        "reviewed_by": None,
        "discord_role_given": None,
        "created_at": _now().isoformat(),
    }
    await db.applications.insert_one(doc)

    # Discord notification
    await send_discord_webhook({
        "title": "📋 Nouvelle candidature whitelist",
        "description": f"**{payload.character_name}** ({payload.age} ans) — par `{user['username']}`",
        "color": 0xE4B823,
        "fields": [
            {"name": "Background", "value": (payload.background[:300] + "...") if len(payload.background) > 300 else payload.background, "inline": False},
            {"name": "Expérience RP", "value": (payload.rp_experience[:200] + "...") if len(payload.rp_experience) > 200 else payload.rp_experience, "inline": False},
            {"name": "Email", "value": user["email"], "inline": True},
            {"name": "Discord ID", "value": payload.discord_id or "non fourni", "inline": True},
        ],
        "footer": {"text": "BXL-RP · Système de candidature"},
        "timestamp": _now().isoformat(),
    })

    out = {**doc, "created_at": datetime.fromisoformat(doc["created_at"])}
    out.pop("_id", None)
    return out


@api_router.get("/applications/mine", response_model=List[Application])
async def my_applications(user: dict = Depends(get_current_user)):
    items = await db.applications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    for a in items:
        if isinstance(a["created_at"], str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
    return items


@api_router.get("/applications", response_model=List[Application])
async def list_applications(admin: dict = Depends(require_perm("manage_whitelist"))):
    items = await db.applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for a in items:
        if isinstance(a["created_at"], str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
    return items


@api_router.patch("/applications/{app_id}", response_model=Application)
async def review_application(app_id: str, payload: ApplicationReview, admin: dict = Depends(require_perm("manage_whitelist"))):
    app_doc = await db.applications.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")

    update = {"status": payload.status, "admin_note": payload.admin_note, "reviewed_by": admin["username"]}

    # Try to assign Discord WL role on approval
    role_given = None
    if payload.status == "approved" and app_doc.get("discord_id"):
        role_given = await discord_assign_role(app_doc["discord_id"])
        update["discord_role_given"] = role_given

    await db.applications.update_one({"id": app_id}, {"$set": update})
    res = await db.applications.find_one({"id": app_id}, {"_id": 0})
    if isinstance(res["created_at"], str):
        res["created_at"] = datetime.fromisoformat(res["created_at"])

    # Audit log
    await audit_log(admin, f"app_{payload.status}", "application", app_id, res["character_name"],
                    {"note": payload.admin_note, "discord_role_given": role_given})

    # Discord notification on review
    color = 0x10B981 if payload.status == "approved" else 0xDC2626
    emoji = "✅" if payload.status == "approved" else "❌"
    fields = [
        {"name": "Statut", "value": payload.status, "inline": True},
        {"name": "Reviewé par", "value": admin["username"], "inline": True},
    ]
    if role_given is True:
        fields.append({"name": "Rôle Discord", "value": "✅ Attribué", "inline": True})
    elif payload.status == "approved" and app_doc.get("discord_id") and role_given is False:
        fields.append({"name": "Rôle Discord", "value": "⚠️ Échec (vérifier bot)", "inline": True})
    if payload.admin_note:
        fields.append({"name": "Note admin", "value": payload.admin_note, "inline": False})
    await send_discord_webhook({
        "title": f"{emoji} Candidature {payload.status}",
        "description": f"**{res['character_name']}** — `{res['username']}`",
        "color": color,
        "fields": fields,
        "footer": {"text": "BXL-RP · Review staff"},
        "timestamp": _now().isoformat(),
    })

    return res


@api_router.delete("/applications/{app_id}")
async def delete_application(app_id: str, admin: dict = Depends(require_perm("manage_whitelist"))):
    app_doc = await db.applications.find_one({"id": app_id})
    if not app_doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    if app_doc.get("status") == "pending":
        raise HTTPException(status_code=400, detail="Impossible de supprimer une candidature en attente. Approuvez-la ou refusez-la d'abord.")
    await db.applications.delete_one({"id": app_id})
    await audit_log(admin, "app_deleted", "application", app_id, app_doc.get("character_name"),
                    {"status_was": app_doc.get("status")})
    return {"ok": True}


# ───────── Character Profile
def _profile_defaults(user: dict) -> dict:
    return {
        "user_id": user["id"],
        "username": user["username"],
        "character_name": None,
        "photo_url": None,
        "profession": None,
        "faction": None,
        "address": None,
        "phone_ic": None,
        "status": "vivant",
        "criminal_record": None,
        "biography": None,
        "skills": None,
        "date_of_birth_ic": None,
        "is_public": True,
        "updated_at": _now().isoformat(),
    }


def _serialize_profile(p: dict) -> dict:
    p.pop("_id", None)
    if isinstance(p.get("updated_at"), str):
        p["updated_at"] = datetime.fromisoformat(p["updated_at"])
    return p


@api_router.get("/profiles/me", response_model=CharacterProfile)
async def get_my_profile(user: dict = Depends(get_current_user)):
    p = await db.profiles.find_one({"user_id": user["id"]})
    if not p:
        p = _profile_defaults(user)
        await db.profiles.insert_one(p.copy())
    return _serialize_profile(p)


@api_router.put("/profiles/me", response_model=CharacterProfile)
async def update_my_profile(payload: ProfileIn, user: dict = Depends(get_current_user)):
    existing = await db.profiles.find_one({"user_id": user["id"]})
    if not existing:
        existing = _profile_defaults(user)
        await db.profiles.insert_one(existing.copy())

    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    update["updated_at"] = _now().isoformat()
    update["username"] = user["username"]
    await db.profiles.update_one({"user_id": user["id"]}, {"$set": update})
    p = await db.profiles.find_one({"user_id": user["id"]})
    return _serialize_profile(p)


@api_router.get("/profiles")
async def list_profiles():
    items = await db.profiles.find({"is_public": True}, {"_id": 0}).sort("updated_at", -1).to_list(500)
    for p in items:
        if isinstance(p.get("updated_at"), str):
            p["updated_at"] = datetime.fromisoformat(p["updated_at"])
    return items


@api_router.get("/profiles/{username}", response_model=CharacterProfile)
async def get_profile_by_username(username: str):
    p = await db.profiles.find_one({"username": username})
    if not p:
        raise HTTPException(status_code=404, detail="Profil introuvable")
    if not p.get("is_public", True):
        raise HTTPException(status_code=403, detail="Ce profil est privé")
    return _serialize_profile(p)


# ───────── Admin user list
@api_router.get("/admin/users")
async def list_users(admin: dict = Depends(require_perm("manage_users"))):
    items = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    for u in items:
        if isinstance(u.get("created_at"), str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return items


@api_router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str, admin: dict = Depends(require_perm("manage_users"))):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")
    if u.get("id") == admin.get("id"):
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous supprimer vous-même")
    if u.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Impossible de supprimer le super-administrateur")
    await db.users.delete_one({"id": user_id})
    await db.profiles.delete_many({"user_id": user_id})
    await db.applications.delete_many({"user_id": user_id})
    await db.business_applications.delete_many({"user_id": user_id})
    await audit_log(admin, "user_deleted", "user", user_id, u.get("username"),
                    {"email": u.get("email"), "role_was": u.get("role")})
    return {"ok": True}


# ───────── Admin management (create / update perms)
@api_router.get("/admin/admins")
async def list_admins(admin: dict = Depends(require_perm("manage_admins"))):
    items = await db.users.find({"role": "admin"}, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(200)
    for u in items:
        if isinstance(u.get("created_at"), str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return {"admins": items, "all_perms": ALL_PERMS}


@api_router.post("/admin/admins")
async def create_admin(payload: AdminCreateIn, admin: dict = Depends(require_perm("manage_admins"))):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=400, detail="Ce pseudo est déjà pris")
    perms = [p for p in payload.permissions if p in ALL_PERMS]
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "id": uid,
        "email": email,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "role": "admin",
        "permissions": perms,
        "is_super_admin": False,
        "created_at": _now().isoformat(),
    })
    await audit_log(admin, "admin_created", "user", uid, payload.username, {"permissions": perms})
    return {"ok": True, "id": uid}


@api_router.patch("/admin/admins/{user_id}")
async def update_admin_perms(user_id: str, payload: AdminPermsUpdate, admin: dict = Depends(require_perm("manage_admins"))):
    target = await db.users.find_one({"id": user_id})
    if not target or target.get("role") != "admin":
        raise HTTPException(status_code=404, detail="Administrateur introuvable")
    if target.get("is_super_admin"):
        raise HTTPException(status_code=400, detail="Impossible de modifier le super-administrateur")
    perms = [p for p in payload.permissions if p in ALL_PERMS]
    await db.users.update_one({"id": user_id}, {"$set": {"permissions": perms}})
    await audit_log(admin, "admin_perms_updated", "user", user_id, target.get("username"), {"permissions": perms})
    return {"ok": True, "permissions": perms}


# ───────── Business (faction) applications
@api_router.post("/business-applications")
async def submit_business_app(payload: BusinessApplicationIn, user: dict = Depends(get_current_user)):
    # Verify faction & recruitment open
    faction = await db.factions.find_one({"key": payload.faction_key})
    if faction:
        if not faction.get("recruitment_open", True):
            raise HTTPException(status_code=400, detail="Le recrutement est actuellement fermé pour cette entreprise")

    existing = await db.business_applications.find_one({
        "user_id": user["id"], "faction_key": payload.faction_key, "status": "pending"
    })
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà une candidature en attente pour cette faction")

    bid = str(uuid.uuid4())
    doc = {
        "id": bid,
        "user_id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "faction_key": payload.faction_key,
        "faction_name": payload.faction_name,
        "position": payload.position,
        "discord_id": payload.discord_id,
        "motivation": payload.motivation,
        "status": "pending",
        "admin_note": None,
        "reviewed_by": None,
        "created_at": _now().isoformat(),
    }
    await db.business_applications.insert_one(doc)

    await send_discord_webhook({
        "title": "💼 Nouvelle candidature entreprise",
        "description": f"**{payload.faction_name}** — poste : `{payload.position}`",
        "color": 0x3B82F6,
        "fields": [
            {"name": "Candidat", "value": user["username"], "inline": True},
            {"name": "Email", "value": user["email"], "inline": True},
            {"name": "Motivation", "value": (payload.motivation[:400] + "...") if len(payload.motivation) > 400 else payload.motivation, "inline": False},
        ],
        "footer": {"text": "BXL-RP · Candidature entreprise"},
        "timestamp": _now().isoformat(),
    })

    out = {**doc}
    out.pop("_id", None)
    return out


@api_router.get("/business-applications/mine")
async def my_business_apps(user: dict = Depends(get_current_user)):
    items = await db.business_applications.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items


@api_router.get("/business-applications")
async def list_business_apps(user: dict = Depends(get_current_user)):
    """Admins (manage_business) see all. Patrons see their faction(s) apps."""
    if user_has_perm(user, "manage_business"):
        items = await db.business_applications.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
        return items
    owned = await db.factions.find({"owner_user_id": user["id"]}, {"_id": 0, "key": 1}).to_list(50)
    keys = [f["key"] for f in owned]
    if not keys:
        raise HTTPException(status_code=403, detail="Vous n'êtes patron d'aucune entreprise")
    items = await db.business_applications.find({"faction_key": {"$in": keys}}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items


@api_router.patch("/business-applications/{app_id}")
async def review_business_app(app_id: str, payload: BusinessReview, user: dict = Depends(get_current_user)):
    doc = await db.business_applications.find_one({"id": app_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    # Authorization: admin OR patron of faction
    if not user_has_perm(user, "manage_business"):
        faction = await db.factions.find_one({"key": doc["faction_key"]})
        if not faction or faction.get("owner_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas patron de cette entreprise")

    await db.business_applications.update_one({"id": app_id},
        {"$set": {"status": payload.status, "admin_note": payload.admin_note, "reviewed_by": user["username"]}})
    res = await db.business_applications.find_one({"id": app_id}, {"_id": 0})
    await audit_log(user, f"business_{payload.status}", "business_application", app_id,
                    f"{doc.get('faction_name')} / {doc.get('position')}", {"note": payload.admin_note})
    return res


@api_router.delete("/business-applications/{app_id}")
async def delete_business_app(app_id: str, user: dict = Depends(get_current_user)):
    doc = await db.business_applications.find_one({"id": app_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Candidature introuvable")
    if not user_has_perm(user, "manage_business"):
        faction = await db.factions.find_one({"key": doc["faction_key"]})
        if not faction or faction.get("owner_user_id") != user["id"]:
            raise HTTPException(status_code=403, detail="Vous n'êtes pas patron de cette entreprise")
    if doc.get("status") == "pending":
        raise HTTPException(status_code=400, detail="Approuvez ou refusez d'abord la candidature")
    await db.business_applications.delete_one({"id": app_id})
    await audit_log(user, "business_deleted", "business_application", app_id,
                    f"{doc.get('faction_name')} / {doc.get('position')}", {"status_was": doc.get("status")})
    return {"ok": True}


# ───────── Factions
def _serialize_faction(f: dict) -> dict:
    f.pop("_id", None)
    for k in ("created_at", "updated_at"):
        if isinstance(f.get(k), str):
            f[k] = datetime.fromisoformat(f[k])
    return f


async def _faction_or_404(key: str) -> dict:
    f = await db.factions.find_one({"key": key})
    if not f:
        raise HTTPException(status_code=404, detail="Faction introuvable")
    return f


def _can_manage_faction(user: dict, faction: dict) -> bool:
    if user_has_perm(user, "manage_business"):
        return True
    return faction.get("owner_user_id") == user.get("id")


@api_router.get("/factions")
async def list_factions():
    items = await db.factions.find({}, {"_id": 0}).sort("name", 1).to_list(200)
    out = []
    for f in items:
        out.append({
            **f,
            "owner_username": (await db.users.find_one({"id": f["owner_user_id"]}, {"_id": 0, "username": 1}) or {}).get("username")
                              if f.get("owner_user_id") else None,
        })
    for f in out:
        for k in ("created_at", "updated_at"):
            if isinstance(f.get(k), str):
                f[k] = datetime.fromisoformat(f[k])
    return out


@api_router.get("/factions/mine")
async def my_factions(user: dict = Depends(get_current_user)):
    items = await db.factions.find({"owner_user_id": user["id"]}, {"_id": 0}).to_list(50)
    for f in items:
        for k in ("created_at", "updated_at"):
            if isinstance(f.get(k), str):
                f[k] = datetime.fromisoformat(f[k])
    return items


@api_router.get("/factions/{key}")
async def get_faction(key: str):
    f = await _faction_or_404(key)
    owner = None
    if f.get("owner_user_id"):
        owner_doc = await db.users.find_one({"id": f["owner_user_id"]}, {"_id": 0, "username": 1})
        owner = owner_doc.get("username") if owner_doc else None
    f = _serialize_faction(f)
    f["owner_username"] = owner
    return f


@api_router.post("/factions")
async def create_faction(payload: FactionIn, admin: dict = Depends(require_perm("manage_entreprises"))):
    if await db.factions.find_one({"key": payload.key}):
        raise HTTPException(status_code=400, detail="Une faction avec cette clé existe déjà")
    doc = {
        **payload.model_dump(),
        "id": str(uuid.uuid4()),
        "owner_user_id": None,
        "recruitment_open": True,
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    }
    await db.factions.insert_one(doc)
    await audit_log(admin, "faction_created", "faction", payload.key, payload.name)
    return _serialize_faction(doc)


@api_router.patch("/factions/{key}")
async def update_faction(key: str, payload: FactionUpdate, user: dict = Depends(get_current_user)):
    f = await _faction_or_404(key)
    if not _can_manage_faction(user, f) and not user_has_perm(user, "manage_entreprises"):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas patron de cette entreprise")
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if update:
        update["updated_at"] = _now().isoformat()
        await db.factions.update_one({"key": key}, {"$set": update})
    res = await _faction_or_404(key)
    await audit_log(user, "faction_updated", "faction", key, f.get("name"), {"fields": list(update.keys())})
    return _serialize_faction(res)


@api_router.patch("/factions/{key}/recruitment")
async def toggle_recruitment(key: str, payload: RecruitmentToggle, user: dict = Depends(get_current_user)):
    f = await _faction_or_404(key)
    if not _can_manage_faction(user, f) and not user_has_perm(user, "manage_entreprises"):
        raise HTTPException(status_code=403, detail="Vous n'êtes pas patron de cette entreprise")
    await db.factions.update_one({"key": key},
        {"$set": {"recruitment_open": payload.recruitment_open, "updated_at": _now().isoformat()}})
    await audit_log(user, "recruitment_toggled", "faction", key, f.get("name"),
                    {"open": payload.recruitment_open})
    return {"ok": True, "recruitment_open": payload.recruitment_open}


@api_router.delete("/factions/{key}")
async def delete_faction(key: str, admin: dict = Depends(require_perm("manage_entreprises"))):
    f = await _faction_or_404(key)
    await db.factions.delete_one({"key": key})
    await db.business_applications.delete_many({"faction_key": key})
    await audit_log(admin, "faction_deleted", "faction", key, f.get("name"))
    return {"ok": True}


@api_router.post("/admin/factions/{key}/owner")
async def set_faction_owner(key: str, payload: FactionOwnerSet, admin: dict = Depends(require_perm("manage_entreprises"))):
    f = await _faction_or_404(key)
    target_username = None
    if payload.user_id:
        target = await db.users.find_one({"id": payload.user_id})
        if not target:
            raise HTTPException(status_code=404, detail="Utilisateur introuvable")
        target_username = target.get("username")
    await db.factions.update_one({"key": key},
        {"$set": {"owner_user_id": payload.user_id, "updated_at": _now().isoformat()}})
    await audit_log(admin, "faction_owner_set", "faction", key, f.get("name"),
                    {"owner_user_id": payload.user_id, "owner_username": target_username})
    return {"ok": True, "owner_user_id": payload.user_id, "owner_username": target_username}


# ───────── Stripe / Boutique
VIP_CATALOG = {
    "citoyen_plus": {
        "id": "citoyen_plus",
        "name": "Citoyen+",
        "price": 5.00,
        "currency": "eur",
        "perks": ["Priorité de connexion", "Skin custom du mois", "Badge Discord", "1 véhicule supplémentaire"],
        "duration_days": 30,
    },
    "vip_premium": {
        "id": "vip_premium",
        "name": "VIP Premium",
        "price": 15.00,
        "currency": "eur",
        "perks": ["Tout Citoyen+", "Garage agrandi (5 véhicules)", "Téléphone VIP exclusif", "Tatouages premium", "Queue prioritaire"],
        "duration_days": 30,
    },
    "vip_or": {
        "id": "vip_or",
        "name": "VIP Or",
        "price": 30.00,
        "currency": "eur",
        "perks": ["Tout VIP Premium", "Maison personnalisée", "Plaque immatriculation custom", "Vêtements exclusifs", "Support 1-on-1 staff"],
        "duration_days": 30,
    },
}


class CartItemIn(BaseModel):
    package_id: str
    quantity: int = Field(ge=1, le=10, default=1)


class CheckoutIn(BaseModel):
    items: List[CartItemIn] = Field(min_length=1, max_length=10)
    origin_url: Optional[str] = Field(default=None, max_length=200)


class ShopSettingsUpdate(BaseModel):
    purchases_enabled: Optional[bool] = None
    disabled_message: Optional[str] = Field(default=None, max_length=500)
    discord_ticket_url: Optional[str] = Field(default=None, max_length=300)




# ───────── Server Settings (WL toggle, etc.)
@api_router.get("/server/settings")
async def get_server_settings():
    doc = await db.server_settings.find_one({"_id": "global"})
    if not doc:
        doc = {"whitelist_open": True, "wl_mode": "wl"}
    doc.pop("_id", None)
    return doc

@api_router.patch("/server/settings")
async def update_server_settings(payload: dict, admin: dict = Depends(require_perm("manage_server_settings"))):
    allowed = {k: v for k, v in payload.items() if k in ("whitelist_open", "wl_mode")}
    await db.server_settings.update_one({"_id": "global"}, {"$set": allowed}, upsert=True)
    await audit_log(admin, "server_settings_updated", "server", "global", "paramètres serveur", allowed)
    doc = await db.server_settings.find_one({"_id": "global"})
    doc.pop("_id", None)
    return doc


# ───────── Règlement CRUD
@api_router.get("/rules")
async def get_rules():
    doc = await db.rules.find_one({"_id": "global"})
    if not doc:
        return {"categories": []}
    doc.pop("_id", None)
    return doc

@api_router.put("/rules")
async def update_rules(payload: dict, admin: dict = Depends(require_perm("manage_news"))):
    categories = payload.get("categories", [])
    await db.rules.update_one({"_id": "global"}, {"$set": {"categories": categories}}, upsert=True)
    await audit_log(admin, "rules_updated", "rules", "global", "règlement")
    return {"categories": categories}


# ───────── Faction CRUD (admin) - delete already defined above


def _validate_http_url(url: Optional[str]) -> Optional[str]:
    if url is None:
        return None
    url = url.strip()
    if not url:
        return None
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(status_code=400, detail="L'URL doit commencer par http:// ou https://")
    return url


# Tier ranking — higher = better VIP tier
TIER_RANK = {"citoyen_plus": 1, "vip_premium": 2, "vip_or": 3}


async def _get_shop_settings() -> dict:
    doc = await db.shop_settings.find_one({"_id": "global"})
    if not doc:
        doc = {
            "_id": "global",
            "purchases_enabled": True,
            "disabled_message": "La boutique est temporairement indisponible. Ouvre un ticket Discord pour acheter ton pack VIP manuellement.",
            "discord_ticket_url": os.environ.get("DISCORD_INVITE", "https://discord.gg/bxrp"),
        }
        await db.shop_settings.insert_one(doc.copy())
    return {
        "purchases_enabled": doc.get("purchases_enabled", True),
        "disabled_message": doc.get("disabled_message", ""),
        "discord_ticket_url": doc.get("discord_ticket_url", ""),
    }


def get_stripe_checkout(request: Request) -> StripeCheckout:
    if not STRIPE_AVAILABLE:
        raise HTTPException(status_code=503, detail="Paiement Stripe non disponible sur ce déploiement")
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Stripe non configuré")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    return StripeCheckout(api_key=api_key, webhook_url=webhook_url)


@api_router.get("/shop/catalog")
async def shop_catalog():
    return list(VIP_CATALOG.values())


@api_router.get("/shop/settings")
async def get_shop_settings():
    return await _get_shop_settings()


@api_router.patch("/shop/settings")
async def update_shop_settings(payload: ShopSettingsUpdate, admin: dict = Depends(require_perm("manage_business"))):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if "discord_ticket_url" in update:
        update["discord_ticket_url"] = _validate_http_url(update["discord_ticket_url"])
    if not update:
        return await _get_shop_settings()
    await db.shop_settings.update_one({"_id": "global"}, {"$set": update}, upsert=True)
    res = await _get_shop_settings()
    await audit_log(admin, "shop_settings_updated", "shop", "global", None, {"fields": list(update.keys()), "purchases_enabled": res.get("purchases_enabled")})
    return res


@api_router.post("/shop/checkout")
async def shop_checkout(payload: CheckoutIn, http_request: Request, user: dict = Depends(get_current_user)):
    # Check global shop status
    settings = await _get_shop_settings()
    if not settings["purchases_enabled"]:
        raise HTTPException(status_code=400, detail=settings.get("disabled_message") or "Boutique indisponible")
    # Validate items + compute total server-side
    total = 0.0
    currency = "eur"
    line_summary = []
    for it in payload.items:
        pkg = VIP_CATALOG.get(it.package_id)
        if not pkg:
            raise HTTPException(status_code=400, detail=f"Package inconnu : {it.package_id}")
        total += pkg["price"] * it.quantity
        line_summary.append({"package_id": pkg["id"], "name": pkg["name"], "unit_price": pkg["price"], "quantity": it.quantity})
    total = round(total, 2)
    if total <= 0:
        raise HTTPException(status_code=400, detail="Montant invalide")

    origin = (os.environ.get("FRONTEND_URL") or "").rstrip("/")
    if not origin:
        # Fallback to client-provided only if no server config
        origin = (payload.origin_url or "").rstrip("/")
    if not origin:
        raise HTTPException(status_code=500, detail="FRONTEND_URL non configuré")
    success_url = f"{origin}/dashboard?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/boutique?payment=cancel"

    stripe_checkout = get_stripe_checkout(http_request)
    metadata = {
        "user_id": user["id"],
        "user_email": user["email"],
        "user_username": user["username"],
        "source": "bxlrp_shop",
        "item_count": str(len(payload.items)),
    }

    session = await stripe_checkout.create_checkout_session(CheckoutSessionRequest(
        amount=total,
        currency=currency,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    ))

    # Create transaction record BEFORE redirect
    await db.payment_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_username": user["username"],
        "items": line_summary,
        "amount": total,
        "currency": currency,
        "payment_status": "initiated",
        "status": "pending",
        "metadata": metadata,
        "perks_granted": False,
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    })

    return {"url": session.url, "session_id": session.session_id, "amount": total, "currency": currency}


async def _grant_perks_if_paid(session_id: str):
    """Idempotent: grant VIP perks ONLY once per session_id."""
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx or tx.get("perks_granted") or tx.get("payment_status") != "paid":
        return
    # Compute longest active duration + add purchased duration to user; pick highest VIP tier
    extra_days = 0
    best_pkg = None
    best_rank = -1
    for it in tx.get("items", []):
        pkg = VIP_CATALOG.get(it.get("package_id"))
        if pkg:
            extra_days += pkg["duration_days"] * it.get("quantity", 1)
            rank = TIER_RANK.get(pkg["id"], 0)
            if rank > best_rank:
                best_rank = rank
                best_pkg = pkg
    if extra_days <= 0:
        return
    user = await db.users.find_one({"id": tx["user_id"]})
    if not user:
        return
    now = _now()
    current_until = user.get("vip_until")
    if isinstance(current_until, str):
        try:
            current_until = datetime.fromisoformat(current_until)
        except Exception:
            current_until = None
    base = current_until if current_until and current_until > now else now
    new_until = base + timedelta(days=extra_days)
    await db.users.update_one({"id": tx["user_id"]}, {"$set": {
        "vip_until": new_until.isoformat(),
        "vip_tier": (pack_names[-1] if pack_names else None),
    }})
    await db.payment_transactions.update_one({"session_id": session_id},
        {"$set": {"perks_granted": True, "updated_at": _now().isoformat()}})


@api_router.get("/shop/status/{session_id}")
async def shop_status(session_id: str, http_request: Request, user: dict = Depends(get_current_user)):
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    if tx["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # Already paid — defensive grant + return cached
    if tx.get("payment_status") == "paid":
        await _grant_perks_if_paid(session_id)
        tx = await db.payment_transactions.find_one({"session_id": session_id})
        return {"payment_status": "paid", "status": tx.get("status"), "amount_total": int(tx["amount"] * 100),
                "currency": tx["currency"], "perks_granted": tx.get("perks_granted", False)}

    # Otherwise refresh from Stripe
    stripe_checkout = get_stripe_checkout(http_request)
    try:
        status: CheckoutStatusResponse = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        logging.getLogger(__name__).warning("Stripe status fetch failed: %s", e)
        return {"payment_status": tx.get("payment_status"), "status": tx.get("status")}

    update = {"payment_status": status.payment_status, "status": status.status, "updated_at": _now().isoformat()}
    await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})

    if status.payment_status == "paid":
        await _grant_perks_if_paid(session_id)
        tx = await db.payment_transactions.find_one({"session_id": session_id})

    return {
        "payment_status": status.payment_status,
        "status": status.status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "perks_granted": tx.get("perks_granted", False) if tx else False,
    }


@api_router.get("/shop/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    items = await db.payment_transactions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    for it in items:
        for k in ("created_at", "updated_at"):
            if isinstance(it.get(k), str):
                it[k] = datetime.fromisoformat(it[k])
    return items


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    stripe_checkout = get_stripe_checkout(request)
    try:
        evt = await stripe_checkout.handle_webhook(body, sig)
    except Exception as e:
        logging.getLogger(__name__).warning("Stripe webhook error: %s", e)
        raise HTTPException(status_code=400, detail="Webhook invalide")

    session_id = getattr(evt, "session_id", None)
    if not session_id:
        return {"received": True}

    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if tx:
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": {
            "payment_status": getattr(evt, "payment_status", tx.get("payment_status")),
            "updated_at": _now().isoformat(),
        }})
        if getattr(evt, "payment_status", "") == "paid":
            await _grant_perks_if_paid(session_id)

    return {"received": True}


# ───────── Audit log
@api_router.get("/admin/audit")
async def get_audit(admin: dict = Depends(require_perm("view_audit")), limit: int = 200):
    items = await db.audit_log.find({}, {"_id": 0}).sort("created_at", -1).to_list(min(limit, 500))
    for a in items:
        if isinstance(a.get("created_at"), str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
    return items


# ───────── Permissions self
@api_router.get("/auth/perms")
async def my_perms(user: dict = Depends(get_current_user)):
    return {
        "role": user.get("role"),
        "is_super_admin": user.get("is_super_admin", False),
        "permissions": user.get("permissions") or [],
        "all_perms": ALL_PERMS,
    }


# ───────── Health
@api_router.get("/")
async def root():
    return {"message": "BXL-RP API en ligne", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.users.create_index("id", unique=True)
    await db.news.create_index("id", unique=True)
    await db.applications.create_index("id", unique=True)
    await db.profiles.create_index("user_id", unique=True)
    await db.profiles.create_index("username", unique=True)
    await db.business_applications.create_index("id", unique=True)
    await db.audit_log.create_index("created_at")
    await db.factions.create_index("key", unique=True)
    await db.payment_transactions.create_index("session_id", unique=True)
    await db.payment_transactions.create_index("user_id")

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@bxlrp.be").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "BxlRP2026!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "username": "Admin",
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "permissions": ALL_PERMS.copy(),
            "is_super_admin": True,
            "created_at": _now().isoformat(),
        })
        logger.info("Super-admin seeded")
    else:
        update = {}
        if not verify_password(admin_password, existing["password_hash"]):
            update["password_hash"] = hash_password(admin_password)
        if not existing.get("is_super_admin"):
            update["is_super_admin"] = True
            update["permissions"] = ALL_PERMS.copy()
            update["role"] = "admin"
        if update:
            await db.users.update_one({"email": admin_email}, {"$set": update})
            logger.info("Super-admin updated")

    # Seed sample news
    if await db.news.count_documents({}) == 0:
        samples = [
            {
                "title": "Ouverture officielle de Bruxelles RôlePlay",
                "excerpt": "Le serveur Belge le plus immersif ouvre ses portes. Rejoignez l'aventure !",
                "content": "Après des mois de développement, BXL-RP est enfin disponible. Une carte custom inspirée de Bruxelles, des factions équilibrées, et une communauté francophone passionnée vous attendent.",
                "category": "Annonce",
                "image_url": "https://images.unsplash.com/photo-1660944192434-1440a5ddde6e",
            },
            {
                "title": "Recrutement LSPD Bruxelles ouvert",
                "excerpt": "La police judiciaire de Bruxelles recrute des nouveaux agents motivés.",
                "content": "Vous voulez maintenir l'ordre dans les rues de la capitale ? Le LSPD recrute. Postulez via Discord avec le formulaire dédié.",
                "category": "Faction",
                "image_url": "https://images.pexels.com/photos/10466471/pexels-photo-10466471.jpeg",
            },
            {
                "title": "Mise à jour 1.2 — Nouveaux véhicules et métiers",
                "excerpt": "5 nouveaux véhicules custom et 3 métiers freelance ajoutés.",
                "content": "Profitez de notre dernière mise à jour avec des Audi RS, Mercedes AMG, le métier de livreur Uber Eats Bruxellois, mineur, et journaliste.",
                "category": "Mise à jour",
                "image_url": "https://images.unsplash.com/photo-1666032956671-5cc9a6bcf7a4",
            },
        ]
        for s in samples:
            await db.news.insert_one({
                "id": str(uuid.uuid4()),
                **s,
                "author": "Admin",
                "created_at": _now().isoformat(),
            })
        logger.info("Sample news seeded")

    # Seed factions
    if await db.factions.count_documents({}) == 0:
        factions_seed = [
            {"key": "lspd", "name": "LSPD Bruxelles", "category": "Force de l'ordre", "color": "#3B82F6", "icon_key": "shield",
             "description": "La police judiciaire fédérale. Maintien de l'ordre, enquêtes, intervention rapide.",
             "positions": ["Recrue", "Agent", "Inspecteur", "Commissaire"], "slots_max": 40, "is_whitelist": True},
            {"key": "justice", "name": "Justice & Avocats", "category": "Force de l'ordre", "color": "#6366F1", "icon_key": "scale",
             "description": "Tribunal de Bruxelles. Magistrats, avocats commis, jury populaire.",
             "positions": ["Avocat", "Magistrat", "Greffier"], "slots_max": 15, "is_whitelist": True},
            {"key": "ems", "name": "EMS Croix-Rouge", "category": "Secours", "color": "#DC2626", "icon_key": "heart",
             "description": "Urgences médicales et hospitalières. Sauvez des vies dans la capitale.",
             "positions": ["Ambulancier", "Infirmier", "Médecin", "Chef de service"], "slots_max": 30, "is_whitelist": True},
            {"key": "pompiers", "name": "Pompiers Bruxelles", "category": "Secours", "color": "#F97316", "icon_key": "radio",
             "description": "Lutte contre les incendies et secours techniques.",
             "positions": ["Sapeur", "Caporal", "Lieutenant"], "slots_max": 20, "is_whitelist": True},
            {"key": "gov", "name": "Gouvernement Belge", "category": "Civils", "color": "#10B981", "icon_key": "building",
             "description": "Premier ministre, ministres, fonctionnaires. Gérez le pays.",
             "positions": ["Fonctionnaire", "Ministre", "Premier Ministre"], "slots_max": 10, "is_whitelist": True},
            {"key": "media", "name": "Le Soir RP", "category": "Civils", "color": "#A855F7", "icon_key": "newspaper",
             "description": "Journal national. Couvrez l'actualité et les scandales bruxellois.",
             "positions": ["Journaliste", "Reporter", "Rédacteur en chef"], "slots_max": 12, "is_whitelist": True},
            {"key": "mecano", "name": "Mécano Royal", "category": "Métiers", "color": "#F59E0B", "icon_key": "wrench",
             "description": "Réparations, tuning, ventes de véhicules de luxe.",
             "positions": ["Apprenti", "Mécanicien", "Chef d'atelier"], "slots_max": 25, "is_whitelist": True},
            {"key": "transport", "name": "Transporteurs", "category": "Métiers", "color": "#8B949E", "icon_key": "truck",
             "description": "Livraisons, fret international, convois sécurisés.",
             "positions": [], "slots_max": None, "is_whitelist": False},
            {"key": "resto", "name": "Resto Bruxellois", "category": "Métiers", "color": "#EAB308", "icon_key": "pizza",
             "description": "Frites, gaufres, bières belges. Restaurez la capitale.",
             "positions": [], "slots_max": None, "is_whitelist": False},
            {"key": "btp", "name": "BTP & Construction", "category": "Métiers", "color": "#71717A", "icon_key": "hammer",
             "description": "Chantiers, immobilier, rénovation des quartiers.",
             "positions": [], "slots_max": None, "is_whitelist": False},
            {"key": "ulb", "name": "ULB - Université", "category": "Civils", "color": "#06B6D4", "icon_key": "graduation",
             "description": "Étudiants, professeurs. Vie étudiante immersive.",
             "positions": [], "slots_max": None, "is_whitelist": False},
            {"key": "bank", "name": "Banque ING", "category": "Civils", "color": "#22C55E", "icon_key": "briefcase",
             "description": "Système bancaire, prêts, gestion patrimoniale.",
             "positions": ["Conseiller", "Guichetier", "Directeur"], "slots_max": 8, "is_whitelist": True},
        ]
        now = _now().isoformat()
        for f in factions_seed:
            await db.factions.insert_one({
                **f,
                "id": str(uuid.uuid4()),
                "image_url": None,
                "owner_user_id": None,
                "recruitment_open": True,
                "created_at": now,
                "updated_at": now,
            })
        logger.info("Factions seeded (%d)", len(factions_seed))


@app.on_event("shutdown")
async def shutdown():
    client.close()
