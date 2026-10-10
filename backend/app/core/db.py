from functools import lru_cache

from supabase import Client, create_client

from app.core.settings import settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)