import base64
import json
import logging
import os
from typing import Optional
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from app.database import SessionLocal, init_db
from app.advanced_search import advanced_property_search
from app.models_db import WhatsAppMessage, NormalizedMessage
from app import normalize_jobs as jobs
from app.normalize_runner import start_normalize_background, is_user_running
from app.pipeline_worker import get_pipeline_stats, start_pipeline_worker, wake_pipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("whatsapp_ai.api")

app = FastAPI(title="WhatsApp AI Search Backend")

NORMALIZE_SERVICE_SECRET = os.getenv("NORMALIZE_SERVICE_SECRET", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "openai/gpt-oss-20b")


def _require_normalize_secret(x_normalize_secret: Optional[str]) -> None:
    if not NORMALIZE_SERVICE_SECRET:
        return
    if not x_normalize_secret or x_normalize_secret != NORMALIZE_SERVICE_SECRET:
        raise HTTPException(status_code=401, detail="Invalid normalize service secret")


def extract_user_id_from_token(token_str: str) -> Optional[int]:
    """Helper to decode user id from JWT Bearer token."""
    try:
        if token_str.startswith("Bearer "):
            token_str = token_str.split(" ")[1]
        parts = token_str.split(".")
        if len(parts) >= 2:
            payload_b64 = parts[1]
            padded = payload_b64 + "=" * (-len(payload_b64) % 4)
            decoded_bytes = base64.urlsafe_b64decode(padded)
            payload_data = json.loads(decoded_bytes)
            user_id = payload_data.get("id") or payload_data.get("userId") or payload_data.get("user_id")
            if user_id is not None:
                return int(user_id)
    except Exception as e:
        logger.warning(f"Could not parse user_id from token header: {e}")
    return None


@app.on_event("startup")
def on_startup():
    init_db(skip_if_busy=True)
    start_pipeline_worker()
    logger.info("API ready — realtime normalize worker is running")


class DashboardSearchRequest(BaseModel):
    query: Optional[str] = None
    purpose: Optional[str] = None
    city: Optional[str] = None
    location: Optional[str] = None
    sortBy: str = "Newest First"
    priceMin: Optional[float] = None
    priceMax: Optional[float] = None
    propertyType: Optional[str] = None
    propertySubType: Optional[str] = None
    areaUnit: Optional[str] = None
    areaMin: Optional[float] = None
    areaMax: Optional[float] = None
    status: Optional[str] = None
    propertyStatus: Optional[str] = None
    userId: Optional[int] = None
    user_id: Optional[int] = None
    limit: int = 20


class ProcessNowRequest(BaseModel):
    user_id: Optional[int] = None


class NormalizeRunRequest(BaseModel):
    user_id: int
    model: Optional[str] = None
    batch_size: int = 50
    embed: bool = True


@app.get("/")
def health_check():
    return {
        "status": "healthy",
        "service": "WhatsApp AI Search Backend",
        "version": "1.2.0",
        "pipeline": get_pipeline_stats(),
    }


@app.get("/api/pipeline-status")
def api_pipeline_status():
    return {"success": True, **get_pipeline_stats()}


@app.post("/api/process-now")
def api_process_now(req: ProcessNowRequest = ProcessNowRequest()):
    """Wake the background worker after a tenant scrapes new chats."""
    wake_pipeline(req.user_id)
    return {"success": True, "queued": True, "user_id": req.user_id}


@app.post("/api/dashboard-search")
def api_dashboard_search(
    req: DashboardSearchRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None),
):
    db = SessionLocal()
    try:
        effective_user_id = req.userId if req.userId is not None else req.user_id

        if effective_user_id is None and x_user_id:
            try:
                effective_user_id = int(x_user_id)
            except ValueError:
                pass

        if effective_user_id is None and authorization:
            effective_user_id = extract_user_id_from_token(authorization)

        logger.info(
            f"Dashboard search request: user_id={effective_user_id}, city={req.city}, "
            f"type={req.propertyType}, purpose={req.purpose}"
        )

        results = advanced_property_search(
            db=db,
            user_id=effective_user_id,
            query_text=req.query,
            model_used=DEFAULT_MODEL,
            purpose=req.purpose,
            city=req.city,
            location=req.location,
            sort_by=req.sortBy,
            price_min=req.priceMin,
            price_max=req.priceMax,
            property_type=req.propertyType,
            property_sub_type=req.propertySubType,
            area_unit=req.areaUnit,
            area_min=req.areaMin,
            area_max=req.areaMax,
            status=req.status or req.propertyStatus,
            limit=req.limit,
        )

        logger.info(f"Dashboard search returned {len(results)} results for user_id={effective_user_id}")

        return {
            "success": True,
            "count": len(results),
            "results": results,
        }

    except Exception as e:
        logger.error(f"Dashboard search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "results": [],
        }
    finally:
        db.close()


@app.post("/api/normalize/run")
def api_normalize_run(
    req: NormalizeRunRequest,
    x_normalize_secret: Optional[str] = Header(None),
):
    _require_normalize_secret(x_normalize_secret)

    uid = int(req.user_id)
    model = req.model or DEFAULT_MODEL
    batch = max(1, min(int(req.batch_size or 50), 200))

    db = SessionLocal()
    try:
        job = jobs.ensure_queued_job(
            db,
            user_id=uid,
            model=model,
            embed=bool(req.embed),
            batch_size=batch,
        )
        if is_user_running(uid) or (job.get("status") == "running" and is_user_running(uid)):
            return {
                "success": True,
                "started": False,
                "already_running": True,
                "user_id": uid,
            }

        result = start_normalize_background(
            user_id=uid,
            model=model,
            batch_size=batch,
            embed=bool(req.embed),
        )
        return {
            "success": True,
            "user_id": uid,
            "model": model,
            **result,
        }
    except Exception as e:
        logger.exception("normalize/run failed")
        raise HTTPException(status_code=500, detail=str(e)) from e
    finally:
        db.close()


@app.get("/api/normalize/status/{user_id}")
def api_normalize_status(
    user_id: int,
    model: Optional[str] = None,
    x_normalize_secret: Optional[str] = Header(None),
):
    _require_normalize_secret(x_normalize_secret)
    model_name = model or DEFAULT_MODEL
    uid = int(user_id)
    db = SessionLocal()
    try:
        total = (
            db.query(WhatsAppMessage)
            .filter(WhatsAppMessage.user_id == uid)
            .filter(WhatsAppMessage.message.isnot(None))
            .count()
        )
        done = (
            db.query(NormalizedMessage)
            .join(WhatsAppMessage, WhatsAppMessage.id == NormalizedMessage.whatsapp_message_id)
            .filter(WhatsAppMessage.user_id == uid)
            .filter(NormalizedMessage.model_used == model_name)
            .count()
        )
        pending = max(total - done, 0)
        percentage = 100.0 if total == 0 else round((done / total) * 1000) / 10
        job = jobs.get_job(db, uid)
        return {
            "success": True,
            "user_id": uid,
            "model": model_name,
            "totalMessages": total,
            "normalizedCount": done,
            "pendingCount": pending,
            "percentage": percentage,
            "runningInProcess": is_user_running(uid),
            "job": job,
        }
    finally:
        db.close()
