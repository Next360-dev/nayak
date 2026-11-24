"""
api/routes/translation.py
POST /api/translate
"""

from fastapi import APIRouter
from app.services import translation_service

router = APIRouter()


@router.post("/api/translate")
def translate_endpoint(payload: dict):
    headline = payload.get("headline", "")
    summary = payload.get("summary", "")
    text = payload.get("text", "")
    target_lang = payload.get("target_lang")

    res = {}
    if headline:
        h_res = translation_service.translate_text(headline, target_lang)
        res["translated_headline"] = h_res["translated_text"]
        res["source_lang"] = h_res["source_lang"]
        res["target_lang"] = h_res["target_lang"]
    if summary:
        s_target = res.get("target_lang", target_lang)
        s_res = translation_service.translate_text(summary, s_target)
        res["translated_summary"] = s_res["translated_text"]
        if "source_lang" not in res:
            res["source_lang"] = s_res["source_lang"]
            res["target_lang"] = s_res["target_lang"]
    if text and not headline and not summary:
        t_res = translation_service.translate_text(text, target_lang)
        res["translated_text"] = t_res["translated_text"]
        res["source_lang"] = t_res["source_lang"]
        res["target_lang"] = t_res["target_lang"]

    return {"status": "success", "data": res}
