from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import ContactMessage, SiteSetting, SitePage
from ..schemas import ContactIn

router = APIRouter(tags=["public"])


@router.get("/health")
def health():
    return {"status": "ok"}


@router.get("/site-settings")
def settings(db: Session = Depends(get_db)):
    rows = db.scalars(select(SiteSetting)).all()
    return {x.key: x.value for x in rows}


@router.get("/navigation")
def navigation(db: Session = Depends(get_db)):
    rows = db.scalars(select(SitePage).where(SitePage.is_visible.is_(True), SitePage.archived_at.is_(None)).order_by(SitePage.sort_order, SitePage.id)).all()
    return [{"slug":p.slug,"title":p.title,"path":p.path,"is_system":p.is_system} for p in rows]


@router.get("/pages/{slug}")
def public_page(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(SitePage).where(SitePage.slug == slug, SitePage.is_visible.is_(True), SitePage.archived_at.is_(None)))
    if not p:
        from fastapi import HTTPException
        raise HTTPException(404, "الصفحة غير موجودة")
    return {"slug":p.slug,"title":p.title,"path":p.path,"content_json":p.content_json}


@router.post("/contact", status_code=201)
def contact(data: ContactIn, db: Session = Depends(get_db)):
    msg = ContactMessage(name=data.name.strip(), phone=data.phone.strip(), message=data.message.strip())
    db.add(msg); db.commit()
    return {"message": "تم استلام رسالتك"}
