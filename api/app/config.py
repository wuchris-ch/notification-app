from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    NTFY_BASE_URL: str = "https://ntfy.sh"
    JWT_SECRET: str = "dev"
    TZ: str = "America/Vancouver"
    OPENROUTER_API_KEY: str = ""
    
    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra environment variables


settings = Settings()  # reads env
