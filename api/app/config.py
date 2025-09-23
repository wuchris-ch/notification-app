from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    NTFY_BASE_URL: str = "https://ntfy.sh"
    JWT_SECRET: str = "dev"
    TZ: str = "America/Vancouver"


settings = Settings()  # reads env
