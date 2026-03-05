# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
# ¸

# # Create SQLAlchemy engine with MySQL optimizations
# engine = create_engine(
#     DATABASE_URL,
#     echo=ECHO_SQL,
#     pool_pre_ping=True,  # Verify connections before use
#     pool_recycle=3600,   # Recycle connections every hour
#     connect_args={
#         "charset": "utf8mb4",
#         "use_unicode": True,
#         "autocommit": False
#     }
# )

# # Create SessionLocal class
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# # Create Base class for models
# Base = declarative_base()

# # Dependency to get database session
# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()
# from sqlalchemy import create_engine
# from sqlalchemy.ext.declarative import declarative_base
# from sqlalchemy.orm import sessionmaker
# from .db_config import DATABASE_URL, ECHO_SQL

# # Create SQLAlchemy engine with MySQL optimizations
# engine = create_engine(
#     DATABASE_URL,
#     echo=ECHO_SQL,
#     pool_pre_ping=True,  # Verify connections before use
#     pool_recycle=3600,   # Recycle connections every hour
#     connect_args={
#         "charset": "utf8mb4",
#         "use_unicode": True,
#         "autocommit": False
#     }
# )

# # Create SessionLocal class
# SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# # Create Base class for models
# Base = declarative_base()

# # Dependency to get database session
# def get_db():
#     db = SessionLocal()
#     try:
#         yield db
#     finally:
#         db.close()

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from .db_config import DATABASE_URL, ECHO_SQL


# # Get values from .env via settings
# DATABASE_URL = settings.database_url
# ECHO_SQL = settings.echo_sql

# Handle SQLite separately
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Create engine
engine = create_engine(
    DATABASE_URL,
    echo=ECHO_SQL,
    connect_args=connect_args
)

# Session + Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()



def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()