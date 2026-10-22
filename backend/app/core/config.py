from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "change-this-to-a-random-64-char-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/smartaid"

    # Hospital Geodata Provider Configuration
    HOSPITAL_PROVIDER: str = "nominatim"  # Options: "nominatim", "overpass", "local_osm"
    NOMINATIM_API_URL: str = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_USER_AGENT: str = "SmartAidAcademicProject/1.0 (smartaid-project@college.edu)"
    HOSPITAL_TIMEOUT_SECONDS: int = 10
    ENABLE_LOCAL_OSM_FALLBACK: bool = True
    LOCAL_OSM_DATASET_PATH: str = "app/data/osm_hospitals_reference.json"

    # Overpass API (Alternative provider)
    OVERPASS_API_URL: str = "https://overpass-api.de/api/interpreter"
    OVERPASS_FALLBACK_URLS: list[str] = [
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
    ]
    OVERPASS_TIMEOUT_SECONDS: int = 15

    class Config:
        env_file = ".env"

settings = Settings()