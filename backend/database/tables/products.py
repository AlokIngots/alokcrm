from sqlalchemy import Column, Integer, String, Boolean, Text
from database.db import Base
from pydantic import BaseModel
from typing import Optional


class Product(Base):
    __tablename__ = "Products"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ProductLine = Column(String(100), nullable=False)
    GradeFamily = Column(String(100))
    Shape = Column(String(100))
    DiaMin = Column(String(50))
    DiaMax = Column(String(50))
    ToleranceOptions = Column(Text)
    HeatTreatmentOptions = Column(Text)
    Active = Column(Boolean, default=True)


class ProductBase(BaseModel):
    ProductLine: str
    GradeFamily: Optional[str] = None
    Shape: Optional[str] = None
    DiaMin: Optional[str] = None
    DiaMax: Optional[str] = None
    ToleranceOptions: Optional[str] = None
    HeatTreatmentOptions: Optional[str] = None
    Active: Optional[bool] = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    ProductLine: Optional[str] = None
    GradeFamily: Optional[str] = None
    Shape: Optional[str] = None
    DiaMin: Optional[str] = None
    DiaMax: Optional[str] = None
    ToleranceOptions: Optional[str] = None
    HeatTreatmentOptions: Optional[str] = None
    Active: Optional[bool] = None


class ProductResponse(ProductBase):
    id: int

    class Config:
        from_attributes = True
