# import os
# from pydantic_settings import BaseSettings

# class DatabaseSettings(BaseSettings):
#     # MySQL configuration for localhost
#     database_url: str = ""
    
#     echo_sql: bool = True  # Set to False in production
    
#     # MySQL specific settings
#     mysql_charset: str = "utf8mb4"
#     mysql_collation: str = "utf8mb4_unicode_ci"
    
#     # Additional fields that might be in .env file
#     debug: bool = True
    
#     class Config:
#         env_file = ".env"
#         case_sensitive = False
#         # Allow extra fields to prevent validation errors
#         extra = "ignore"

# # Create settings instance
# settings = DatabaseSettings()

# # Database configuration
# DATABASE_URL = settings.database_url
# ECHO_SQL = settings.echo_sql
# MYSQL_CHARSET = settings.mysql_charset
# MYSQL_COLLATION = settings.mysql_collation
# from pydantic_settings import BaseSettings

# class DatabaseSettings(BaseSettings):
#     # SQLite file in backend folder
#     database_url: str = "sqlite:///./alok_crm.db"
#     echo_sql: bool = True
#     debug: bool = True

#     class Config:
#         env_file = ".env"
#         case_sensitive = False
#         extra = "ignore"

# settings = DatabaseSettings()

# DATABASE_URL = settings.database_url
# ECHO_SQL = settings.echo_sql


import os
from pydantic_settings import BaseSettings

class DatabaseSettings(BaseSettings):
    database_url: str = "sqlite:///./database.db"
    echo_sql: bool = True
    debug: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"

settings = DatabaseSettings()

DATABASE_URL = settings.database_url
ECHO_SQL = settings.echo_sql