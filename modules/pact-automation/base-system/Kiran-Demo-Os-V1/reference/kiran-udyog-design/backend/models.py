from sqlalchemy import Column, Integer, String, Float, Boolean, JSON
from .database import Base

class Employee(Base):
    __tablename__ = "employees"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    employeeCode = Column(String)
    department = Column(String)
    designation = Column(String)
    managerName = Column(String)
    email = Column(String)
    monthlyAllowance = Column(Float)
    usedThisMonth = Column(Float)
    pendingAmount = Column(Float)
    bankAccount = Column(JSON)

class ReceiptRequest(Base):
    __tablename__ = "requests"
    id = Column(String, primary_key=True, index=True)
    employeeId = Column(String, index=True)
    title = Column(String)
    category = Column(String)
    amount = Column(Float)
    currency = Column(String)
    submittedOn = Column(String)
    travelDates = Column(JSON, nullable=True)
    justification = Column(String)
    receipts = Column(JSON)
    status = Column(String)
    currentStage = Column(String)
    timeline = Column(JSON)
    slaDueOn = Column(String, nullable=True)
    duplicateOf = Column(String, nullable=True)

class Payout(Base):
    __tablename__ = "payouts"
    id = Column(String, primary_key=True, index=True)
    requestId = Column(String, index=True)
    employeeId = Column(String, index=True)
    amount = Column(Float)
    method = Column(String)
    status = Column(String)
    initiatedOn = Column(String)
    settledOn = Column(String, nullable=True)
    utr = Column(String, nullable=True)
    failureReason = Column(String, nullable=True)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, index=True)
    toRole = Column(String)
    toEmployeeId = Column(String, nullable=True)
    title = Column(String)
    body = Column(String)
    at = Column(String)
    read = Column(Boolean, default=False)
    requestId = Column(String, nullable=True)

class MonthlySpend(Base):
    __tablename__ = "monthly_spend"
    month = Column(String, primary_key=True, index=True)
    disbursed = Column(Float)
    budget = Column(Float)

class DepartmentUtilisation(Base):
    __tablename__ = "department_utilisation"
    department = Column(String, primary_key=True, index=True)
    allocated = Column(Float)
    used = Column(Float)
    pending = Column(Float)
    headcount = Column(Integer)

class PolicyCap(Base):
    __tablename__ = "policy_caps"
    category = Column(String, primary_key=True, index=True)
    label = Column(String)
    cap = Column(Float)
    unit = Column(String)
