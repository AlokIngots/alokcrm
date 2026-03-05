from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from database.db import Base
from pydantic import BaseModel
from typing import Optional

class Note(Base):
    __tablename__ = "Notes"
    
    ID = Column(Integer, primary_key=True, index=True, autoincrement=True)
    ECode = Column(String(10), ForeignKey("Users.ECode"), nullable=False)
    DealID = Column(Integer, ForeignKey("Deals.ID"), nullable=False)
    Notes = Column(Text, nullable=True)

    user = relationship("User", backref="notes")
    deal = relationship("Deal", backref="notes")

class NoteBase(BaseModel):
    ECode: str
    DealID: int
    Notes: Optional[str] = None

class NoteCreate(BaseModel):
    Notes: Optional[str] = None

class NoteUpdate(BaseModel):
    Notes: Optional[str] = None  # Only the note content is editable

class NoteResponse(NoteBase):
    ID: int

    class Config:
        from_attributes = True