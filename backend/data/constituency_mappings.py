"""
data/constituency_mappings.py
Re-exports everything from the original constituency_mappings.py.
"""
from constituency_mappings import *  # noqa: F401, F403
from constituency_mappings import (
    get_canonical_district, detect_all_mlas_in_text, get_mla_for_constituency,
    get_constituencies_for_district, CONSTITUENCY_TELUGU,
    STATE_LEADERS_HOME_CONSTITUENCY, LOCAL_POLITICIAN_ALIASES,
    classify_article_constituency
)
