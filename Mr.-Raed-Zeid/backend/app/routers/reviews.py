import hashlib
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Review
from ..schemas import ReviewIn, ReviewOut

router = APIRouter(prefix="/reviews", tags=["reviews"])

@router.get("", response_model=list[ReviewOut])
def approved_reviews(db: Session = Depends(get_db)):
    return db.scalars(select(Review).where(Review.status == "approved").order_by(Review.created_at.desc()).limit(50)).all()

@router.post("", response_model=ReviewOut, status_code=201)
def submit_review(data: ReviewIn, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()
    review = Review(display_name=data.display_name.strip(), student_stage=data.student_stage.strip(), rating=data.rating, body=data.body.strip(), status="pending", ip_hash=ip_hash)
    db.add(review); db.commit(); db.refresh(review)
    return review
