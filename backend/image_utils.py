"""
Story pictures. Used by the crawler (publisher RSS entries) and by a page-level fallback that reads the
article page's own og:image. Only real pictures the publisher supplies are stored; nothing is generated.
"""
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin

import httpx

logger = logging.getLogger("nayak.images")

_META_TAG = re.compile(r"<meta\b[^>]*>", re.I)
_IMG_SRC = re.compile(r"<img\b[^>]*?\bsrc\s*=\s*[\"']([^\"']+)[\"']", re.I)
_SKIP = re.compile(r"logo|favicon|placeholder|default[-_]?image|sprite|blank|1x1|pixel", re.I)
_UNFETCHABLE_HOSTS = ("news.google.com", "google.com")


def _attr(tag: str, name: str) -> Optional[str]:
    m = re.search(rf"\b{name}\s*=\s*[\"']([^\"']*)[\"']", tag, re.I)
    return m.group(1).strip() if m else None


def clean_image_url(url: Optional[str], base: str = "") -> Optional[str]:
    if not url:
        return None
    url = url.strip()
    if url.startswith("//"):
        url = "https:" + url
    elif base and not url.lower().startswith("http"):
        url = urljoin(base, url)
    if not url.lower().startswith("http") or len(url) > 600 or _SKIP.search(url):
        return None
    return url


def image_from_entry(entry: Any, raw_summary: str = "", link: str = "") -> Optional[str]:
    """Picture carried by an RSS/Atom entry itself (media tags, enclosures, or the first <img> in the summary)."""
    for key in ("media_thumbnail", "media_content"):
        for m in getattr(entry, key, None) or []:
            u = clean_image_url(m.get("url"), link)
            if u:
                return u
    for e in getattr(entry, "enclosures", None) or []:
        if str(e.get("type", "")).startswith("image"):
            u = clean_image_url(e.get("href") or e.get("url"), link)
            if u:
                return u
    for l in getattr(entry, "links", None) or []:
        if str(l.get("type", "")).startswith("image"):
            u = clean_image_url(l.get("href"), link)
            if u:
                return u
    m = _IMG_SRC.search(raw_summary or "")
    return clean_image_url(m.group(1), link) if m else None


def image_from_html(html: str, base_url: str) -> Optional[str]:
    for tag in _META_TAG.findall(html[:250000]):
        prop = (_attr(tag, "property") or _attr(tag, "name") or "").lower()
        if prop in ("og:image", "og:image:url", "og:image:secure_url", "twitter:image", "twitter:image:src"):
            u = clean_image_url(_attr(tag, "content"), base_url)
            if u:
                return u
    return None


def fetch_page_image(client: httpx.Client, url: str) -> Optional[str]:
    if not url or any(h in url for h in _UNFETCHABLE_HOSTS):
        return None
    try:
        r = client.get(url, timeout=7.0, follow_redirects=True,
                       headers={"User-Agent": "Mozilla/5.0 (compatible; NayakBot/1.0)", "Accept": "text/html"})
        if r.status_code != 200 or "html" not in r.headers.get("content-type", "html"):
            return None
        return image_from_html(r.text, str(r.url))
    except Exception:
        return None


def _has_image(cluster: Dict[str, Any]) -> bool:
    return any(isinstance(s, dict) and s.get("image_url") for s in cluster.get("sources", []))


def enrich_clusters(clusters: List[Dict[str, Any]], max_fetch: int = 120, workers: int = 8) -> int:
    """Fill a missing picture from the publisher page of the first fetchable source. Capped so one cycle stays fast."""
    todo = []
    for c in clusters:
        if _has_image(c):
            continue
        for s in c.get("sources", []):
            if isinstance(s, dict) and s.get("url") and not any(h in s["url"] for h in _UNFETCHABLE_HOSTS):
                todo.append((c, s))
                break
        if len(todo) >= max_fetch:
            break
    if not todo:
        return 0
    found = 0
    with httpx.Client() as client, ThreadPoolExecutor(max_workers=workers) as pool:
        for (c, s), img in zip(todo, pool.map(lambda cs: fetch_page_image(client, cs[1]["url"]), todo)):
            if img:
                s["image_url"] = img
                found += 1
    logger.info(f"Story pictures: {found} found from {len(todo)} pages")
    return found
