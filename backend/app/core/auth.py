import time

import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.db import get_client

bearer = HTTPBearer(auto_error=False)

_CACHE_TTL = 60
_cache: dict[str, tuple[str, float]] = {}


def current_user_id(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> str:
    if creds is None or not creds.credentials:
        raise HTTPException(401, "Missing bearer token.")
    token = creds.credentials

    now = time.monotonic()
    hit = _cache.get(token)
    if hit and hit[1] > now:
        return hit[0]

    res = None
    for attempt in range(3):
        try:
            res = get_client().auth.get_user(token)
            break
        except httpx.TransportError:
            if attempt == 2:
                raise HTTPException(503, "Auth service unreachable, try again.")
            time.sleep(0.3)
        except Exception:
            raise HTTPException(401, "Invalid or expired token.")

    if res is None or res.user is None:
        raise HTTPException(401, "Invalid or expired token.")

    user_id = str(res.user.id)
    if len(_cache) > 500:
        _cache.clear()
    _cache[token] = (user_id, now + _CACHE_TTL)
    return user_id