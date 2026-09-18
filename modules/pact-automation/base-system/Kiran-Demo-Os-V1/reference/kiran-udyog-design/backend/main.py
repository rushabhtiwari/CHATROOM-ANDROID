from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Any
from . import models, database
from .database import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.get("/api/employees")
def get_employees(db: Session = Depends(get_db)):
    return db.query(models.Employee).all()

@app.get("/api/requests")
def get_requests(db: Session = Depends(get_db)):
    return db.query(models.ReceiptRequest).all()

@app.get("/api/requests/{id}")
def get_request(id: str, db: Session = Depends(get_db)):
    req = db.query(models.ReceiptRequest).filter(models.ReceiptRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    return req

class RequestCreate(BaseModel):
    employeeId: str
    title: str
    category: str
    amount: float
    currency: str = "INR"
    submittedOn: str
    justification: str
    status: str = "DRAFT"
    currentStage: str = "HR"
    travelDates: Optional[dict] = None
    receipts: Optional[list] = []
    timeline: Optional[list] = []
    duplicateOf: Optional[str] = None
    slaDueOn: Optional[str] = None

@app.post("/api/requests")
def create_request(req_in: RequestCreate, db: Session = Depends(get_db)):
    import uuid
    # simple id gen logic for demo
    new_id = f"REQ-NEW-{str(uuid.uuid4())[:8]}"
    req = models.ReceiptRequest(id=new_id, **req_in.dict())
    db.add(req)
    db.commit()
    db.refresh(req)
    return req

class RequestUpdate(BaseModel):
    status: Optional[str] = None
    currentStage: Optional[str] = None

@app.patch("/api/requests/{id}")
def update_request(id: str, req_in: RequestUpdate, db: Session = Depends(get_db)):
    req = db.query(models.ReceiptRequest).filter(models.ReceiptRequest.id == id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    if req_in.status is not None:
        req.status = req_in.status
    if req_in.currentStage is not None:
        req.currentStage = req_in.currentStage
        
    db.commit()
    db.refresh(req)
    return req

@app.get("/api/payouts")
def get_payouts(db: Session = Depends(get_db)):
    return db.query(models.Payout).all()

@app.get("/api/notifications")
def get_notifications(db: Session = Depends(get_db)):
    return db.query(models.Notification).all()

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    monthlySpend = db.query(models.MonthlySpend).all()
    departmentUtilisation = db.query(models.DepartmentUtilisation).all()
    policyCaps = db.query(models.PolicyCap).all()
    
    return {
        "monthlySpend": monthlySpend,
        "departmentUtilisation": departmentUtilisation,
        "policyCaps": policyCaps
    }
