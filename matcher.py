"""
matcher.py  —  Improved TF-IDF + Fuzzy + Rule-based + Image matching

Key improvements over v1:
  1. Dual TF-IDF: word-level (1-3 gram) + character-level (3-5 gram) for typo resilience
  2. RapidFuzz token_sort + partial_ratio for reordering and substring handling
  3. Adaptive scoring: colour/location DIFFERENCES now PENALISE the score
  4. Semantic colour grouping: navy ≈ blue, crimson ≈ red, etc.
  5. Exponential date decay (not linear) — 1-day diff scores very high, 14+ days near zero
  6. Brand exact-match bonus and substring bonus
  7. Confidence tiers with sharper separation
  8. Deduplication of near-identical match pairs
  9. All edge-cases (empty fields) handled with safe fallbacks
 10. College location PROXIMITY MAP — nearby blocks score higher than distant ones
 11. PIL-based local image similarity as Gemini fallback (color histogram + edge)
 12. Tiebreaker system — same-score items are ranked by secondary signals
"""

import re
import math
import os
import base64
import json
import logging
from datetime import datetime
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

# ── RapidFuzz (soft dependency) ──────────────────────────────
try:
    from rapidfuzz import fuzz as _rfuzz
    _RAPIDFUZZ = True
except ImportError:
    _RAPIDFUZZ = False
    logging.warning("matcher.py: rapidfuzz not installed — fuzzy matching degraded. pip install rapidfuzz")

# ── PIL / Pillow (soft dependency for local image comparison) ─
try:
    from PIL import Image
    import io
    _PIL_AVAILABLE = True
except ImportError:
    _PIL_AVAILABLE = False
    logging.warning("matcher.py: Pillow not installed — local image matching disabled. pip install Pillow")

# ── Gemini (soft dependency) ─────────────────────────────────
try:
    import google.generativeai as genai
    _gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if _gemini_key:
        genai.configure(api_key=_gemini_key)
        _GEMINI_AVAILABLE = True
    else:
        _GEMINI_AVAILABLE = False
        logging.warning("matcher.py: GEMINI_API_KEY not set — using local image matching instead.")
except ImportError:
    _GEMINI_AVAILABLE = False
    logging.warning("matcher.py: google-generativeai not installed — using local image matching instead.")


# ════════════════════════════════════════════════════════════
#  CONFIGURATION & WEIGHTS
# ════════════════════════════════════════════════════════════

MATCH_THRESHOLD = 30   # minimum score (0-100) to include in results
MAX_MATCHES     = 30

# ── Text-only weights (must sum to 1.0) ──────────────────────
W_TEXT_TFIDF_WORD = 0.22
W_TEXT_TFIDF_CHAR = 0.10
W_TEXT_FUZZY_SORT = 0.13
W_TEXT_FUZZY_PART = 0.10
W_CATEGORY        = 0.18
W_COLOR           = 0.10
W_DATE            = 0.08
W_LOCATION        = 0.05
W_BRAND           = 0.04

# ── Image-enhanced weights ────────────────────────────────────
W_IMAGE               = 0.30
W_TEXT_TFIDF_WORD_IMG = 0.16
W_TEXT_TFIDF_CHAR_IMG = 0.07
W_TEXT_FUZZY_SORT_IMG = 0.09
W_TEXT_FUZZY_PART_IMG = 0.07
W_CATEGORY_IMG        = 0.12
W_COLOR_IMG           = 0.05
W_DATE_IMG            = 0.05
W_LOCATION_IMG        = 0.05
W_BRAND_IMG           = 0.04

# ── Penalty caps ──────────────────────────────────────────────
COLOR_MISMATCH_PENALTY    = 0.08
LOCATION_MISMATCH_PENALTY = 0.05
DATE_FAR_PENALTY          = 0.06


# ════════════════════════════════════════════════════════════
#  COLLEGE LOCATION PROXIMITY MAP
#  Each location maps to a "zone" (integer).
#  Locations in the same zone score 1.0,
#  adjacent zones score 0.6,
#  far zones score 0.2,
#  completely unknown → neutral 0.0
# ════════════════════════════════════════════════════════════

# Zone definitions — group physically nearby campus locations together
CAMPUS_ZONES = {
    # Zone 0 — Academic Core (main teaching blocks)
    0: [
        "cse department", "cse", "computer science",
        "ece department", "ece", "electronics",
        "eee department", "eee", "electrical",
        "civil department", "civil",
        "mechanical department", "mechanical",
        "chemical department", "chemical",
        "mca", "mba",
    ],
    # Zone 1 — Admin & Official buildings
    1: [
        "administrative building", "admin", "administration",
        "principal office", "principal",
        "registrar", "university examination branch", "exam branch",
        "accounts", "finance office",
    ],
    # Zone 2 — Student Activity Hub
    2: [
        "j hub", "jhub", "j-hub",
        "auditorium", "audi",
        "crc", "career resource centre", "career resource center",
        "placement cell",
    ],
    # Zone 3 — Library & Study
    3: [
        "library", "lib",
        "reading room", "study hall",
        "digital library",
    ],
    # Zone 4 — Canteen & Food
    4: [
        "canteen", "cafeteria", "food court",
        "mess", "dining hall", "tuck shop",
    ],
    # Zone 5 — Sports & Recreation
    5: [
        "sports complex", "sports", "gym", "gymnasium",
        "ground", "football ground", "cricket ground",
        "basketball court", "volleyball court",
        "swimming pool",
    ],
    # Zone 6 — Hostel & Residences
    6: [
        "hostel", "boys hostel", "girls hostel",
        "residence", "dormitory", "dorm",
        "pg", "paying guest",
    ],
    # Zone 7 — Transport & Entry/Exit
    7: [
        "bus stop", "bus stand", "transport",
        "main gate", "gate", "parking",
        "entrance", "security",
    ],
    # Zone 8 — Medical
    8: [
        "medical center", "medical", "health center",
        "dispensary", "clinic", "doctor", "hospital",
        "infirmary",
    ],
}

# Adjacency map — which zones are physically close to each other
# (zone_a, zone_b) pairs that are adjacent
ADJACENT_ZONES = {
    (0, 1), (0, 2), (0, 3),   # Academic near Admin, Hub, Library
    (1, 2), (1, 3),            # Admin near Hub, Library
    (2, 3), (2, 4),            # Hub near Library, Canteen
    (3, 4),                    # Library near Canteen
    (4, 5),                    # Canteen near Sports
    (5, 6),                    # Sports near Hostel
    (6, 7),                    # Hostel near Transport/Gate
    (0, 7),                    # Academic near Gate (students commute)
    (1, 8),                    # Admin near Medical
    (4, 6),                    # Canteen near Hostel (students eat)
}

# Build reverse lookup: keyword → zone
_LOC_TO_ZONE: dict[str, int] = {}
for _zone_id, _keywords in CAMPUS_ZONES.items():
    for _kw in _keywords:
        _LOC_TO_ZONE[_kw] = _zone_id


def _get_zone(location_text: str) -> int | None:
    """Return the zone for a location string, or None if unknown."""
    cleaned = _clean(location_text)
    # Direct lookup
    if cleaned in _LOC_TO_ZONE:
        return _LOC_TO_ZONE[cleaned]
    # Partial match — check if any keyword appears in the location text
    for kw, zone in _LOC_TO_ZONE.items():
        if kw in cleaned or cleaned in kw:
            return zone
    return None


def _zones_are_adjacent(z1: int, z2: int) -> bool:
    return (z1, z2) in ADJACENT_ZONES or (z2, z1) in ADJACENT_ZONES


def _location_proximity_score(lost_loc: str, found_loc: str) -> float:
    """
    Returns a proximity score 0.0–1.0 based on campus zone map.
      Same zone      → 1.0
      Adjacent zones → 0.6
      Far zones      → 0.15
      Unknown zone   → 0.0 (neutral, no penalty)
    """
    if not lost_loc or not found_loc:
        return 0.0
    z1 = _get_zone(lost_loc)
    z2 = _get_zone(found_loc)
    if z1 is None or z2 is None:
        return 0.0
    if z1 == z2:
        return 1.0
    if _zones_are_adjacent(z1, z2):
        return 0.6
    return 0.15


# ════════════════════════════════════════════════════════════
#  VOCABULARY LOOKUPS
# ════════════════════════════════════════════════════════════

COLOR_GROUPS = [
    {"blue", "navy", "cobalt", "azure", "indigo", "teal", "cyan", "royal", "steel", "denim"},
    {"red", "crimson", "scarlet", "maroon", "rose", "coral", "ruby", "wine", "bordeaux"},
    {"green", "olive", "mint", "lime", "emerald", "forest", "sage", "khaki"},
    {"yellow", "gold", "amber", "lemon", "mustard", "cream", "ivory", "beige"},
    {"orange", "peach", "apricot", "tangerine"},
    {"purple", "violet", "lavender", "mauve", "plum", "magenta"},
    {"black", "charcoal", "ebony", "onyx", "jet"},
    {"white", "pearl", "snow", "chalk", "off-white"},
    {"grey", "gray", "silver", "ash", "smoke"},
    {"brown", "tan", "chocolate", "coffee", "caramel", "walnut"},
    {"pink", "blush", "fuchsia", "hot pink", "dusty pink"},
]

COLOR_WORDS = {c for group in COLOR_GROUPS for c in group}

_COLOR_GROUP_MAP: dict[str, int] = {}
for _gi, _grp in enumerate(COLOR_GROUPS):
    for _c in _grp:
        _COLOR_GROUP_MAP[_c] = _gi

LOC_SYNONYMS = {
    "lib": "library",
    "canteen": "cafeteria", "cafeteria": "canteen",
    "admin": "administration",
    "cse": "computer science", "cs": "computer science",
    "ece": "electronics", "eee": "electrical",
    "mech": "mechanical",
    "jhub": "j hub", "j-hub": "j hub",
    "crc": "career resource centre",
    "hostel": "residence hall", "residence": "hostel",
    "sports": "sports complex", "gym": "sports complex",
    "auditorium": "audi", "audi": "auditorium",
    "principal": "principal office",
    "block": "block", "blk": "block",
}

CAT_GROUPS = [
    {"bag", "backpack", "bags", "accessories", "luggage", "sack", "tote", "handbag", "satchel", "pouch"},
    {"electronics", "electronic", "device", "gadget", "phone", "mobile", "laptop",
     "charger", "earphones", "headphones", "earbuds", "tablet", "airpods", "pods",
     "watch", "smartwatch", "camera", "powerbank", "cable", "adapter"},
    {"document", "documents", "id", "card", "cards", "identity", "certificate",
     "pass", "passport", "licence", "license", "aadhar", "pan", "hall ticket"},
    {"clothing", "clothes", "shirt", "jacket", "coat", "dress", "shoes",
     "footwear", "cap", "hat", "hoodie", "sweater", "scarf", "belt", "socks"},
    {"key", "keys", "keychain", "lanyard", "keyring"},
    {"book", "books", "stationery", "notebook", "notes", "pen", "pencil",
     "calculator", "folder", "file", "diary", "journal"},
    {"wallet", "purse", "money", "cash", "card holder"},
    {"glasses", "spectacles", "specs", "sunglasses", "lens"},
    {"bottle", "water bottle", "flask", "thermos", "sipper"},
    {"umbrella", "rain", "raincoat"},
]


# ════════════════════════════════════════════════════════════
#  TEXT CLEANING
# ════════════════════════════════════════════════════════════

def _strip_emoji(text: str) -> str:
    return re.sub(
        r"[\U00010000-\U0010ffff\U0001F600-\U0001F64F"
        r"\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
        r"\u2600-\u26FF\u2700-\u27BF]",
        "", text, flags=re.UNICODE,
    )

_STOPWORDS = {
    "", "a", "an", "the", "and", "or", "of", "in", "at", "on",
    "to", "for", "with", "by", "is", "it", "my", "i", "me",
    "was", "have", "had", "been", "were", "are", "be",
    "some", "few", "very", "quite", "near", "around",
}

def _clean(text: str) -> str:
    text = _strip_emoji(text or "")
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip().lower()

def _tokens(text: str) -> set:
    return set(_clean(text).split()) - _STOPWORDS

def _normalise_location(text: str) -> str:
    tokens = _clean(text).split()
    return " ".join(LOC_SYNONYMS.get(t, t) for t in tokens)

def _build_text(item: dict, field: str = "all") -> str:
    if field == "title":
        return _clean(item.get("title", ""))
    if field == "desc":
        return _clean(" ".join([
            item.get("description", ""),
            item.get("brand", ""),
        ]))
    return _clean(" ".join([
        item.get("title", ""),
        item.get("description", ""),
        item.get("brand", ""),
        item.get("category", ""),
        item.get("color", ""),
    ]))


# ════════════════════════════════════════════════════════════
#  INDIVIDUAL SCORE COMPONENTS
# ════════════════════════════════════════════════════════════

def _cat_group(cat: str) -> int | None:
    tokens = _tokens(cat)
    for i, group in enumerate(CAT_GROUPS):
        if tokens & group:
            return i
    return None


def _category_score(lost: dict, found: dict) -> float:
    lc = _clean(lost.get("category", ""))
    fc = _clean(found.get("category", ""))
    if not lc or not fc:
        return 0.0
    if lc == fc:
        return 1.0
    lg, fg = _cat_group(lc), _cat_group(fc)
    if lg is not None and lg == fg:
        return 0.85
    lt, ft = _tokens(lc), _tokens(fc)
    if not lt or not ft:
        return 0.0
    jaccard = len(lt & ft) / max(len(lt | ft), 1)
    return min(jaccard * 1.6, 1.0)


def _extract_colors(item: dict) -> set:
    blob = " ".join([
        item.get("color", ""),
        item.get("title", ""),
        item.get("description", ""),
    ])
    return _tokens(blob) & COLOR_WORDS


def _color_group(color: str) -> int | None:
    return _COLOR_GROUP_MAP.get(color)


def _color_score_and_penalty(lost: dict, found: dict) -> tuple[float, float]:
    lc = _extract_colors(lost)
    fc = _extract_colors(found)
    if not lc or not fc:
        return 0.0, 0.0
    exact_overlap = lc & fc
    if exact_overlap:
        ratio = len(exact_overlap) / max(len(lc | fc), 1)
        return min(ratio * 1.5, 1.0), 0.0
    l_groups = {_color_group(c) for c in lc if _color_group(c) is not None}
    f_groups = {_color_group(c) for c in fc if _color_group(c) is not None}
    if l_groups and f_groups:
        group_overlap = l_groups & f_groups
        if group_overlap:
            return 0.75, 0.0
        else:
            return 0.0, COLOR_MISMATCH_PENALTY
    return 0.0, 0.0


def _location_score_and_penalty(lost: dict, found: dict) -> tuple[float, float]:
    """
    Enhanced location scoring using campus zone proximity map.
    Falls back to token overlap if zone not found.
    """
    raw_l = lost.get("location", "")
    raw_f = found.get("location", "")

    if not raw_l or not raw_f:
        return 0.0, 0.0

    # ── 1. Try zone-based proximity first ────────────────────
    zone_score = _location_proximity_score(raw_l, raw_f)
    if zone_score > 0:
        # Zone match found — no penalty (even if different zone, they're on campus)
        return zone_score, 0.0

    # ── 2. Fall back to token overlap ────────────────────────
    lt = _tokens(_normalise_location(raw_l))
    ft = _tokens(_normalise_location(raw_f))

    if not lt or not ft:
        return 0.0, 0.0

    overlap = lt & ft
    union   = lt | ft

    if overlap:
        ratio = len(overlap) / max(len(union), 1)
        return min(ratio * 2.2, 1.0), 0.0

    # ── 3. Fuzzy location comparison ─────────────────────────
    if _RAPIDFUZZ:
        loc_sim = _rfuzz.token_sort_ratio(
            _normalise_location(raw_l),
            _normalise_location(raw_f),
        ) / 100
        if loc_sim >= 0.55:
            return loc_sim * 0.8, 0.0

    # Confirmed no overlap and not on proximity map → small penalty
    return 0.0, LOCATION_MISMATCH_PENALTY


def _date_score_and_penalty(lost: dict, found: dict) -> tuple[float, float]:
    fmt = "%Y-%m-%d"
    try:
        ld   = datetime.strptime((lost.get("date")  or "")[:10], fmt)
        fd   = datetime.strptime((found.get("date") or "")[:10], fmt)
        diff = abs((ld - fd).days)
        score   = math.exp(-diff / 5.0)
        penalty = DATE_FAR_PENALTY if diff > 14 else 0.0
        return round(score, 4), penalty
    except Exception:
        return 0.0, 0.0


def _brand_score(lost: dict, found: dict) -> float:
    lb = _clean(lost.get("brand", ""))
    fb = _clean(found.get("brand", ""))
    if not lb or not fb:
        return 0.0
    if lb == fb:
        return 1.0
    if lb in fb or fb in lb:
        return 0.75
    if _RAPIDFUZZ:
        ratio = _rfuzz.token_sort_ratio(lb, fb) / 100
        if ratio >= 0.80:
            return 0.60
    lt, ft = _tokens(lb), _tokens(fb)
    if lt & ft:
        return 0.40
    return 0.0


def _fuzzy_text_score(lost: dict, found: dict) -> tuple[float, float]:
    if not _RAPIDFUZZ:
        return 0.0, 0.0
    la = _build_text(lost, "all")
    fa = _build_text(found, "all")
    if not la or not fa:
        return 0.0, 0.0
    ts = _rfuzz.token_sort_ratio(la, fa) / 100
    pr = _rfuzz.partial_ratio(la, fa)   / 100
    return ts, pr


# ════════════════════════════════════════════════════════════
#  LOCAL IMAGE SIMILARITY (PIL fallback when Gemini unavailable)
#  Uses color histogram comparison + average hash
# ════════════════════════════════════════════════════════════

def _resolve_image_path(image_path: str) -> str | None:
    """Resolve /static/uploads/... to absolute filesystem path."""
    if not image_path:
        return None
    if image_path.startswith("/static/") or image_path.startswith("static/"):
        base_dir = os.path.dirname(os.path.abspath(__file__))
        rel = image_path.lstrip("/")
        full = os.path.join(base_dir, rel)
        return full if os.path.exists(full) else None
    return image_path if os.path.exists(image_path) else None


def _pil_color_histogram_similarity(img1: "Image.Image", img2: "Image.Image") -> float:
    """
    Compare two PIL images by their RGB color histograms.
    Returns similarity 0.0–1.0.
    A histogram captures the overall color distribution of an image.
    """
    try:
        # Resize both to same small size for fast comparison
        size = (64, 64)
        i1 = img1.convert("RGB").resize(size)
        i2 = img2.convert("RGB").resize(size)

        h1 = i1.histogram()
        h2 = i2.histogram()

        # Bhattacharyya-like coefficient
        total = sum(
            math.sqrt(a * b)
            for a, b in zip(h1, h2)
        )
        norm = math.sqrt(sum(h1) * sum(h2))
        if norm == 0:
            return 0.0
        return round(min(total / norm, 1.0), 4)
    except Exception as e:
        logging.error(f"Histogram comparison failed: {e}")
        return 0.0


def _pil_avg_hash(img: "Image.Image", hash_size: int = 8) -> int:
    """
    Compute the average hash of an image.
    A perceptual hash that is similar for visually similar images.
    """
    resized = img.convert("L").resize((hash_size, hash_size), Image.LANCZOS)
    pixels  = list(resized.getdata())
    avg     = sum(pixels) / len(pixels)
    bits    = [1 if p >= avg else 0 for p in pixels]
    return sum(b << i for i, b in enumerate(bits))


def _pil_hash_similarity(img1: "Image.Image", img2: "Image.Image") -> float:
    """
    Compare two images using average hash (perceptual hashing).
    Returns similarity 0.0–1.0. Identical images → 1.0.
    """
    try:
        h1 = _pil_avg_hash(img1)
        h2 = _pil_avg_hash(img2)
        # Hamming distance between the two hashes
        xor    = h1 ^ h2
        bits   = bin(xor).count("1")
        total  = 64  # 8×8 hash
        return round(1.0 - bits / total, 4)
    except Exception as e:
        logging.error(f"Hash comparison failed: {e}")
        return 0.0


def local_image_similarity(path1: str, path2: str) -> dict:
    """
    Compare two images locally using PIL.
    Combines color histogram similarity + perceptual hash similarity.
    Returns same dict shape as gemini_image_vs_image for easy drop-in.
    """
    fallback = {
        "image_score": 0.0, "image_reason": None,
        "matched_features": [], "unmatched_features": [],
        "gemini_used": False, "local_image_used": False,
    }

    if not _PIL_AVAILABLE:
        return fallback

    p1 = _resolve_image_path(path1)
    p2 = _resolve_image_path(path2)

    if not p1 or not p2:
        return fallback

    try:
        img1 = Image.open(p1)
        img2 = Image.open(p2)

        hist_sim = _pil_color_histogram_similarity(img1, img2)
        hash_sim = _pil_hash_similarity(img1, img2)

        # Weighted combination: color distribution matters more than hash
        combined = round(hist_sim * 0.65 + hash_sim * 0.35, 4)

        # Build a human-readable reason
        if combined >= 0.85:
            reason = "Images appear very similar in color and shape"
            matched = ["color distribution", "visual appearance"]
        elif combined >= 0.65:
            reason = "Images share similar color tones"
            matched = ["color distribution"]
        elif combined >= 0.45:
            reason = "Images have some visual similarity"
            matched = []
        else:
            reason = "Images look visually different"
            matched = []

        return {
            "image_score":        combined,
            "image_reason":       reason,
            "matched_features":   matched,
            "unmatched_features": [],
            "gemini_used":        False,
            "local_image_used":   True,
            "hist_sim":           hist_sim,
            "hash_sim":           hash_sim,
        }

    except Exception as e:
        logging.error(f"Local image similarity failed: {e}")
        return fallback


# ════════════════════════════════════════════════════════════
#  GEMINI VISION
# ════════════════════════════════════════════════════════════

def _load_image_base64(image_path: str) -> str | None:
    try:
        full = _resolve_image_path(image_path)
        if not full:
            logging.warning(f"Image not found: {image_path}")
            return None
        with open(full, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    except Exception as e:
        logging.error(f"Failed to load image {image_path}: {e}")
        return None


def _get_image_mime(image_path: str) -> str:
    ext = os.path.splitext(image_path)[-1].lower()
    return {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png",  ".webp": "image/webp",
        ".gif": "image/gif",
    }.get(ext, "image/jpeg")


def gemini_image_vs_description(found_image_path: str, lost_item: dict) -> dict:
    fallback = {
        "image_score": 0.0, "image_reason": None,
        "matched_features": [], "unmatched_features": [], "gemini_used": False,
    }
    if not _GEMINI_AVAILABLE:
        return fallback

    img_b64 = _load_image_base64(found_image_path)
    if not img_b64:
        return fallback

    parts = []
    if lost_item.get("title"):       parts.append(f"Item: {lost_item['title']}")
    if lost_item.get("category"):    parts.append(f"Category: {lost_item['category']}")
    if lost_item.get("color"):       parts.append(f"Color: {lost_item['color']}")
    if lost_item.get("brand"):       parts.append(f"Brand/Make: {lost_item['brand']}")
    if lost_item.get("description"): parts.append(f"Description: {lost_item['description']}")
    if lost_item.get("location"):    parts.append(f"Lost near: {lost_item['location']}")

    prompt = f"""You are helping match lost and found items at a college campus.

A student reported losing an item with these details:
{chr(10).join(parts)}

Look carefully at the attached photo of a FOUND item.
Does the item in the photo match the lost item description above?

Reply ONLY with valid JSON (no extra text, no markdown fences):
{{
  "similarity_score": 75,
  "reason": "One sentence explaining match or mismatch",
  "matched_features": ["color", "type"],
  "unmatched_features": ["brand not visible"]
}}

Scoring guide:
0–25: Completely different item
26–50: Same category but different item
51–70: Possibly the same item, some features match
71–85: Likely the same item, most features match
86–100: Almost certainly the same item

Be strict. Only score high if features genuinely match."""

    try:
        model    = genai.GenerativeModel("gemini-1.5-flash")
        mime     = _get_image_mime(found_image_path)
        response = model.generate_content([prompt, {"mime_type": mime, "data": img_b64}])
        raw      = response.text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        result = json.loads(raw)
        return {
            "image_score":        round(result.get("similarity_score", 0) / 100, 4),
            "image_reason":       result.get("reason", ""),
            "matched_features":   result.get("matched_features", []),
            "unmatched_features": result.get("unmatched_features", []),
            "gemini_used":        True,
        }
    except Exception as e:
        logging.error(f"Gemini API error: {e}")
        return fallback


def gemini_image_vs_image(lost_image_path: str, found_image_path: str) -> dict:
    fallback = {
        "image_score": 0.0, "image_reason": None,
        "matched_features": [], "unmatched_features": [], "gemini_used": False,
    }
    if not _GEMINI_AVAILABLE:
        return fallback

    lost_b64  = _load_image_base64(lost_image_path)
    found_b64 = _load_image_base64(found_image_path)
    if not lost_b64 or not found_b64:
        return fallback

    prompt = """You are helping match lost and found items at a college campus.
The FIRST image is the lost item. The SECOND image is the found item.
Do these two images show the same item?

Reply ONLY with valid JSON (no extra text, no markdown fences):
{
  "similarity_score": 75,
  "reason": "One sentence",
  "matched_features": ["color", "size"],
  "unmatched_features": ["different strap"]
}

0–25: Completely different | 26–50: Same category | 51–70: Possibly same
71–85: Likely same | 86–100: Almost certainly same"""

    try:
        model    = genai.GenerativeModel("gemini-1.5-flash")
        lm, fm   = _get_image_mime(lost_image_path), _get_image_mime(found_image_path)
        response = model.generate_content([
            prompt,
            {"mime_type": lm, "data": lost_b64},
            {"mime_type": fm, "data": found_b64},
        ])
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        result = json.loads(raw)
        return {
            "image_score":        round(result.get("similarity_score", 0) / 100, 4),
            "image_reason":       result.get("reason", ""),
            "matched_features":   result.get("matched_features", []),
            "unmatched_features": result.get("unmatched_features", []),
            "gemini_used":        True,
        }
    except Exception as e:
        logging.error(f"Gemini image-vs-image error: {e}")
        return fallback


# ════════════════════════════════════════════════════════════
#  UNIFIED IMAGE SCORING
#  Tries Gemini first → falls back to local PIL comparison
# ════════════════════════════════════════════════════════════

def _get_image_score(lost: dict, found: dict) -> dict:
    """
    Returns image comparison result dict.
    Priority:
      1. Gemini image-vs-image (both have images + Gemini available)
      2. Gemini image-vs-description (found has image, lost doesn't + Gemini available)
      3. Local PIL color histogram (Gemini unavailable or failed)
      4. No image → empty result
    """
    lost_img  = (lost.get("image_path")  or "").strip()
    found_img = (found.get("image_path") or "").strip()

    # Both have images
    if lost_img and found_img:
        if _GEMINI_AVAILABLE:
            result = gemini_image_vs_image(lost_img, found_img)
            if result.get("gemini_used"):
                return result
        # Gemini failed or unavailable — use PIL
        if _PIL_AVAILABLE:
            return local_image_similarity(lost_img, found_img)

    # Only found has image (most common case)
    elif found_img and not lost_img:
        if _GEMINI_AVAILABLE:
            result = gemini_image_vs_description(found_img, lost)
            if result.get("gemini_used"):
                return result
        # Gemini failed — can't compare image to text description locally
        # Return neutral result
        return {
            "image_score": 0.0, "image_reason": None,
            "matched_features": [], "unmatched_features": [],
            "gemini_used": False, "local_image_used": False,
        }

    return {
        "image_score": 0.0, "image_reason": None,
        "matched_features": [], "unmatched_features": [],
        "gemini_used": False, "local_image_used": False,
    }


# ════════════════════════════════════════════════════════════
#  TIEBREAKER — rank equal-score items by secondary signals
# ════════════════════════════════════════════════════════════

def _tiebreaker_key(match: dict) -> tuple:
    """
    Secondary sort key used when two matches have the same score.
    Higher = ranked first.
    Signals (in priority order):
      1. Gemini image used (most reliable signal)
      2. Local image used
      3. Color matched (not penalised)
      4. Same zone location
      5. Date score (closer = better)
      6. Brand score
    """
    reasons = set(match.get("reasons", []))
    return (
        1 if match.get("gemini_used")                          else 0,  # Gemini used
        1 if match.get("match_type") == "local_image"         else 0,  # PIL used
        1 if "Colour matches" in reasons                       else 0,  # Exact color
        1 if "Same location" in reasons                        else 0,  # Same zone
        1 if "Similar colour" in reasons                       else 0,  # Close color
        1 if "Nearby location" in reasons                      else 0,  # Adjacent zone
        1 if "Brand / make matches" in reasons                 else 0,  # Brand exact
        match.get("score_breakdown", {}).get("rule_score", 0),          # Rule score
    )


# ════════════════════════════════════════════════════════════
#  REASON BUILDER
# ════════════════════════════════════════════════════════════

def _build_reasons(
    lost, found,
    cat, color, loc, date, brand,
    title_sim, desc_sim,
    fuzzy_ts, fuzzy_pr,
    image_result=None,
    color_penalty=0.0,
    loc_penalty=0.0,
    date_penalty=0.0,
) -> list:
    r = []

    # Image reasons first
    if image_result:
        if image_result.get("gemini_used") and image_result.get("image_reason"):
            r.append(f"📷 {image_result['image_reason']}")
            for f in image_result.get("matched_features", []):
                r.append(f"✅ {f.capitalize()} matches in photo")
        elif image_result.get("local_image_used") and image_result.get("image_reason"):
            r.append(f"🖼️ {image_result['image_reason']}")

    # Text similarity
    if title_sim >= 0.40 or fuzzy_ts >= 0.60:
        r.append("Title / name strongly matches")
    elif title_sim >= 0.25 or fuzzy_ts >= 0.40:
        r.append("Title partially matches")

    if desc_sim >= 0.30 or fuzzy_pr >= 0.65:
        r.append("Description details match")

    # Category
    if cat >= 0.85:
        r.append("Same item category")
    elif cat >= 0.50:
        r.append("Related item category")

    # Colour
    if color >= 0.75:
        r.append("Colour matches")
    elif color >= 0.40:
        r.append("Similar colour")
    elif color_penalty > 0:
        r.append("⚠️ Colour mismatch")

    # Location — show zone-aware messages
    if loc >= 0.90:
        r.append("Same location")
    elif loc >= 0.50:
        r.append("Nearby location (adjacent campus zone)")
    elif loc >= 0.10:
        r.append("Same campus area")
    elif loc_penalty > 0:
        r.append("⚠️ Different location")

    # Date
    if date >= 0.85:
        r.append("Same day")
    elif date >= 0.55:
        r.append("Close dates (within 3 days)")
    elif date >= 0.30:
        r.append("Nearby dates (within 7 days)")
    elif date_penalty > 0:
        r.append("⚠️ Far apart dates (>14 days)")

    # Brand
    if brand >= 0.75:
        r.append("Brand / make matches")
    elif brand >= 0.40:
        r.append("Brand partially matches")

    return r or ["General similarity detected"]


# ════════════════════════════════════════════════════════════
#  CONFIDENCE LABEL
# ════════════════════════════════════════════════════════════

def _confidence_label(score: float) -> str:
    if score >= 0.82:
        return "🔥 Strong Match"
    if score >= 0.62:
        return "⚡ Good Match"
    if score >= 0.44:
        return "📌 Possible Match"
    if score >= 0.32:
        return "🔍 Weak Signal"
    return "❓ Very Weak"


# ════════════════════════════════════════════════════════════
#  TF-IDF MATRIX BUILDER
# ════════════════════════════════════════════════════════════

def _build_tfidf_matrices(all_items: list):
    def _fit(texts, analyzer, ngram):
        non_empty = [t for t in texts if t.strip()]
        if not non_empty:
            return None
        vec = TfidfVectorizer(
            analyzer=analyzer,
            ngram_range=ngram,
            min_df=1,
            sublinear_tf=True,
        )
        return vec.fit_transform(texts)

    full_texts  = [_build_text(i, "all")   for i in all_items]
    title_texts = [_build_text(i, "title") for i in all_items]
    desc_texts  = [_build_text(i, "desc")  for i in all_items]

    word_mat  = _fit(full_texts,  "word",    (1, 3))
    char_mat  = _fit(full_texts,  "char_wb", (3, 5))
    title_mat = _fit(title_texts, "word",    (1, 2))
    desc_mat  = _fit(desc_texts,  "word",    (1, 2))

    return word_mat, char_mat, title_mat, desc_mat


def _cosine(mat, row_a: int, row_b: int) -> float:
    if mat is None:
        return 0.0
    try:
        return float(cosine_similarity(mat[row_a], mat[row_b])[0][0])
    except Exception:
        return 0.0


# ════════════════════════════════════════════════════════════
#  PUBLIC API
# ════════════════════════════════════════════════════════════

def find_matches(lost_items: list, found_items: list, min_score: int = MATCH_THRESHOLD) -> list:
    """
    Compare every lost item against every found item.

    Matching pipeline:
      1.  TF-IDF word-level (1-3 gram)
      2.  TF-IDF char-level (3-5 gram)
      3.  RapidFuzz token_sort_ratio
      4.  RapidFuzz partial_ratio
      5.  Category score (semantic grouping)
      6.  Colour score + penalty
      7.  Location score (zone proximity map) + penalty
      8.  Date score (exponential decay) + penalty
      9.  Brand score
      10. Image score (Gemini → PIL fallback)
      11. Tiebreaker sort for equal scores

    Returns list of match dicts sorted by score desc, then tiebreaker desc.
    """
    if not lost_items or not found_items:
        return []

    all_items = lost_items + found_items
    n_lost    = len(lost_items)

    word_mat, char_mat, title_mat, desc_mat = _build_tfidf_matrices(all_items)

    results = []

    for li, lost in enumerate(lost_items):
        for fi, found in enumerate(found_items):

            # ── Text scores ───────────────────────────────
            word_sim  = _cosine(word_mat,  li, n_lost + fi)
            char_sim  = _cosine(char_mat,  li, n_lost + fi)
            title_sim = _cosine(title_mat, li, n_lost + fi)
            desc_sim  = _cosine(desc_mat,  li, n_lost + fi)
            fuzzy_ts, fuzzy_pr = _fuzzy_text_score(lost, found)

            text_word = max(word_sim, title_sim)
            text_desc = max(desc_sim, 0.0)

            # ── Rule-based scores ─────────────────────────
            cat   = _category_score(lost, found)
            color, color_penalty = _color_score_and_penalty(lost, found)
            loc,   loc_penalty   = _location_score_and_penalty(lost, found)
            date,  date_penalty  = _date_score_and_penalty(lost, found)
            brand = _brand_score(lost, found)

            # ── Image scoring (Gemini → PIL fallback) ─────
            image_result = _get_image_score(lost, found)
            image_score  = image_result.get("image_score", 0.0)

            # ── Weighted combination ──────────────────────
            if image_score > 0:
                raw = (
                    W_IMAGE               * image_score +
                    W_TEXT_TFIDF_WORD_IMG * text_word   +
                    W_TEXT_TFIDF_CHAR_IMG * char_sim    +
                    W_TEXT_FUZZY_SORT_IMG * fuzzy_ts    +
                    W_TEXT_FUZZY_PART_IMG * fuzzy_pr    +
                    W_CATEGORY_IMG        * cat          +
                    W_COLOR_IMG           * color        +
                    W_DATE_IMG            * date         +
                    W_LOCATION_IMG        * loc          +
                    W_BRAND_IMG           * brand
                )
            else:
                raw = (
                    W_TEXT_TFIDF_WORD * text_word  +
                    W_TEXT_TFIDF_CHAR * char_sim   +
                    W_TEXT_FUZZY_SORT * fuzzy_ts   +
                    W_TEXT_FUZZY_PART * fuzzy_pr   +
                    W_CATEGORY        * cat         +
                    W_COLOR           * color       +
                    W_DATE            * date        +
                    W_LOCATION        * loc         +
                    W_BRAND           * brand
                )

            # ── Apply penalties ───────────────────────────
            total_penalty = color_penalty + loc_penalty + date_penalty
            final         = min(max(raw - total_penalty, 0.0), 1.0)
            score_pct     = round(final * 100)

            if score_pct < min_score:
                continue

            # ── Reasons ───────────────────────────────────
            reasons = _build_reasons(
                lost, found,
                cat, color, loc, date, brand,
                title_sim, text_desc,
                fuzzy_ts, fuzzy_pr,
                image_result,
                color_penalty, loc_penalty, date_penalty,
            )

            # ── Score breakdown ───────────────────────────
            text_component = (
                W_TEXT_TFIDF_WORD * text_word +
                W_TEXT_TFIDF_CHAR * char_sim  +
                W_TEXT_FUZZY_SORT * fuzzy_ts  +
                W_TEXT_FUZZY_PART * fuzzy_pr
            )
            rule_component = (
                W_CATEGORY * cat   +
                W_COLOR    * color +
                W_DATE     * date  +
                W_LOCATION * loc   +
                W_BRAND    * brand
            )

            lost_img  = (lost.get("image_path")  or "").strip()
            found_img = (found.get("image_path") or "").strip()

            results.append({
                "lost_id"         : lost["id"],
                "found_id"        : found["id"],
                "score"           : score_pct,
                "label"           : _confidence_label(final),
                "reasons"         : reasons,
                "score_breakdown" : {
                    "text_score"  : round(text_component * 100, 1),
                    "image_score" : round(image_score    * 100, 1),
                    "rule_score"  : round(rule_component * 100, 1),
                    "penalty"     : round(total_penalty  * 100, 1),
                },
                "image_reason"    : image_result.get("image_reason"),
                "gemini_used"     : image_result.get("gemini_used", False),
                "local_image_used": image_result.get("local_image_used", False),
                "match_type"      : (
                    "gemini_image"
                    if image_result.get("gemini_used")
                    else "local_image"
                    if image_result.get("local_image_used")
                    else "text_only"
                ),
                "lost_title"      : lost.get("title", ""),
                "found_title"     : found.get("title", ""),
                "lost_location"   : lost.get("location", ""),
                "found_location"  : found.get("location", ""),
                "lost_date"       : lost.get("date", ""),
                "found_date"      : found.get("date", ""),
                "lost_category"   : lost.get("category", ""),
                "found_category"  : found.get("category", ""),
                "lost_image"      : lost_img,
                "found_image"     : found_img,
                "found_locker"    : found.get("locker_number", ""),
                "lost_locker"     : lost.get("locker_number", ""),
            })

    # ── Sort: primary = score desc, secondary = tiebreaker desc ──
    seen   = set()
    unique = []
    for r in sorted(
        results,
        key=lambda x: (x["score"], _tiebreaker_key(x)),
        reverse=True,
    ):
        key = (r["lost_id"], r["found_id"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique[:MAX_MATCHES]


def find_matches_for_item(item: dict, candidates: list, min_score: int = MATCH_THRESHOLD) -> list:
    """
    Find matches for a single newly posted item against a list of candidates.
    """
    if item.get("type") == "lost":
        return find_matches([item], candidates, min_score)
    else:
        return find_matches(candidates, [item], min_score)
