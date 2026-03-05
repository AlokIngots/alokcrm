from database.tables.users import User
from services.business_rules import ADMIN_ROLES, SALES_ROLES


def is_admin_user(user: User) -> bool:
    role = (user.Role or "").strip()
    return role in ADMIN_ROLES


def is_sales_user(user: User) -> bool:
    role = (user.Role or "").strip()
    return role in SALES_ROLES
