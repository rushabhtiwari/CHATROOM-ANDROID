import json
from .database import engine, Base, SessionLocal
from . import models

def seed_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Check if we already have data
    if db.query(models.Employee).first():
        print("Database already seeded")
        return
        
    with open("backend/seed_data_utf8.json", "r", encoding="utf-8-sig") as f:
        data = json.load(f)
        
    for emp_data in data.get("employees", []):
        emp = models.Employee(**emp_data)
        db.add(emp)
        
    for req_data in data.get("requests", []):
        req = models.ReceiptRequest(**req_data)
        db.add(req)
        
    for payout_data in data.get("payouts", []):
        payout = models.Payout(**payout_data)
        db.add(payout)
        
    for notif_data in data.get("notifications", []):
        notif = models.Notification(**notif_data)
        db.add(notif)
        
    for spend_data in data.get("monthlySpend", []):
        spend = models.MonthlySpend(**spend_data)
        db.add(spend)
        
    for dept_data in data.get("departmentUtilisation", []):
        dept = models.DepartmentUtilisation(**dept_data)
        db.add(dept)
        
    for cap_data in data.get("policyCaps", []):
        cap = models.PolicyCap(**cap_data)
        db.add(cap)
        
    db.commit()
    db.close()
    print("Database seeded successfully")

if __name__ == "__main__":
    seed_db()
