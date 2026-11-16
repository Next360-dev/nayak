"""
api/routes/contacts.py
POST /api/representatives/import?dry_run=1   admin: body {"csv": "..."}; dry_run=1 only reports what would change
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import require_admin
from app.repositories import audit_repository
from app.services import contacts_service

router = APIRouter()


class ImportBody(BaseModel):
    csv: str = Field(min_length=1)


@router.post("/api/representatives/import")
def import_contacts(body: ImportBody, dry_run: bool = True, admin: dict = Depends(require_admin)):
    try:
        plan = contacts_service.plan(body.csv)
    except contacts_service.ImportError_ as e:
        raise HTTPException(status_code=422, detail=str(e))
    summary = {"will_update": len(plan["updates"]), "will_add": len(plan["adds"]), "errors": plan["errors"], "warnings": plan["warnings"], "skipped_blank": plan["skipped_blank"],
               "preview": (plan["updates"] + plan["adds"])[:10]}
    if dry_run:
        return {"status": "success", "dry_run": True, **summary}
    done = contacts_service.apply(plan)
    audit_repository.log("contacts_imported", actor=admin["username"], detail={**done, "skipped": len(plan["errors"])})
    return {"status": "success", "dry_run": False, **summary, **done}
