import httpx

from .config import settings


async def send_ntfy(topic: str, title: str, body: str | None = None) -> None:
    url = f"{settings.NTFY_BASE_URL.rstrip('/')}/{topic}"
    async with httpx.AsyncClient(timeout=10) as client:
        await client.post(
            url,
            data=(body or "").encode("utf-8"),
            headers={"Title": title},
        )
