"""Rate limiting en memoria para proteger endpoints sensibles (login, leads).

Implementa un limitador por IP con ventana deslizante. Es apropiado para
despliegues de un solo proceso y evita dependencias externas.
"""
import threading
import time
from collections import defaultdict, deque

from fastapi import Request


class SlidingWindowRateLimiter:
    def __init__(self, max_attempts: int, window_seconds: int):
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        """Registra un intento y devuelve True si aún no se superó el límite."""
        now = time.monotonic()
        with self._lock:
            window = self._attempts[key]
            while window and now - window[0] > self.window_seconds:
                window.popleft()
            if len(window) >= self.max_attempts:
                return False
            window.append(now)
            return True

    def reset(self, key: str) -> None:
        with self._lock:
            self._attempts.pop(key, None)


def client_ip(request: Request) -> str:
    """Devuelve la IP del cliente teniendo en cuenta proxies confiables."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# Guardia de login: máximo 5 intentos por IP en 15 minutos.
login_rate_limiter = SlidingWindowRateLimiter(max_attempts=5, window_seconds=900)

# Guardia de formularios públicos (contacto / referidos): máx. 10 envíos por IP/hora.
lead_rate_limiter = SlidingWindowRateLimiter(max_attempts=10, window_seconds=3600)
