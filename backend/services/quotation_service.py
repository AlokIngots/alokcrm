import logging
import os
import smtplib
from email.message import EmailMessage
from typing import Tuple


logger = logging.getLogger("crm.quotation")


def _env_flag(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def send_quotation_email(
    *,
    to_email: str,
    customer_name: str,
    offer_number: str,
    salesperson_name: str,
    pdf_bytes: bytes,
    filename: str,
) -> Tuple[bool, str]:
    if not _env_flag("AUTO_SEND_QUOTATION_ON_OFFER", True):
        return False, "auto_send_disabled"

    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from = os.getenv("SMTP_FROM") or smtp_user
    use_ssl = _env_flag("SMTP_USE_SSL", False)
    use_tls = _env_flag("SMTP_USE_TLS", True)

    if not smtp_host or not smtp_from:
        return False, "smtp_not_configured"

    msg = EmailMessage()
    msg["From"] = smtp_from
    msg["To"] = to_email
    msg["Subject"] = f"Techno-Commercial Offer - {offer_number}"
    msg.set_content(
        f"""Dear {customer_name},

Please find attached the techno-commercial offer.

Offer Number: {offer_number}
Prepared By: {salesperson_name}

Regards,
Alok Ingots Sales Team
"""
    )
    msg.add_attachment(pdf_bytes, maintype="application", subtype="pdf", filename=filename)

    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=20) as server:
                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
                if use_tls:
                    server.starttls()
                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)
                server.send_message(msg)
        return True, "sent"
    except Exception as exc:
        logger.warning("Failed to send quotation email: %s", exc)
        return False, f"send_failed:{exc}"
