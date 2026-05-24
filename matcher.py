"""
matcher.py — CampusAI Lost & Found ML Matching Engine (v2)
===========================================================
Improvements over v1:
  • Separate TF-IDF vectors for title vs description (title weighted 2×)
  • Brand exact-match hard boost (+0.15)
  • Partial location scoring with campus-specific synonym map
  • Date window extended to 21 days with sigmoid decay (not linear)
  • Color extraction uses an expanded 40-word palette
  • Category synonym mapping (e.g. "bag" == "backpack")
  • Final score clamped to [0, 1] before percentage conversion
  • Configurable per-call min_score threshold
  • Detailed reason list with score breakdown for UI display

Install:  pip install scikit-learn
"""

import re
import math
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── Weights (must sum ≤ 1.0; remainder is implicit floor) ──
W_TITLE    = 0.28   # TF-IDF on title only (high signal)
W_DESC     = 0.22   # TF-IDF on full description
W_CATEGORY = 0.18   # category match (exact or synonym)
W_COLOR    = 0.12   # colour-word overlap
W_DATE     = 0.10   # temporal proximity
W_LOCATION = 0.06   # location overlap
W_BRAND    = 0.04   # brand/make exact match bonus

MATCH_THRESHOLD = 0.32   # minimum weighted score to surface
MAX_MATCHES     = 30

# ── Campus-specific location synonyms ──────────────────────
LOC_SYNONYMS = {
    "lib": "library", "canteen": "cafeteria", "cafeteria": "canteen",
    "admin": "administration", "cse": "computer science",
    "ece": "electronics", "mech": "mechanical",
    "jhub": "j hub", "j-hub": "j hub",
    "crc": "career resource centre",
    "hostel": "residence hall", "residence": "hostel",
    "sports": "sports complex", "gym": "sports complex",
    "auditorium": "audi", "audi": "auditorium",
    "principal": "principal office",
}

# ── Category synonym groups ─────────────────────────────────
CAT_GROUPS = [
    {"bag", "backpack", "bags", "accessories", "luggage", "sack", "tote"},
    {"electronics", "electronic", "device", "gadget", "phone", "mobile",
     "laptop", "charger", "earphones", "headphones", "earbuds", "tablet"},
    {"document", "documents", "id", "card", "cards", "identity",
     "certificate", "pass", "passport", "licence", "license"},
    {"clothing", "clothes", "shirt", "jacket", "coat", "dress",
     "shoes", "footwear", "cap", "hat", "hoodie", "sweater"},
    {"key", "keys", "keychain", "lanyard"},
    {"book", "books", "stationery", "notebook", "notes",
     "pen", "pencil", "calculator", "folder"},
]

# ── Expanded colour vocabulary ──────────────────────────────
COLOR_WORDS = {
    "red","blue","green","yellow","black","white","grey","gray",
    "brown","pink","purple","orange","navy","silver","gold","beige",
    "maroon","violet","cyan","cream","dark","light","bright","pale",
    "deep","tan","khaki","olive","teal","indigo","magenta","coral",
    "turquoise","scarlet","crimson","charcoal","ivory","lemon","mint",
    "rose","peach","azure","cobalt",
}


# ── Text helpers ────────────────────────────────────────────

def _strip_emoji(text: str) -> str:
    return re.sub(
        r"[\U00010000-\U0010ffff\U0001F600-\U0001F64F"
        r"\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        r"\u2600-\u26FF\u2700-\u27BF]",
        "", text, flags=re.UNICODE,
    )


def _clean(text: str) -> str:
    text = _strip_emoji(text or "")
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()


def _tokens(text: str) -> set:
    return set(_clean(text).split()) - {"", "a", "an", "the", "and", "or", "of", "in", "at"}


def _normalise_location(text: str) -> str:
    tokens = _clean(text).split()
    return " ".join(LOC_SYNONYMS.get(t, t) for t in tokens)


def _cat_group(cat: str) -> int | None:
    tokens = _tokens(cat)
    for i, group in enumerate(CAT_GROUPS):
        if tokens & group:
            return i
    return None


# ── Component scorers ───────────────────────────────────────

def _category_score(lost: dict, found: dict) -> float:
    lc = _clean(lost.get("category", ""))
    fc = _clean(found.get("category", ""))
    if not lc or not fc:
        return 0.0
    if lc == fc:
        return 1.0
    # synonym-group match
    lg, fg = _cat_group(lc), _cat_group(fc)
    if lg is not None and lg == fg:
        return 0.85
    # token overlap
    lt, ft = _tokens(lc), _tokens(fc)
    if not lt or not ft:
        return 0.0
    return min(len(lt & ft) / max(len(lt | ft), 1) * 1.6, 1.0)


def _color_score(lost: dict, found: dict) -> float:
    def _extract_colors(item: dict) -> set:
        blob = " ".join([
            item.get("color", ""),
            item.get("title", ""),
            item.get("description", ""),
        ])
        return _tokens(blob) & COLOR_WORDS

    lc, fc = _extract_colors(lost), _extract_colors(found)
    if not lc or not fc:
        return 0.0
    intersection = lc & fc
    union        = lc | fc
    return len(intersection) / max(len(union), 1)


def _location_score(lost: dict, found: dict) -> float:
    lt = _tokens(_normalise_location(lost.get("location", "")))
    ft = _tokens(_normalise_location(found.get("location", "")))
    if not lt or not ft:
        return 0.0
    overlap = len(lt & ft)
    # give extra weight if core campus landmark matches
    return min(overlap / max(len(lt | ft), 1) * 2.2, 1.0)


def _date_score(lost: dict, found: dict) -> float:
    """Sigmoid-like decay: 1.0 same day, ~0 at 21 days."""
    fmt = "%Y-%m-%d"
    try:
        ld = datetime.strptime((lost.get("date")  or "")[:10], fmt)
        fd = datetime.strptime((found.get("date") or "")[:10], fmt)
        diff = abs((ld - fd).days)
        # sigmoid: score = 1 / (1 + e^((diff-3)/3))
        return round(1.0 / (1.0 + math.exp((diff - 3) / 3)), 4)
    except Exception:
        return 0.0


def _brand_score(lost: dict, found: dict) -> float:
    lb = _clean(lost.get("brand", ""))
    fb = _clean(found.get("brand", ""))
    if not lb or not fb:
        return 0.0
    if lb == fb:
        return 1.0
    # one token overlap (e.g. "north face" vs "northface")
    lt, ft = _tokens(lb), _tokens(fb)
    return 0.6 if lt & ft else 0.0


def _build_text(item: dict, field: str = "all") -> str:
    if field == "title":
        return _clean(item.get("title", ""))
    if field == "desc":
        return _clean(" ".join([
            item.get("description", ""),
            item.get("brand", ""),
        ]))
    # "all" — full soup for vocabulary building
    return _clean(" ".join([
        item.get("title", ""),
        item.get("description", ""),
        item.get("brand", ""),
        item.get("category", ""),
        item.get("color", ""),
    ]))


def _confidence_label(score: float) -> str:
    if score >= 0.78:
        return "🔥 Strong Match"
    if score >= 0.58:
        return "⚡ Good Match"
    if score >= 0.40:
        return "📌 Possible Match"
    return "🔍 Weak Signal"


def _build_reasons(
    lost: dict, found: dict,
    cat: float, color: float, loc: float,
    date: float, brand: float,
    title_sim: float, desc_sim: float,
) -> list:
    r = []
    if title_sim >= 0.35:
        r.append("Title description matches")
    if desc_sim  >= 0.30:
        r.append("Detailed description similar")
    if cat   >= 0.80:
        r.append("Same category")
    elif cat >= 0.40:
        r.append("Related category")
    if color >= 0.50:
        r.append("Color match")
    elif color >= 0.25:
        r.append("Similar color")
    if loc   >= 0.50:
        r.append("Same location")
    elif loc >= 0.25:
        r.append("Nearby location")
    if date  >= 0.75:
        r.append("Same day")
    elif date >= 0.40:
        r.append("Close dates")
    if brand >= 0.60:
        r.append("Brand / make match")
    return r or ["General similarity"]


# ── Public API ──────────────────────────────────────────────

def find_matches(lost_items: list, found_items: list, min_score: int = 32) -> list:
    """
    Compare every lost item against every found item.

    Returns a list of match dicts sorted by score descending.
    Each dict contains:
        lost_id, found_id, score (0–100 int), label, reasons,
        lost_title, found_title, lost_location, found_location,
        lost_date, found_date, lost_category, found_category,
        lost_image, found_image, lost_locker, found_locker
    """
    if not lost_items or not found_items:
        return []

    all_items = lost_items + found_items
    n_lost    = len(lost_items)

    # Build two separate TF-IDF spaces: title and desc
    title_texts = [_build_text(i, "title") for i in all_items]
    desc_texts  = [_build_text(i, "desc")  for i in all_items]

    def _fit(texts):
        non_empty = [t for t in texts if t.strip()]
        if not non_empty:
            return None
        vec = TfidfVectorizer(
            ngram_range=(1, 2),
            min_df=1,
            sublinear_tf=True,
            analyzer="word",
        )
        return vec.fit_transform(texts)

    title_mat = _fit(title_texts)
    desc_mat  = _fit(desc_texts)

    results = []

    for li, lost in enumerate(lost_items):
        for fi, found in enumerate(found_items):

            # ── Rule-based scores ──
            cat   = _category_score(lost, found)
            color = _color_score(lost, found)
            loc   = _location_score(lost, found)
            date  = _date_score(lost, found)
            brand = _brand_score(lost, found)

            # ── TF-IDF text scores ──
            def _sim(mat, row_a, row_b):
                if mat is None:
                    return 0.0
                return float(cosine_similarity(mat[row_a], mat[row_b])[0][0])

            title_sim = _sim(title_mat, li, n_lost + fi)
            desc_sim  = _sim(desc_mat,  li, n_lost + fi)

            # ── Weighted combination ──
            final = (
                W_TITLE    * title_sim +
                W_DESC     * desc_sim  +
                W_CATEGORY * cat       +
                W_COLOR    * color     +
                W_DATE     * date      +
                W_LOCATION * loc       +
                W_BRAND    * brand
            )
            final = min(max(final, 0.0), 1.0)

            score_pct = round(final * 100)
            if score_pct < min_score:
                continue

            results.append({
                "lost_id"       : lost["id"],
                "found_id"      : found["id"],
                "score"         : score_pct,
                "label"         : _confidence_label(final),
                "reasons"       : _build_reasons(
                                      lost, found, cat, color, loc,
                                      date, brand, title_sim, desc_sim),
                "lost_title"    : lost.get("title", ""),
                "found_title"   : found.get("title", ""),
                "lost_location" : lost.get("location", ""),
                "found_location": found.get("location", ""),
                "lost_date"     : lost.get("date", ""),
                "found_date"    : found.get("date", ""),
                "lost_category" : lost.get("category", ""),
                "found_category": found.get("category", ""),
                "lost_image"    : lost.get("image_path", ""),
                "found_image"   : found.get("image_path", ""),
                # locker number on the found item (admin can set it)
                "found_locker"  : found.get("locker_number", ""),
                "lost_locker"   : lost.get("locker_number", ""),
            })

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:MAX_MATCHES]


def find_matches_for_item(item: dict, candidates: list, min_score: int = 32) -> list:
    """
    Find matches for a single newly posted item against a list of candidates.
    item       : the new lost or found item dict
    candidates : list of items of the opposite type
    """
    if item.get("type") == "lost":
        return find_matches([item], candidates, min_score)
    else:
        return find_matches(candidates, [item], min_score)