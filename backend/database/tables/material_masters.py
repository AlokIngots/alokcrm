from sqlalchemy import Column, Integer, String, Text, Boolean, Float, UniqueConstraint
from database.db import Base
from pydantic import BaseModel
from typing import Optional


class GradeCatalog(Base):
    __tablename__ = "GradeCatalog"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    Code = Column(String(30), unique=True, nullable=False, index=True)
    Name = Column(String(150), nullable=False, index=True)
    Standard = Column(String(30), nullable=True, index=True)
    EquivalentGrade = Column(String(150), nullable=True)

    C = Column(String(50), nullable=True)
    Mn = Column(String(50), nullable=True)
    Si = Column(String(50), nullable=True)
    S = Column(String(50), nullable=True)
    P = Column(String(50), nullable=True)
    Cr = Column(String(50), nullable=True)
    Ni = Column(String(50), nullable=True)
    Mo = Column(String(50), nullable=True)
    V = Column(String(50), nullable=True)
    Al = Column(String(50), nullable=True)
    Cu = Column(String(50), nullable=True)
    Ti = Column(String(50), nullable=True)
    Nb = Column(String(50), nullable=True)
    W = Column(String(50), nullable=True)
    Sn = Column(String(50), nullable=True)
    Pb = Column(String(50), nullable=True)
    B = Column(String(50), nullable=True)
    Ca = Column(String(50), nullable=True)
    As = Column(String(50), nullable=True)
    N = Column(String(50), nullable=True)
    PPM_O2 = Column(String(50), nullable=True)
    PPM_H2 = Column(String(50), nullable=True)
    C_E = Column(String(50), nullable=True)
    F_E = Column(String(50), nullable=True)
    Others = Column(Text, nullable=True)
    Active = Column(Boolean, default=True)


class ToleranceChartRow(Base):
    __tablename__ = "ToleranceChartRows"
    __table_args__ = (
        UniqueConstraint("FitFamily", "ClassCode", "DiameterMinMM", "DiameterMaxMM", name="uq_tol_chart_row"),
    )

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    FitFamily = Column(String(20), nullable=False, index=True)  # f/h/k/e
    ClassCode = Column(String(20), nullable=False, index=True)  # f6, h9, k11, etc.
    DiameterMinMM = Column(Float, nullable=False)
    DiameterMaxMM = Column(Float, nullable=False)
    UpperValue = Column(String(30), nullable=True)
    LowerValue = Column(String(30), nullable=True)


class GradeCatalogResponse(BaseModel):
    id: int
    Code: str
    Name: str
    Standard: Optional[str] = None
    EquivalentGrade: Optional[str] = None
    C: Optional[str] = None
    Mn: Optional[str] = None
    Si: Optional[str] = None
    S: Optional[str] = None
    P: Optional[str] = None
    Cr: Optional[str] = None
    Ni: Optional[str] = None
    Mo: Optional[str] = None
    V: Optional[str] = None
    Al: Optional[str] = None
    Cu: Optional[str] = None
    Ti: Optional[str] = None
    Nb: Optional[str] = None
    W: Optional[str] = None
    Sn: Optional[str] = None
    Pb: Optional[str] = None
    B: Optional[str] = None
    Ca: Optional[str] = None
    As: Optional[str] = None
    N: Optional[str] = None
    PPM_O2: Optional[str] = None
    PPM_H2: Optional[str] = None
    C_E: Optional[str] = None
    F_E: Optional[str] = None
    Others: Optional[str] = None
    Active: bool

    class Config:
        from_attributes = True


class ToleranceChartRowResponse(BaseModel):
    id: int
    FitFamily: str
    ClassCode: str
    DiameterMinMM: float
    DiameterMaxMM: float
    UpperValue: Optional[str] = None
    LowerValue: Optional[str] = None

    class Config:
        from_attributes = True
