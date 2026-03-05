# import os
# import requests
# import urllib.parse
# import random
# import string
# from typing import Dict, Optional
# from datetime import datetime, timedelta
# from dotenv import load_dotenv

# load_dotenv()

# otp_sessions: Dict[str, dict] = {}

# def generate_otp() -> str:
#     """Generate a 6-digit OTP"""
#     return ''.join(random.choices(string.digits, k=6))

# def generate_session_id() -> str:
#     """Generate a unique session ID"""
#     return ''.join(random.choices(string.ascii_letters + string.digits, k=32))

# def send_message(phone_no: str, otp: str) -> str:
#     """Send OTP SMS using the bulk SMS gateway"""
#     base_url = os.environ["SMS_BASE_URL"]

#     message = f"ALOK CRM LOGIN OTP NO.{otp}."
    
#     params = {
#         "user": os.environ["SMS_USER"],
#         "password": os.environ["SMS_PASSWORD"],
#         "mobile": phone_no,
#         "message": message,
#         "sender": os.environ["SMS_SENDER"],
#         "type": os.environ["SMS_TYPE"],
#         "template_id": os.environ["SMS_TEMPLATE_ID"],
#     }
    
#     query_string = urllib.parse.urlencode(params)
#     full_url = f"{base_url}?{query_string}"
    
#     try:
#         response = requests.post(
#             full_url, 
#             headers={'Content-Type': 'application/x-www-form-urlencoded'},
#             timeout=10
#         )
#         response.raise_for_status()
#         result = response.text
#         print(f"SMS API Response: {result}")
        
#         # Check if the response indicates success
#         if "failed" in result.lower() or "invalid" in result.lower():
#             raise Exception(f"SMS API Error: {result}")
            
#         return otp
#     except requests.RequestException as e:
#         print(f"SMS sending failed: {str(e)}")
#         raise Exception(f"Failed to send SMS: {str(e)}")


# def store_otp_session(session_id: str, ecode: str, otp: str, phone_number: str) -> None:
#     """Store OTP session with expiration"""
#     expiry = datetime.now() + timedelta(minutes=5)
#     otp_sessions[session_id] = {
#         "ecode": ecode,
#         "otp": otp,
#         "phone_number": phone_number,
#         "created_at": datetime.now(),
#         "expires_at": expiry,
#         "verified": False
#     }

# def verify_otp_session(session_id: str, provided_otp: str) -> Optional[str]:
#     """Verify OTP and return ECode if valid"""
#     if session_id not in otp_sessions:
#         return None
    
#     session = otp_sessions[session_id]
    
#     if datetime.now() > session["expires_at"]:
#         del otp_sessions[session_id]
#         return None
    
#     if session["otp"] == provided_otp:
#         session["verified"] = True
#         return session["ecode"]
    
#     return None

# def cleanup_expired_sessions():
#     """Remove expired OTP sessions"""
#     now = datetime.now()
#     expired_sessions = [sid for sid, session in otp_sessions.items() if now > session["expires_at"]]
#     for sid in expired_sessions:
#         del otp_sessions[sid] 




# services/otp_service.py
import os
import random
import string
import urllib.parse
import logging
from typing import Dict, Optional
from datetime import datetime, timedelta

import requests
from dotenv import load_dotenv

from pathlib import Path
load_dotenv(dotenv_path=Path(__file__).resolve().parents[1] / ".env", override=True)

load_dotenv()

otp_sessions: Dict[str, dict] = {}
logger = logging.getLogger("crm.otp")

# ---------- OTP CORE ----------

def generate_otp() -> str:
    """Generate a 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


def generate_session_id() -> str:
    """Generate a unique session ID"""
    return ''.join(random.choices(string.ascii_letters + string.digits, k=32))


def _sms_mode() -> str:
    return os.getenv("SMS_MODE", "mock").strip().lower()


# ---------- INTERAKT (WHATSAPP) ----------

# def _send_interakt_otp(phone_no: str, otp: str) -> str:
#     api_key = os.getenv("INTERAKT_API_KEY")  # from Interakt Developer Settings (Secret Key)
#     template_name = os.getenv("INTERAKT_OTP_TEMPLATE_NAME", "login_otp")
#     language = os.getenv("INTERAKT_TEMPLATE_LANGUAGE", "en")
#     country_code = os.getenv("INTERAKT_COUNTRY_CODE", "+91")

#     if not api_key:
#         raise Exception("INTERAKT_API_KEY missing in env")

#     url = "https://api.interakt.ai/v1/public/message/"
#     headers = {
#         "Authorization": f"Basic {api_key}",
#         "Content-Type": "application/json",
#     }

#     payload = {
#         "countryCode": country_code,
#         "phoneNumber": phone_no,   # keep 10-digit if countryCode is +91
#         "type": "Template",
#         "callbackData": "purpose=login_otp",
#         "template": {
#             "name": template_name,
#             "languageCode": language,
#             "bodyValues": [otp],    # must match {{1}} in template body
#         }
#     }

#     resp = requests.post(url, json=payload, headers=headers, timeout=20)
#     if resp.status_code >= 400:
#         raise Exception(f"Interakt API error ({resp.status_code}): {resp.text}")

#     return otp

def _send_interakt_otp(phone_no: str, otp: str) -> str:
    api_key = os.getenv("INTERAKT_API_KEY")
    template_name = os.getenv("INTERAKT_OTP_TEMPLATE_NAME", "login_otp")
    language = os.getenv("INTERAKT_TEMPLATE_LANGUAGE", "en")
    country_code = os.getenv("INTERAKT_COUNTRY_CODE", "+91")

    if not api_key:
        raise Exception("INTERAKT_API_KEY missing in env")

    url = "https://api.interakt.ai/v1/public/message/"
    headers = {
        "Authorization": f"Basic {api_key}",
        "Content-Type": "application/json",
    }

    phone = str(phone_no).replace("+91", "").strip()

    payload = {
    "countryCode": country_code,
    "phoneNumber": phone,
    "type": "Template",
    "callbackData": "purpose=login_otp",
    "template": {
        "name": template_name,
        "languageCode": language,
        "bodyValues": [otp],
        "buttonValues": {
            "0": [otp]   # ✅ button index 0, 1 variable
        }
    }
}

    resp = requests.post(url, json=payload, headers=headers, timeout=20)

    if resp.status_code >= 400:
        raise Exception(f"Interakt API error {resp.status_code}: {resp.text}")

    return otp


# ---------- SMS LIVE (YOUR EXISTING GATEWAY) ----------

def _send_sms_live(phone_no: str, otp: str) -> str:
    message = f"ALOK CRM LOGIN OTP NO.{otp}."

    required_env = [
        "SMS_BASE_URL",
        "SMS_USER",
        "SMS_PASSWORD",
        "SMS_SENDER",
        "SMS_TYPE",
        "SMS_TEMPLATE_ID",
    ]
    missing = [key for key in required_env if not os.getenv(key)]
    if missing:
        raise Exception(f"SMS live mode misconfigured. Missing env: {', '.join(missing)}")

    params = {
        "user": os.getenv("SMS_USER"),
        "password": os.getenv("SMS_PASSWORD"),
        "mobile": phone_no,
        "message": message,
        "sender": os.getenv("SMS_SENDER"),
        "type": os.getenv("SMS_TYPE"),
        "template_id": os.getenv("SMS_TEMPLATE_ID"),
    }

    base_url = os.getenv("SMS_BASE_URL")
    query_string = urllib.parse.urlencode(params)
    full_url = f"{base_url}?{query_string}"

    response = requests.post(
        full_url,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    response.raise_for_status()

    result = (response.text or "").strip()
    if "failed" in result.lower() or "invalid" in result.lower():
        raise Exception(f"SMS API error: {result}")

    return otp


# ---------- PUBLIC SEND FUNCTION ----------

def send_message(phone_no: str, otp: str) -> str:
    """
    SMS_MODE:
      mock -> print OTP to console
      live -> SMS gateway
      interakt -> WhatsApp OTP via Interakt
      interakt_then_sms -> WhatsApp first, fallback to SMS
    """
    mode = _sms_mode()

    if mode == "mock":
        masked_phone = f"***{str(phone_no)[-4:]}" if phone_no else "***"
        logger.info("OTP mock mode enabled for phone %s", masked_phone)
        return otp

    if mode == "interakt":
        return _send_interakt_otp(phone_no, otp)

    if mode == "interakt_then_sms":
        try:
            return _send_interakt_otp(phone_no, otp)
        except Exception as e:
            masked_phone = f"***{str(phone_no)[-4:]}" if phone_no else "***"
            logger.warning("Interakt OTP failed for phone %s: %s", masked_phone, str(e))
            return _send_sms_live(phone_no, otp)

    # default = live
    return _send_sms_live(phone_no, otp)


# ---------- OTP SESSION STORE ----------

def store_otp_session(session_id: str, ecode: str, otp: str, phone_number: str) -> None:
    expiry = datetime.now() + timedelta(minutes=5)
    otp_sessions[session_id] = {
        "ecode": ecode,
        "otp": otp,
        "phone_number": phone_number,
        "created_at": datetime.now(),
        "expires_at": expiry,
        "verified": False,
    }


def verify_otp_session(session_id: str, provided_otp: str) -> Optional[str]:
    if session_id not in otp_sessions:
        return None

    session = otp_sessions[session_id]

    if datetime.now() > session["expires_at"]:
        del otp_sessions[session_id]
        return None

    if session["otp"] == provided_otp:
        session["verified"] = True
        return session["ecode"]

    return None


def cleanup_expired_sessions():
    now = datetime.now()
    expired_sessions = [sid for sid, session in otp_sessions.items() if now > session["expires_at"]]
    for sid in expired_sessions:
        del otp_sessions[sid]                               
