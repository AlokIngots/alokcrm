import os
from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.orm import Session
from typing import Optional, List
import jwt
from jwt.exceptions import PyJWTError, ExpiredSignatureError, DecodeError
from datetime import datetime, timedelta
from dotenv import load_dotenv
from services.otp_service import generate_otp, generate_session_id, send_message, store_otp_session, verify_otp_session, cleanup_expired_sessions
from database.db import get_db
from database.tables.users import User, LoginRequest, LoginResponse, OTPVerifyRequest, OTPVerifyResponse, UserResponse
from database.tables.role_permissions import RolePermission

router = APIRouter()

load_dotenv()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "24"))
ALLOW_QUERY_TOKEN = os.getenv("ALLOW_QUERY_TOKEN", "false").strip().lower() == "true"

if not JWT_SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY is required in environment")

def create_access_token(ecode: str) -> str:
    """Create JWT access token"""
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode = {"sub": ecode, "exp": expire}
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_token_to_ecode(jwt_token: str) -> str:
    try:
        payload = jwt.decode(jwt_token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        ecode = payload.get("sub")
        if not ecode:
            raise HTTPException(status_code=401, detail="Invalid token")
        return ecode
    except ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except DecodeError:
        raise HTTPException(status_code=401, detail="Invalid token format")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_user(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Dependency to get current authenticated user from JWT token
    Supports query token for backward compatibility.
    """
    jwt_token = None

    if token and ALLOW_QUERY_TOKEN:
        jwt_token = token
    elif token and not ALLOW_QUERY_TOKEN:
        raise HTTPException(status_code=401, detail="Query token auth is disabled")
    elif authorization:
        try:
            scheme, jwt_token = authorization.split(" ", 1)
            if scheme.lower() != "bearer":
                raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid authorization header format")
    else:
        raise HTTPException(status_code=401, detail="Authorization token required")

    if not jwt_token or jwt_token.strip() == "":
        raise HTTPException(status_code=401, detail="Token is empty")

    ecode = decode_token_to_ecode(jwt_token)
    user = db.query(User).filter(User.ECode == ecode).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user



def format_user_response(user: User) -> dict:
    """Helper function to format user response"""
    return {
        "ECode": user.ECode,
        "Name": user.Name,
        "Grade": user.Grade,
        "Designation": user.Designation,
        "Role": user.Role,
        "ReportingManagerECode": user.ReportingManagerECode,
        "ReportingManagerName": user.reporting_manager.Name if user.reporting_manager else None,
        "PhoneNumber": user.PhoneNumber
    }

@router.post("/login", response_model=LoginResponse)
async def login(login_request: LoginRequest, db: Session = Depends(get_db)):
    """
    Initiate login process by sending OTP to user's phone number
    """
    try:
        cleanup_expired_sessions()

        user = db.query(User).filter(User.ECode == login_request.ECode).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        if not user.PhoneNumber:
            raise HTTPException(status_code=400, detail="User does not have a phone number registered")

        otp = generate_otp()
        session_id = generate_session_id()

        # Send OTP (Interakt / SMS depending on SMS_MODE)
        try:
            send_message(user.PhoneNumber, otp)
        except Exception as e:
            # ✅ return full error back to Postman/UI so you can see Interakt error
            raise HTTPException(status_code=500, detail=f"OTP_SEND_FAIL: {repr(e)}")

        store_otp_session(session_id, user.ECode, otp, user.PhoneNumber)

        return LoginResponse(
            message=f"OTP sent to phone number ending with {user.PhoneNumber[-4:]}",
            session_id=session_id
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {repr(e)}")


# @router.post("/login", response_model=LoginResponse)
# async def login(login_request: LoginRequest, db: Session = Depends(get_db)):
#     """
#     Initiate login process by sending OTP to user's phone number
#     """
#     try:
#         # Clean up expired sessions
#         cleanup_expired_sessions()
        
#         # Find user by ECode
#         user = db.query(User).filter(User.ECode == login_request.ECode).first()
#         if not user:
#             raise HTTPException(status_code=404, detail="User not found")
        
#     # Check if user has a phone number
#     if not user.PhoneNumber:
#         raise HTTPException(status_code=400, detail="User does not have a phone number registered")
    
#     # Generate OTP and session ID
#     otp = generate_otp()
#     session_id = generate_session_id()

#     # Send OTP (Interakt / SMS depending on SMS_MODE)
#     try:
#         send_message(user.PhoneNumber, otp)
#     except Exception as e:
#         # shows exact Interakt error in terminal
#         print("OTP_SEND_FAIL:", repr(e))
#         # returns exact error to frontend/Postman
#         raise HTTPException(status_code=500, detail=str(e))

#     # Store OTP session
#     store_otp_session(session_id, user.ECode, otp, user.PhoneNumber)
    
#     return LoginResponse(
#         message=f"OTP sent to phone number ending with {user.PhoneNumber[-4:]}",
#         session_id=session_id
#     )
    
# except HTTPException:
#     raise
# except Exception as e:
#     raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

# @router.post("/verify-otp", response_model=OTPVerifyResponse)
# async def verify_otp(verify_request: OTPVerifyRequest, db: Session = Depends(get_db)):
#     """
#     Verify OTP and return access token
#     """
#     try:
#         # Verify OTP
#         ecode = verify_otp_session(verify_request.session_id, verify_request.otp)
#         if not ecode:
#             raise HTTPException(status_code=400, detail="Invalid or expired OTP")
        
#         # Get user details
#         user = db.query(User).filter(User.ECode == ecode).first()
#         if not user:
#             raise HTTPException(status_code=404, detail="User not found")
        
#         # Create access token
#         access_token = create_access_token(ecode)
        
#         # Format user response
#         user_response = format_user_response(user)
        
#         return OTPVerifyResponse(
#             message="Login successful",
#             access_token=access_token,
#             user=user_response
#         )
        
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"OTP verification failed: {str(e)}")

@router.post("/verify-otp", response_model=OTPVerifyResponse)
async def verify_otp(verify_request: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Verify OTP and return access token
    """
    try:
        ecode = verify_otp_session(verify_request.session_id, verify_request.otp)
        if not ecode:
            raise HTTPException(status_code=400, detail="Invalid or expired OTP")

        user = db.query(User).filter(User.ECode == ecode).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        access_token = create_access_token(ecode)
        user_response = format_user_response(user)

        return OTPVerifyResponse(
            message="Login successful",
            access_token=access_token,
            user=user_response
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OTP verification failed: {str(e)}")



@router.get("/me", response_model=UserResponse)
async def get_current_user_endpoint(
    token: Optional[str] = Query(None),  # Support query parameter
    authorization: Optional[str] = Header(None),  # Support Authorization header
    db: Session = Depends(get_db)
):
    """
    Get current user details using access token
    Supports both query parameter (?token=...) and Authorization header (Bearer ...)
    """
    # Try to get token from query parameter first, then Authorization header
    jwt_token = None
    
    if token and ALLOW_QUERY_TOKEN:
        # Token provided as query parameter
        jwt_token = token
    elif token and not ALLOW_QUERY_TOKEN:
        raise HTTPException(status_code=401, detail="Query token auth is disabled")
    elif authorization:
        # Token provided in Authorization header
        try:
            scheme, jwt_token = authorization.split(" ", 1)  # Split only on first space
            if scheme.lower() != "bearer":
                raise HTTPException(status_code=401, detail="Invalid authentication scheme")
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid authorization header format")
    else:
        raise HTTPException(status_code=401, detail="Token required either as query parameter or Authorization header")
    
    # Validate token is not empty
    if not jwt_token or jwt_token.strip() == "":
        raise HTTPException(status_code=401, detail="Token is empty")
    
    try:
        ecode = decode_token_to_ecode(jwt_token)

        # Get user
        user = db.query(User).filter(User.ECode == ecode).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return format_user_response(user)

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get user: {str(e)}")

@router.get("/permissions")
async def get_user_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current user's permissions based on their role
    """
    if not current_user.Role:
        raise HTTPException(status_code=400, detail="User has no role assigned")
    
    # Get role permissions from database
    role_permissions = db.query(RolePermission).filter(
        RolePermission.role == current_user.Role
    ).first()
    
    if not role_permissions:
        # Return empty permissions if role not found in permissions table
        return {
            "permissions": {
                "deals": {
                    "create": False,
                    "edit": False,
                    "reassign": False
                },
                "accounts": {
                    "create": False,
                    "edit": False,
                    "blacklist": False
                },
                "users": {
                    "create": False,
                    "edit": False
                },
                "contacts": {
                    "create": False,
                    "edit": False
                },
                "duplicate_deals": {
                    "approve": False
                }
            }
        }
    
    # Format permissions in the requested structure
    return {
        "permissions": {
            "deals": {
                "create": role_permissions.deals_create,
                "edit": role_permissions.deals_edit,
                "reassign": role_permissions.deals_reassign
            },
            "accounts": {
                "create": role_permissions.accounts_create,
                "edit": role_permissions.accounts_edit,
                "blacklist": role_permissions.accounts_blacklist
            },
            "users": {
                "create": role_permissions.users_create,
                "edit": role_permissions.users_edit
            },
            "contacts": {
                "create": role_permissions.contacts_create,
                "edit": role_permissions.contacts_edit
            },
            "duplicate_deals": {
                "approve": role_permissions.duplicate_deals_approve
            }
        }
    }

@router.get("/roles", response_model=List[str])
async def get_all_roles(db: Session = Depends(get_db)):
    """
    Get all distinct roles from the RolePermissions table
    """
    try:
        roles = db.query(RolePermission.role).distinct().all()
        role_list = [role[0] for role in roles]
        return role_list
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching roles: {str(e)}")
