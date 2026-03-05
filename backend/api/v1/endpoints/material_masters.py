from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import zipfile
import xml.etree.ElementTree as ET
import re

from database.db import get_db
from database.tables.material_masters import (
    GradeCatalog,
    GradeCatalogResponse,
    ToleranceChartRow,
    ToleranceChartRowResponse,
)

router = APIRouter()


def _read_xlsx_rows(file_path: str, sheet_name: Optional[str] = None) -> List[dict]:
    ns = {
        "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
        "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    }

    try:
        with zipfile.ZipFile(file_path) as zf:
            wb = ET.fromstring(zf.read("xl/workbook.xml"))
            rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
            rel_map = {
                rel.attrib["Id"]: rel.attrib["Target"]
                for rel in rels.findall("{http://schemas.openxmlformats.org/package/2006/relationships}Relationship")
            }

            shared = []
            if "xl/sharedStrings.xml" in zf.namelist():
                sroot = ET.fromstring(zf.read("xl/sharedStrings.xml"))
                for si in sroot.findall("a:si", ns):
                    shared.append("".join((t.text or "") for t in si.findall(".//a:t", ns)))

            sheet = wb.find("a:sheets/a:sheet", ns)
            if sheet_name:
                for s in wb.findall("a:sheets/a:sheet", ns):
                    if s.attrib.get("name") == sheet_name:
                        sheet = s
                        break
            if sheet is None:
                return []

            rid = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
            target = f"xl/{rel_map[rid]}"
            root = ET.fromstring(zf.read(target))

            rows = []
            for row in root.findall("a:sheetData/a:row", ns):
                values = {}
                for cell in row.findall("a:c", ns):
                    ref = cell.attrib.get("r", "")
                    col = re.match(r"([A-Z]+)", ref).group(1) if ref else ""
                    ctype = cell.attrib.get("t")
                    raw_v = cell.find("a:v", ns)
                    if raw_v is None:
                        text = ""
                    elif ctype == "s":
                        idx = int(raw_v.text)
                        text = shared[idx] if 0 <= idx < len(shared) else str(raw_v.text)
                    else:
                        text = str(raw_v.text or "")
                    values[col] = text.strip()
                if any(v for v in values.values()):
                    rows.append(values)
            return rows
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to parse XLSX: {exc}")


@router.get("/grades", response_model=List[GradeCatalogResponse])
async def get_grade_catalog(
    q: Optional[str] = Query(default=None),
    standard: Optional[str] = Query(default=None),
    active_only: bool = Query(default=True),
    db: Session = Depends(get_db),
):
    query = db.query(GradeCatalog)
    if q:
        query = query.filter((GradeCatalog.Code.ilike(f"%{q}%")) | (GradeCatalog.Name.ilike(f"%{q}%")))
    if standard:
        query = query.filter(GradeCatalog.Standard == standard)
    if active_only:
        query = query.filter(GradeCatalog.Active == True)  # noqa: E712

    return query.order_by(GradeCatalog.Code.asc()).all()


@router.post("/grades/import")
async def import_grade_catalog(
    file_path: str = Query(default="/Users/exports/Downloads/GRADE MASTER.xlsx"),
    sheet_name: str = Query(default="Sheet1"),
    db: Session = Depends(get_db),
):
    rows = _read_xlsx_rows(file_path=file_path, sheet_name=sheet_name)
    if not rows:
        raise HTTPException(status_code=400, detail="No rows found in grade sheet")

    created = 0
    updated = 0

    for row in rows:
        code = row.get("B", "").strip()
        name = row.get("C", "").strip()
        if not code or not name:
            continue

        existing = db.query(GradeCatalog).filter(GradeCatalog.Code == code).first()
        payload = {
            "Code": code,
            "Name": name,
            "Standard": row.get("D") or None,
            "C": row.get("E") or None,
            "Mn": row.get("F") or None,
            "Si": row.get("G") or None,
            "S": row.get("H") or None,
            "P": row.get("I") or None,
            "Cr": row.get("J") or None,
            "Ni": row.get("K") or None,
            "Mo": row.get("L") or None,
            "Others": row.get("M") or None,
            "EquivalentGrade": row.get("N") or None,
            "V": row.get("O") or None,
            "Al": row.get("P") or None,
            "Cu": row.get("Q") or None,
            "Ti": row.get("R") or None,
            "Nb": row.get("S") or None,
            "W": row.get("T") or None,
            "Sn": row.get("U") or None,
            "Pb": row.get("V") or None,
            "B": row.get("W") or None,
            "Ca": row.get("X") or None,
            "As": row.get("Y") or None,
            "N": row.get("Z") or None,
            "PPM_O2": row.get("AA") or None,
            "PPM_H2": row.get("AB") or None,
            "C_E": row.get("AC") or None,
            "F_E": row.get("AD") or None,
            "Active": True,
        }

        if existing:
            for field, value in payload.items():
                setattr(existing, field, value)
            updated += 1
        else:
            db.add(GradeCatalog(**payload))
            created += 1

    db.commit()
    return {"message": "Grade catalog import completed", "created": created, "updated": updated}


@router.get("/tolerances", response_model=List[ToleranceChartRowResponse])
async def get_tolerance_rows(
    fit_family: Optional[str] = Query(default=None),
    class_code: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(ToleranceChartRow)
    if fit_family:
        query = query.filter(ToleranceChartRow.FitFamily == fit_family.lower())
    if class_code:
        query = query.filter(ToleranceChartRow.ClassCode == class_code.lower())
    return query.order_by(ToleranceChartRow.FitFamily.asc(), ToleranceChartRow.ClassCode.asc(), ToleranceChartRow.DiameterMinMM.asc()).all()


@router.post("/tolerances/seed-default")
async def seed_default_tolerances(db: Session = Depends(get_db)):
    # Derived from the provided ISO tolerance chart image.
    seed_data = [
        # ISO f
        ("f", "f6", 6, 10, "-0.013", "-0.022"), ("f", "f7", 6, 10, "-0.013", "-0.028"), ("f", "f8", 6, 10, "-0.013", "-0.035"), ("f", "f9", 6, 10, "-0.013", "-0.049"),
        ("f", "f6", 10, 18, "-0.016", "-0.027"), ("f", "f7", 10, 18, "-0.016", "-0.034"), ("f", "f8", 10, 18, "-0.016", "-0.043"), ("f", "f9", 10, 18, "-0.016", "-0.059"),
        ("f", "f6", 18, 30, "-0.020", "-0.033"), ("f", "f7", 18, 30, "-0.020", "-0.041"), ("f", "f8", 18, 30, "-0.020", "-0.053"), ("f", "f9", 18, 30, "-0.020", "-0.072"),
        # ISO h
        ("h", "h7", 6, 10, "-0.015", "+0"), ("h", "h8", 6, 10, "-0.022", "+0"), ("h", "h9", 6, 10, "-0.036", "+0"), ("h", "h10", 6, 10, "-0.058", "+0"), ("h", "h11", 6, 10, "-0.090", "+0"), ("h", "h12", 6, 10, "-0.150", "+0"),
        ("h", "h7", 10, 18, "-0.018", "+0"), ("h", "h8", 10, 18, "-0.027", "+0"), ("h", "h9", 10, 18, "-0.043", "+0"), ("h", "h10", 10, 18, "-0.070", "+0"), ("h", "h11", 10, 18, "-0.110", "+0"), ("h", "h12", 10, 18, "-0.180", "+0"),
        # ISO k
        ("k", "k7", 6, 10, "+0.016", "+0.001"), ("k", "k8", 6, 10, "+0.022", "-0"), ("k", "k9", 6, 10, "+0.036", "-0"), ("k", "k10", 6, 10, "+0.058", "-0"), ("k", "k11", 6, 10, "+0.090", "-0"), ("k", "k12", 6, 10, "+0.150", "-0"),
        ("k", "k7", 10, 18, "+0.019", "+0.001"), ("k", "k8", 10, 18, "+0.027", "-0"), ("k", "k9", 10, 18, "+0.043", "-0"), ("k", "k10", 10, 18, "+0.070", "-0"), ("k", "k11", 10, 18, "+0.110", "-0"), ("k", "k12", 10, 18, "+0.180", "-0"),
        # ISO e
        ("e", "e7", 6, 10, "-0.025", "-0.040"), ("e", "e8", 6, 10, "-0.025", "-0.047"), ("e", "e9", 6, 10, "-0.025", "-0.061"),
        ("e", "e7", 10, 18, "-0.032", "-0.050"), ("e", "e8", 10, 18, "-0.032", "-0.059"), ("e", "e9", 10, 18, "-0.032", "-0.075"),
        ("e", "e7", 18, 30, "-0.040", "-0.061"), ("e", "e8", 18, 30, "-0.040", "-0.073"), ("e", "e9", 18, 30, "-0.040", "-0.092"),
    ]

    created = 0
    for fit, code, dmin, dmax, upper, lower in seed_data:
        existing = db.query(ToleranceChartRow).filter(
            ToleranceChartRow.FitFamily == fit,
            ToleranceChartRow.ClassCode == code,
            ToleranceChartRow.DiameterMinMM == dmin,
            ToleranceChartRow.DiameterMaxMM == dmax,
        ).first()
        if existing:
            existing.UpperValue = upper
            existing.LowerValue = lower
            continue
        db.add(
            ToleranceChartRow(
                FitFamily=fit,
                ClassCode=code,
                DiameterMinMM=dmin,
                DiameterMaxMM=dmax,
                UpperValue=upper,
                LowerValue=lower,
            )
        )
        created += 1

    db.commit()
    return {"message": "Tolerance rows seeded", "created": created, "total_seed_rows": len(seed_data)}
