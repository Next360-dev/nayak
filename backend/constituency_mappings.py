"""
constituency_mappings.py - Master Constituency & District Engine for Telangana
Contains 100% comprehensive data for all 119 Assembly Constituencies across all 33 Districts.
Includes:
- Canonical names, Telugu script names, and MLAs
- Bilingual Mandals & Towns for all 119 constituencies
- Strict cross-district validation (prevents false positives from other districts)
- Canonical District Enforcement: Whenever a constituency is assigned, its parent district is guaranteed.
"""

import re
from typing import Optional, Tuple, Dict, List

# ============================================================
# TELUGU MORPHOLOGICAL STEMMING
# Strips common inflectional suffixes from Telugu place names
# so "హైదరాబాద్‌లో" matches "హైదరాబాద్", etc.
# ============================================================
_TELUGU_SUFFIXES = [
    # Locative (in, at)
    'లోని', 'లో', 'లో‌', '‌లో',
    # Dative (to, for)
    'కు', 'కి', 'కొ',
    # Accusative
    'ను', 'నుండి', 'నుంచి', 'నుంచ', 'నుండ',
    # Genitive
    'లోని', 'యొక్క', 'కి సంబంధించిన',
    # Other common suffixes
    'లో జరిగిన', 'వద్ద', 'లో నుండి',
    # English-transliteration separators (zero-width joiner etc.)
    '\u200c', '\u200b',
]

def strip_telugu_suffix(word: str) -> str:
    """
    Strips common Telugu case/inflectional suffixes from a place name.
    e.g. 'హైదరాబాద్‌లో' → 'హైదరాబాద్'
    """
    for suffix in _TELUGU_SUFFIXES:
        if word.endswith(suffix):
            word = word[: len(word) - len(suffix)]
    return word.strip()


# ============================================================
# 1. 119 CANONICAL CONSTITUENCIES -> PARENT DISTRICT MAPPING
# ============================================================
CONSTITUENCY_TO_DISTRICT = {
    # Adilabad (2)
    "Adilabad": "Adilabad",
    "Boath (ST)": "Adilabad",
    
    # Bhadradri Kothagudem (5)
    "Aswaraopeta (ST)": "Bhadradri Kothagudem",
    "Bhadrachalam (ST)": "Bhadradri Kothagudem",
    "Kothagudem": "Bhadradri Kothagudem",
    "Pinapaka (ST)": "Bhadradri Kothagudem",
    "Yellandu (ST)": "Bhadradri Kothagudem",
    
    # Hanumakonda (2)
    "Parkal": "Hanumakonda",
    "Warangal West": "Hanumakonda",
    
    # Hyderabad (15)
    "Amberpet": "Hyderabad",
    "Bahadurpura": "Hyderabad",
    "Chandrayangutta": "Hyderabad",
    "Charminar": "Hyderabad",
    "Goshamahal": "Hyderabad",
    "Jubilee Hills": "Hyderabad",
    "Karwan": "Hyderabad",
    "Khairatabad": "Hyderabad",
    "Malakpet": "Hyderabad",
    "Musheerabad": "Hyderabad",
    "Nampally": "Hyderabad",
    "Sanathnagar": "Hyderabad",
    "Secunderabad": "Hyderabad",
    "Secunderabad Cantt. (SC)": "Hyderabad",
    "Yakutpura": "Hyderabad",
    
    # Jagtial (3)
    "Dharmapuri (SC)": "Jagtial",
    "Jagtial": "Jagtial",
    "Koratla": "Jagtial",
    
    # Jangaon (3)
    "Jangaon": "Jangaon",
    "Palakurthi": "Jangaon",
    "Station Ghanpur (SC)": "Jangaon",
    
    # Jayashankar Bhupalpally (1)
    "Bhupalpalle": "Jayashankar Bhupalpally",
    
    # Jogulamba Gadwal (2)
    "Alampur (SC)": "Jogulamba Gadwal",
    "Gadwal": "Jogulamba Gadwal",
    
    # Kamareddy (4)
    "Banswada": "Kamareddy",
    "Jukkal (SC)": "Kamareddy",
    "Kamareddy": "Kamareddy",
    "Yellareddy": "Kamareddy",
    
    # Karimnagar (4)
    "Choppadandi (SC)": "Karimnagar",
    "Huzurabad": "Karimnagar",
    "Karimnagar": "Karimnagar",
    "Manakondur (SC)": "Karimnagar",
    
    # Khammam (5)
    "Khammam": "Khammam",
    "Madhira (SC)": "Khammam",
    "Palair": "Khammam",
    "Sathupalli (SC)": "Khammam",
    "Wyra (ST)": "Khammam",
    
    # Komaram Bheem Asifabad (2)
    "Asifabad (ST)": "Komaram Bheem Asifabad",
    "Sirpur": "Komaram Bheem Asifabad",
    
    # Mahabubabad (2)
    "Dornakal (ST)": "Mahabubabad",
    "Mahabubabad (ST)": "Mahabubabad",
    
    # Mahabubnagar (3)
    "Devarkadra": "Mahabubnagar",
    "Jadcherla": "Mahabubnagar",
    "Mahabubnagar": "Mahabubnagar",
    
    # Mancherial (3)
    "Bellampalli (SC)": "Mancherial",
    "Chennur (SC)": "Mancherial",
    "Mancherial": "Mancherial",
    
    # Medak (2)
    "Medak": "Medak",
    "Narsapur": "Medak",
    
    # Medchal-Malkajgiri (5)
    "Kukatpally": "Medchal-Malkajgiri",
    "Malkajgiri": "Medchal-Malkajgiri",
    "Medchal": "Medchal-Malkajgiri",
    "Quthbullapur": "Medchal-Malkajgiri",
    "Uppal": "Medchal-Malkajgiri",
    
    # Mulugu (1)
    "Mulugu (ST)": "Mulugu",
    
    # Nagarkurnool (4)
    "Achampet (SC)": "Nagarkurnool",
    "Kalwakurthy": "Nagarkurnool",
    "Kollapur": "Nagarkurnool",
    "Nagarkurnool": "Nagarkurnool",
    
    # Nalgonda (6)
    "Devarakonda (ST)": "Nalgonda",
    "Miryalaguda": "Nalgonda",
    "Munugode": "Nalgonda",
    "Nagarjuna Sagar": "Nalgonda",
    "Nakrekal (SC)": "Nalgonda",
    "Nalgonda": "Nalgonda",
    
    # Narayanpet (2)
    "Makthal": "Narayanpet",
    "Narayanpet": "Narayanpet",
    
    # Nirmal (3)
    "Khanapur (ST)": "Nirmal",
    "Mudhole": "Nirmal",
    "Nirmal": "Nirmal",
    
    # Nizamabad (5)
    "Armur": "Nizamabad",
    "Balkonda": "Nizamabad",
    "Bodhan": "Nizamabad",
    "Nizamabad Rural": "Nizamabad",
    "Nizamabad Urban": "Nizamabad",
    
    # Peddapalli (3)
    "Manthani": "Peddapalli",
    "Peddapalle": "Peddapalli",
    "Ramagundam": "Peddapalli",
    
    # Rajanna Sircilla (2)
    "Sircilla": "Rajanna Sircilla",
    "Vemulawada": "Rajanna Sircilla",
    
    # Ranga Reddy (7)
    "Chevella (SC)": "Ranga Reddy",
    "Ibrahimpatnam": "Ranga Reddy",
    "L.B. Nagar": "Ranga Reddy",
    "Maheshwaram": "Ranga Reddy",
    "Rajendranagar": "Ranga Reddy",
    "Serilingampally": "Ranga Reddy",
    "Shadnagar": "Ranga Reddy",
    
    # Sangareddy (5)
    "Andole (SC)": "Sangareddy",
    "Narayankhed": "Sangareddy",
    "Patancheru": "Sangareddy",
    "Sangareddy": "Sangareddy",
    "Zahirabad (SC)": "Sangareddy",
    
    # Siddipet (4)
    "Dubbak": "Siddipet",
    "Gajwel": "Siddipet",
    "Husnabad": "Siddipet",
    "Siddipet": "Siddipet",
    
    # Suryapet (4)
    "Huzurnagar": "Suryapet",
    "Kodad": "Suryapet",
    "Suryapet": "Suryapet",
    "Thungathurthi (SC)": "Suryapet",
    
    # Vikarabad (4)
    "Kodangal": "Vikarabad",
    "Pargi": "Vikarabad",
    "Tandur": "Vikarabad",
    "Vikarabad (SC)": "Vikarabad",
    
    # Wanaparthy (1)
    "Wanaparthy": "Wanaparthy",
    
    # Warangal (3)
    "Narasampet": "Warangal",
    "Warangal East": "Warangal",
    "Wardhannapet (SC)": "Warangal",
    
    # Yadadri Bhuvanagiri (2)
    "Alair": "Yadadri Bhuvanagiri",
    "Bhongir": "Yadadri Bhuvanagiri"
}

# Reverse mapping: District -> List of Constituencies
DISTRICT_TO_CONSTITUENCIES: Dict[str, List[str]] = {}
for const, dist in CONSTITUENCY_TO_DISTRICT.items():
    DISTRICT_TO_CONSTITUENCIES.setdefault(dist, []).append(const)

# Map clean names without (SC/ST)
CANONICAL_CONSTITUENCIES = {}
for const in CONSTITUENCY_TO_DISTRICT:
    clean = re.sub(r'\s*\((SC|ST)\)', '', const).strip()
    CANONICAL_CONSTITUENCIES[clean] = const
    CANONICAL_CONSTITUENCIES[const] = const

# ============================================================
# 2. CONSTITUENCY TELUGU NAMES -> CANONICAL CONSTITUENCY
# ============================================================
CONSTITUENCY_TELUGU = {
    'అచ్చంపేట': 'Achampet (SC)', 'ఆదిలాబాద్': 'Adilabad', 'ఆలేరు': 'Alair', 'అలేరు': 'Alair',
    'ఆలంపూర్': 'Alampur (SC)', 'అంబర్‌పేట్': 'Amberpet', 'ఆందోల్': 'Andole (SC)', 'ఆర్మూర్': 'Armur',
    'ఆసిఫాబాద్': 'Asifabad (ST)', 'అశ్వారావుపేట': 'Aswaraopeta (ST)', 'బహదూర్‌పురా': 'Bahadurpura',
    'బాల్కొండ': 'Balkonda', 'బాన్సువాడ': 'Banswada', 'బెల్లంపల్లి': 'Bellampalli (SC)',
    'భద్రాచలం': 'Bhadrachalam (ST)', 'భువనగిరి': 'Bhongir', 'భూపాలపల్లి': 'Bhupalpalle',
    'బోథ్': 'Boath (ST)', 'బోధన్': 'Bodhan', 'చాంద్రాయణగుట్ట': 'Chandrayangutta', 'చార్మినార్': 'Charminar',
    'చెన్నూరు': 'Chennur (SC)', 'చేవెళ్ల': 'Chevella (SC)', 'చొప్పదండి': 'Choppadandi (SC)',
    'దేవరకొండ': 'Devarakonda (ST)', 'దేవరకద్ర': 'Devarkadra', 'ధర్మపురి': 'Dharmapuri (SC)',
    'దొర్నకల్': 'Dornakal (ST)', 'దుబ్బాక': 'Dubbak', 'గద్వాల్': 'Gadwal', 'గజ్వేల్': 'Gajwel',
    'గోషామహల్': 'Goshamahal', 'హుజూరాబాద్': 'Huzurabad', 'హుజూర్‌నగర్': 'Huzurnagar',
    'హుస్నాబాద్': 'Husnabad', 'ఇబ్రహీంపట్నం': 'Ibrahimpatnam', 'జడ్చర్ల': 'Jadcherla',
    'జగిత్యాల': 'Jagtial', 'జనగాం': 'Jangaon', 'జనగామ': 'Jangaon', 'జూబ్లీహిల్స్': 'Jubilee Hills',
    'జుక్కల్': 'Jukkal (SC)', 'కల్వకుర్తి': 'Kalwakurthy', 'కామారెడ్డి': 'Kamareddy',
    'కరీంనగర్': 'Karimnagar', 'కార్వాన్': 'Karwan', 'ఖైరతాబాద్': 'Khairatabad',
    'ఖమ్మం': 'Khammam', 'ఖానాపూర్': 'Khanapur (ST)', 'కోదాడ': 'Kodad',
    'కొడంగల్': 'Kodangal', 'కొల్లాపూర్': 'Kollapur', 'కోరుట్ల': 'Koratla',
    'కొత్తగూడెం': 'Kothagudem', 'కూకట్‌పల్లి': 'Kukatpally', 'ఎల్బీనగర్': 'L.B. Nagar',
    'ఎల్.బి. నగర్': 'L.B. Nagar', 'మధిర': 'Madhira (SC)', 'మహబూబాబాద్': 'Mahabubabad (ST)',
    'మహబూబ్‌నగర్': 'Mahabubnagar', 'మహేశ్వరం': 'Maheshwaram', 'మక్తల్': 'Makthal',
    'మలక్‌పేట్': 'Malakpet', 'మల్కాజ్‌గిరి': 'Malkajgiri', 'మానకొండూరు': 'Manakondur (SC)',
    'మంచిర్యాల': 'Mancherial', 'మంథని': 'Manthani', 'మెదక్': 'Medak', 'మేడ్చల్': 'Medchal',
    'మిర్యాలగూడ': 'Miryalaguda', 'ముధోల్': 'Mudhole', 'ములుగు': 'Mulugu (ST)',
    'మునుగోడు': 'Munugode', 'ముషీరాబాద్': 'Musheerabad', 'నాగార్జున సాగర్': 'Nagarjuna Sagar',
    'నాగార్జునసాగర్': 'Nagarjuna Sagar', 'నాగర్‌కర్నూల్': 'Nagarkurnool', 'నకిరేకల్': 'Nakrekal (SC)',
    'నల్గొండ': 'Nalgonda', 'నాంపల్లి': 'Nampally', 'నర్సంపేట': 'Narasampet',
    'నారాయణఖేడ్': 'Narayankhed', 'నారాయణపేట': 'Narayanpet', 'నర్సాపూర్': 'Narsapur',
    'నిర్మల్': 'Nirmal', 'నిజామాబాద్ రూరల్': 'Nizamabad Rural', 'నిజామాబాద్ అర్బన్': 'Nizamabad Urban',
    'పాలకుర్తి': 'Palakurthi', 'పాలేరు': 'Palair', 'పరిగి': 'Pargi', 'పరకాల': 'Parkal',
    'పటాన్‌చెరు': 'Patancheru', 'పెద్దపల్లి': 'Peddapalle', 'పినపాక': 'Pinapaka (ST)',
    'కుత్బుల్లాపూర్': 'Quthbullapur', 'రాజేంద్రనగర్': 'Rajendranagar', 'రామగుండం': 'Ramagundam',
    'సనత్‌నగర్': 'Sanathnagar', 'సంగారెడ్డి': 'Sangareddy', 'సత్తుపల్లి': 'Sathupalli (SC)',
    'సికింద్రాబాద్': 'Secunderabad', 'సికింద్రాబాద్ కంటోన్మెంట్': 'Secunderabad Cantt. (SC)',
    'శేరిలింగంపల్లి': 'Serilingampally', 'షాద్‌నగర్': 'Shadnagar', 'సిద్దిపేట': 'Siddipet',
    'సిరిసిల్ల': 'Sircilla', 'సిర్పూర్': 'Sirpur', 'స్టేషన్ ఘన్‌పూర్': 'Station Ghanpur (SC)',
    'సూర్యాపేట': 'Suryapet', 'తాండూరు': 'Tandur', 'తుంగతుర్తి': 'Thungathurthi (SC)',
    'ఉప్పల్': 'Uppal', 'వేములవాడ': 'Vemulawada', 'వికారాబాద్': 'Vikarabad (SC)',
    'వనపర్తి': 'Wanaparthy', 'వరంగల్ తూర్పు': 'Warangal East', 'వరంగల్ పశ్చిమ': 'Warangal West',
    'వర్ధన్నపేట': 'Wardhannapet (SC)', 'వైరా': 'Wyra (ST)', 'యాకూత్‌పురా': 'Yakutpura',
    'ఇల్లందు': 'Yellandu (ST)', 'యెల్లందు': 'Yellandu (ST)', 'ఎల్లారెడ్డి': 'Yellareddy',
    'జహీరాబాద్': 'Zahirabad (SC)', 'జాహిరాబాద్': 'Zahirabad (SC)'
}

# ============================================================
# 3. DISTRICT TELUGU NAMES -> CANONICAL DISTRICT
# ============================================================
DISTRICT_TELUGU_MAP = {
    'ఆదిలాబాద్': 'Adilabad',
    'భద్రాద్రి కొత్తగూడెం': 'Bhadradri Kothagudem',
    'హనుమకొండ': 'Hanumakonda',
    'హన్మకొండ': 'Hanumakonda',
    'హైదరాబాద్': 'Hyderabad',
    'జగిత్యాల': 'Jagtial',
    'జనగాం': 'Jangaon',
    'జనగామ': 'Jangaon',
    'జయశంకర్ భూపాలపల్లి': 'Jayashankar Bhupalpally',
    'భూపాలపల్లి': 'Jayashankar Bhupalpally',
    'జోగులాంబ గద్వాల': 'Jogulamba Gadwal',
    'గద్వాల': 'Jogulamba Gadwal',
    'కామారెడ్డి': 'Kamareddy',
    'కరీంనగర్': 'Karimnagar',
    'ఖమ్మం': 'Khammam',
    'కొమరం భీం ఆసిఫాబాద్': 'Komaram Bheem Asifabad',
    'కొమరం భీమ్': 'Komaram Bheem Asifabad',
    'మహబూబాబాద్': 'Mahabubabad',
    'మహబూబ్‌నగర్': 'Mahabubnagar',
    'పాలమూరు': 'Mahabubnagar',
    'మంచిర్యాల': 'Mancherial',
    'మెదక్': 'Medak',
    'మేడ్చల్-మల్కాజ్‌గిరి': 'Medchal-Malkajgiri',
    'మేడ్చల్': 'Medchal-Malkajgiri',
    'ములుగు': 'Mulugu',
    'నాగర్‌కర్నూల్': 'Nagarkurnool',
    'నల్గొండ': 'Nalgonda',
    'నారాయణపేట': 'Narayanpet',
    'నిర్మల్': 'Nirmal',
    'నిజామాబాద్': 'Nizamabad',
    'పెద్దపల్లి': 'Peddapalli',
    'రాజన్న సిరిసిల్ల': 'Rajanna Sircilla',
    'సిరిసిల్ల జిల్లా': 'Rajanna Sircilla',
    'రంగారెడ్డి': 'Ranga Reddy',
    'సంగారెడ్డి': 'Sangareddy',
    'సిద్దిపేట': 'Siddipet',
    'సూర్యాపేట': 'Suryapet',
    'వికారాబాద్': 'Vikarabad',
    'వనపర్తి': 'Wanaparthy',
    'వరంగల్': 'Warangal',
    'యాదాద్రి భువనగిరి': 'Yadadri Bhuvanagiri',
    'యాదాద్రి': 'Yadadri Bhuvanagiri'
}

# ============================================================
# 4. STATEWIDE HIGH-PROFILE LEADERS
# When mentioned, these ONLY assign to their constituency IF:
# 1) The article is from their home district, OR
# 2) Their constituency name is explicitly mentioned in the text!
# Otherwise, general state news does not pollute their MLA portal.
# ============================================================
STATE_LEADERS_HOME_CONSTITUENCY = {
    'revanth reddy': 'Kodangal', 'రేవంత్ రెడ్డి': 'Kodangal', 'రేవంత్': 'Kodangal', 'cm revanth': 'Kodangal',
    'kcr': 'Gajwel', 'కెసిఆర్': 'Gajwel', 'కేసీఆర్': 'Gajwel', 'చంద్రశేఖర్ రావు': 'Gajwel',
    'ktr': 'Sircilla', 'కేటీఆర్': 'Sircilla', 'తారక రామారావు': 'Sircilla', 'k.t. rama rao': 'Sircilla',
    'harish rao': 'Siddipet', 'హరీష్ రావు': 'Siddipet', 'హరీశ్ రావు': 'Siddipet',
    'seethakka': 'Mulugu (ST)', 'సీతక్క': 'Mulugu (ST)', 'దానసరి అనసూయ': 'Mulugu (ST)', 'dansari anasuya': 'Mulugu (ST)',
    'bhatti vikramarka': 'Madhira (SC)', 'భట్టి విక్రమార్క': 'Madhira (SC)',
    'uttam kumar reddy': 'Huzurnagar', 'ఉత్తమ్ కుమార్ రెడ్డి': 'Huzurnagar',
    'damodar raja narasimha': 'Andole (SC)', 'దామోదర రాజనర్సింహ': 'Andole (SC)', 'రాజనర్సింహ': 'Andole (SC)',
    'sridhar babu': 'Manthani', 'శ్రీధర్ బాబు': 'Manthani', 'దుద్దిళ్ల శ్రీధర్ బాబు': 'Manthani',
    'ponguleti srinivasa reddy': 'Palair', 'పొంగులేటి శ్రీనివాస్ రెడ్డి': 'Palair', 'పొంగులేటి': 'Palair',
    'komatireddy venkat reddy': 'Nalgonda', 'కోమటిరెడ్డి వెంకట్ రెడ్డి': 'Nalgonda',
    'konda surekha': 'Warangal East', 'కొండా సురేఖ': 'Warangal East',
    'jupally krishna rao': 'Kollapur', 'జూపల్లి కృష్ణారావు': 'Kollapur',
    'ponnam prabhakar': 'Husnabad', 'పొన్నం ప్రభాకర్': 'Husnabad',
    'tummala nageswara rao': 'Khammam', 'తుమ్మల నాగేశ్వరరావు': 'Khammam'
}

# ============================================================
# 5. LOCAL POLITICIAN / MLA ALIASES (Direct Constituency Matches)
# ============================================================
LOCAL_POLITICIAN_ALIASES = {
    'payal shanker': 'Adilabad', 'పాయల్ శంకర్': 'Adilabad',
    'anil jadhav': 'Boath (ST)', 'అనిల్ జాదవ్': 'Boath (ST)',
    'tellam venkata rao': 'Bhadrachalam (ST)', 'తెల్లం వెంకట్రావు': 'Bhadrachalam (ST)',
    'kunamneni sambasiva rao': 'Kothagudem', 'కూనంనేని సాంబశివరావు': 'Kothagudem', 'కూనంనేని': 'Kothagudem',
    'payam venkateswarlu': 'Pinapaka (ST)', 'పాయం వెంకటేశ్వర్లు': 'Pinapaka (ST)',
    'koram kanakaiah': 'Yellandu (ST)', 'కోరం కనకయ్య': 'Yellandu (ST)',
    'adinarayana jare': 'Aswaraopeta (ST)', 'జారే ఆదినారాయణ': 'Aswaraopeta (ST)',
    'revuri prakash reddy': 'Parkal', 'రేవూరి ప్రకాష్ రెడ్డి': 'Parkal',
    'naini rajender reddy': 'Warangal West', 'నాయిని రాజేందర్ రెడ్డి': 'Warangal West',
    'kaleru venkatesh': 'Amberpet', 'కాలేరు వెంకటేష్': 'Amberpet',
    'mohammed mubeen': 'Bahadurpura', 'మహమ్మద్ ముబీన్': 'Bahadurpura',
    'akbaruddin owaisi': 'Chandrayangutta', 'అక్బరుద్దీన్ ఒవైసీ': 'Chandrayangutta',
    'asaduddin owaisi': 'Charminar', 'అసదుద్దీన్ ఒవైసీ': 'Charminar', 'mir zulfeqar ali': 'Charminar',
    'raja singh': 'Goshamahal', 'రాజా సింగ్': 'Goshamahal', 'రాజాసింగ్': 'Goshamahal',
    'maganti gopinath': 'Jubilee Hills', 'మాగంటి గోపీనాథ్': 'Jubilee Hills',
    'kausar mohiuddin': 'Karwan', 'కౌసర్ మొహియుద్దీన్': 'Karwan',
    'danam nagender': 'Khairatabad', 'దానం నాగేందర్': 'Khairatabad',
    'ahmed bin abdullah balala': 'Malakpet', 'బలాలా': 'Malakpet',
    'muta gopal': 'Musheerabad', 'ముఠా గోపాల్': 'Musheerabad',
    'majid hussain': 'Nampally', 'మాజిద్ హుస్సేన్': 'Nampally',
    'talasani srinivas yadav': 'Sanathnagar', 'తలసాని శ్రీనివాస్ యాదవ్': 'Sanathnagar', 'తలసాని': 'Sanathnagar',
    'padma rao goud': 'Secunderabad', 'పద్మారావు గౌడ్': 'Secunderabad',
    'sri ganesh narayanan': 'Secunderabad Cantt. (SC)', 'శ్రీ గణేష్ నారాయణన్': 'Secunderabad Cantt. (SC)',
    'jaffar hussain': 'Yakutpura', 'జాఫర్ హుస్సేన్': 'Yakutpura',
    'adluri laxman kumar': 'Dharmapuri (SC)', 'అడ్లూరి లక్ష్మణ్ కుమార్': 'Dharmapuri (SC)',
    'sanjay kumar': 'Jagtial', 'డాక్టర్ సంజయ్ కుమార్': 'Jagtial',
    'kalvakuntla sanjay': 'Koratla', 'కల్వకుంట్ల సంజయ్': 'Koratla',
    'palla rajeshwar reddy': 'Jangaon', 'పల్లా రాజేశ్వర్ రెడ్డి': 'Jangaon',
    'yashaswini mamilidala': 'Palakurthi', 'యశస్విని మామిడాల': 'Palakurthi',
    'kadiyam srihari': 'Station Ghanpur (SC)', 'కడియం శ్రీహరి': 'Station Ghanpur (SC)',
    'gandra satyanarayana rao': 'Bhupalpalle', 'గండ్ర సత్యనారాయణ రావు': 'Bhupalpalle',
    'vijayudu': 'Alampur (SC)', 'విజయుడు': 'Alampur (SC)',
    'bandla krishna mohan reddy': 'Gadwal', 'బండ్ల కృష్ణమోహన్ రెడ్డి': 'Gadwal',
    'pocharam srinivas reddy': 'Banswada', 'పోచారం శ్రీనివాస్ రెడ్డి': 'Banswada', 'పోచారం': 'Banswada',
    'laxmi kantha rao thota': 'Jukkal (SC)', 'తోట లక్ష్మీకాంతరావు': 'Jukkal (SC)',
    'venkata ramana reddy': 'Kamareddy', 'వెంకటరమణారెడ్డి': 'Kamareddy',
    'madan mohan rao': 'Yellareddy', 'మదన్ మోహన్ రావు': 'Yellareddy',
    'medipally satyam': 'Choppadandi (SC)', 'మేడిపల్లి సత్యం': 'Choppadandi (SC)',
    'kaushik reddy': 'Huzurabad', 'పాడి కౌశిక్ రెడ్డి': 'Huzurabad',
    'gangula kamalakar': 'Karimnagar', 'గంగుల కమలాకర్': 'Karimnagar', 'గంగుల': 'Karimnagar',
    'kavvampally satyanarayana': 'Manakondur (SC)', 'కవ్వంపల్లి సత్యనారాయణ': 'Manakondur (SC)',
    'matta ragamayee': 'Sathupalli (SC)', 'మట్టా రాగమయి': 'Sathupalli (SC)',
    'maloth ramdas': 'Wyra (ST)', 'మాలోత్ రాందాస్': 'Wyra (ST)',
    'kova laxmi': 'Asifabad (ST)', 'కోవా లక్ష్మి': 'Asifabad (ST)',
    'palvai harish babu': 'Sirpur', 'పాల్వాయి హరీష్ బాబు': 'Sirpur',
    'ram chander naik': 'Dornakal (ST)', 'రాంచందర్ నాయక్': 'Dornakal (ST)',
    'murali naik': 'Mahabubabad (ST)', 'మురళీ నాయక్': 'Mahabubabad (ST)',
    'madhusudan reddy': 'Devarkadra', 'మధుసూదన్ రెడ్డి': 'Devarkadra',
    'anirudh reddy': 'Jadcherla', 'అనిరుధ్ రెడ్డి': 'Jadcherla',
    'yennam srinivas reddy': 'Mahabubnagar', 'ఎన్నం శ్రీనివాస్ రెడ్డి': 'Mahabubnagar',
    'gaddam vinod': 'Bellampalli (SC)', 'గడ్డం వినోద్': 'Bellampalli (SC)',
    'vivek venkat swamy': 'Chennur (SC)', 'వివేక్ వెంకటస్వామి': 'Chennur (SC)', 'గడ్డం వివేక్': 'Chennur (SC)',
    'premsagar rao': 'Mancherial', 'ప్రేమ్‌సాగర్ రావు': 'Mancherial', 'కొక్కిరాల ప్రేమ్‌సాగర్': 'Mancherial',
    'mynampally rohith': 'Medak', 'మైనంపల్లి రోహిత్': 'Medak',
    'sunitha laxma reddy': 'Narsapur', 'సునీతా లక్ష్మారెడ్డి': 'Narsapur',
    'madhavaram krishna rao': 'Kukatpally', 'మాధవరం కృష్ణారావు': 'Kukatpally',
    'marri rajasekhar reddy': 'Malkajgiri', 'మర్రి రాజశేఖర్ రెడ్డి': 'Malkajgiri',
    'etala rajender': 'Malkajgiri', 'eatala rajender': 'Malkajgiri', 'etela rajender': 'Malkajgiri', 'ఈటల రాజేందర్': 'Malkajgiri',
    'malla reddy': 'Medchal', 'మల్లారెడ్డి': 'Medchal', 'చామకూర మల్లారెడ్డి': 'Medchal',
    'kuna pandu vivekanand': 'Quthbullapur', 'వివేకానంద గౌడ్': 'Quthbullapur',
    'bandaru lakshma reddy': 'Uppal', 'బండారు లక్ష్మారెడ్డి': 'Uppal',
    'chikudu vamshi krishna': 'Achampet (SC)', 'చిక్కుడు వంశీకృష్ణ': 'Achampet (SC)',
    'kasireddy narayan reddy': 'Kalwakurthy', 'కసిరెడ్డి నారాయణరెడ్డి': 'Kalwakurthy',
    'rajesh reddy': 'Nagarkurnool', 'రాజేష్ రెడ్డి': 'Nagarkurnool',
    'balu naik': 'Devarakonda (ST)', 'బాలు నాయక్': 'Devarakonda (ST)',
    'bathula laxma reddy': 'Miryalaguda', 'బత్తుల లక్ష్మారెడ్డి': 'Miryalaguda',
    'komatireddy rajgopal reddy': 'Munugode', 'రాజ్ గోపాల్ రెడ్డి': 'Munugode', 'కోమటిరెడ్డి రాజగోపాల్': 'Munugode',
    'jaiveer kunduru': 'Nagarjuna Sagar', 'కుందురు జైవీర్': 'Nagarjuna Sagar', 'జైవీర్': 'Nagarjuna Sagar',
    'vemula veeresham': 'Nakrekal (SC)', 'వేముల వీరేశం': 'Nakrekal (SC)',
    'vakiti srihari': 'Makthal', 'వాకిటి శ్రీహరి': 'Makthal',
    'parnika reddy': 'Narayanpet', 'పర్ణికా రెడ్డి': 'Narayanpet',
    'vedma bhojju': 'Khanapur (ST)', 'వెడ్మ బొజ్జు': 'Khanapur (ST)',
    'ramarao pawar': 'Mudhole', 'రామారావు పవార్': 'Mudhole',
    'maheshwar reddy': 'Nirmal', 'మహేశ్వర్ రెడ్డి': 'Nirmal', 'ఏలేటి మహేశ్వర్': 'Nirmal',
    'paidi rakesh reddy': 'Armur', 'పైడి రాకేశ్ రెడ్డి': 'Armur',
    'prashanth reddy': 'Balkonda', 'వేముల ప్రశాంత్ రెడ్డి': 'Balkonda', 'ప్రశాంత్ రెడ్డి': 'Balkonda',
    'sudharshan reddy': 'Bodhan', 'సుదర్శన్ రెడ్డి': 'Bodhan',
    'bhupathi reddy': 'Nizamabad Rural', 'భూపతి రెడ్డి': 'Nizamabad Rural',
    'suryanarayana gupta': 'Nizamabad Urban', 'ధన్‌పాల్ సూర్యనారాయణ': 'Nizamabad Urban',
    'vijaya ramana rao': 'Peddapalle', 'విజయ రమణారావు': 'Peddapalle',
    'makkan singh': 'Ramagundam', 'మక్కన్ సింగ్': 'Ramagundam', 'రాజ్ ఠాకూర్': 'Ramagundam', 'raj thakur': 'Ramagundam',
    'aadi srinivas': 'Vemulawada', 'ఆది శ్రీనివాస్': 'Vemulawada',
    'kale yadaiah': 'Chevella (SC)', 'కాలే యాదయ్య': 'Chevella (SC)',
    'malreddy ranga reddy': 'Ibrahimpatnam', 'మల్రెడ్డి రంగారెడ్డి': 'Ibrahimpatnam',
    'sudheer reddy': 'L.B. Nagar', 'దేవిరెడ్డి సుధీర్ రెడ్డి': 'L.B. Nagar',
    'sabitha indra reddy': 'Maheshwaram', 'సబితా ఇంద్రారెడ్డి': 'Maheshwaram', 'సబితారెడ్డి': 'Maheshwaram',
    'prakash goud': 'Rajendranagar', 'ప్రకాష్ గౌడ్': 'Rajendranagar',
    'arekapudi gandhi': 'Serilingampally', 'అరికెపూడి గాంధీ': 'Serilingampally',
    'shankaraiah': 'Shadnagar', 'శంకర్‌రావ్': 'Shadnagar',
    'sanjeeva reddy': 'Narayankhed', 'సంజీవరెడ్డి': 'Narayankhed',
    'mahipal reddy': 'Patancheru', 'గూడెం మహిపాల్ రెడ్డి': 'Patancheru',
    'chinta prabhakar': 'Sangareddy', 'చింతా ప్రభాకర్': 'Sangareddy',
    'manik rao': 'Zahirabad (SC)', 'మాణిక్ రావు': 'Zahirabad (SC)',
    'kotha prabhakar reddy': 'Dubbak', 'కొత్త ప్రభాకర్ రెడ్డి': 'Dubbak',
    'padmavathi reddy': 'Kodad', 'పద్మావతి రెడ్డి': 'Kodad',
    'jagadish reddy': 'Suryapet', 'జగదీష్ రెడ్డి': 'Suryapet',
    'mandula samual': 'Thungathurthi (SC)', 'మందుల సా Samuel': 'Thungathurthi (SC)',
    'ram mohan reddy': 'Pargi', 'రామ్మోహన్ రెడ్డి': 'Pargi',
    'manohar reddy': 'Tandur', 'మనోహర్ రెడ్డి': 'Tandur',
    'prasad kumar': 'Vikarabad (SC)', 'గడ్డం ప్రసాద్ కుమార్': 'Vikarabad (SC)',
    'megha reddy': 'Wanaparthy', 'మేఘారెడ్డి': 'Wanaparthy',
    'madhava reddy': 'Narasampet', 'దొంతి మాధవరెడ్డి': 'Narasampet',
    'nagaraju': 'Wardhannapet (SC)', 'కె.ఆర్. నాగరాజు': 'Wardhannapet (SC)',
    'beerla ilaiah': 'Alair', 'బీర్ల అయిలయ్య': 'Alair', 'బీర్ల': 'Alair',
    'anil kumar reddy': 'Bhongir', 'కుంభం అనిల్ కుమార్ రెడ్డి': 'Bhongir'
}

# ============================================================
# 6. COMPREHENSIVE MANDALS & LOCAL TOWNS (Bilingual EN & TE)
# Mapped by (district_name, mandal_keyword) -> canonical constituency
# This ensures that a town in Mancherial (like Nelki Venkatapur) NEVER matches Mulugu!
# ============================================================
DISTRICT_MANDAL_MAP: Dict[str, Dict[str, str]] = {
    "Peddapalli": {
        "ramagundam": "Ramagundam", "రామగుండం": "Ramagundam",
        "godavarikhani": "Ramagundam", "గోదావరిఖని": "Ramagundam",
        "anthergaon": "Ramagundam", "అంతర్గాం": "Ramagundam",
        "fci": "Ramagundam", "ntpc": "Ramagundam", "ఎన్టీపీసీ": "Ramagundam",
        "singareni rg": "Ramagundam", "ఆర్జీ 1": "Ramagundam",
        "manthani": "Manthani", "మంథని": "Manthani",
        "mutharam": "Manthani", "ముత్తారం": "Manthani",
        "ramagiri": "Manthani", "రామగిరి": "Manthani",
        "kamanpur": "Manthani", "కమాన్‌పూర్": "Manthani",
        "peddapalli": "Peddapalle", "పెద్దపల్లి": "Peddapalle",
        "sultanabad": "Peddapalle", "సుల్తానాబాద్": "Peddapalle",
        "odela": "Peddapalle", "ఓదెల": "Peddapalle",
        "julapalli": "Peddapalle", "జూలపల్లి": "Peddapalle",
        "dharmaram": "Peddapalle", "ధర్మారం": "Peddapalle",
        "eligaid": "Peddapalle", "ఎలిగేడు": "Peddapalle"
    },
    "Mulugu": {
        "mulugu": "Mulugu (ST)", "ములుగు": "Mulugu (ST)",
        "eturnagaram": "Mulugu (ST)", "ఏటూరునాగారం": "Mulugu (ST)",
        "medaram": "Mulugu (ST)", "మేడారం": "Mulugu (ST)",
        "sammakka": "Mulugu (ST)", "సమ్మక్క సారలమ్మ": "Mulugu (ST)",
        "govindaraopet": "Mulugu (ST)", "గోవిందరావుపేట": "Mulugu (ST)",
        "tadvai": "Mulugu (ST)", "తాడ్వాయి": "Mulugu (ST)",
        "mangapet": "Mulugu (ST)", "మంగపేట": "Mulugu (ST)",
        "kannaigudem": "Mulugu (ST)", "కన్నాయిగూడెం": "Mulugu (ST)",
        "venkatapur": "Mulugu (ST)", "వెంకటాపురం": "Mulugu (ST)"
    },
    "Mancherial": {
        "mancherial": "Mancherial", "మంచిర్యాల": "Mancherial",
        "naspur": "Mancherial", "నస్పూర్": "Mancherial",
        "dandepally": "Mancherial", "దండేపల్లి": "Mancherial",
        "luxettipet": "Mancherial", "లక్షెట్టిపేట": "Mancherial",
        "jannaram": "Mancherial", "జన్నారం": "Mancherial",
        "hajipur": "Mancherial", "హాజీపూర్": "Mancherial",
        "bellampalli": "Bellampalli (SC)", "బెల్లంపల్లి": "Bellampalli (SC)",
        "kasipet": "Bellampalli (SC)", "కాశీపేట": "Bellampalli (SC)",
        "tandur mancherial": "Bellampalli (SC)", "తాండూరు మంచిర్యాల": "Bellampalli (SC)",
        "nennal": "Bellampalli (SC)", "నెన్నెల": "Bellampalli (SC)",
        "kannepalli": "Bellampalli (SC)", "కన్నెపల్లి": "Bellampalli (SC)",
        "chennur": "Chennur (SC)", "చెన్నూరు": "Chennur (SC)",
        "mandamarri": "Chennur (SC)", "మందమర్రి": "Chennur (SC)",
        "kotapally": "Chennur (SC)", "కోటపల్లి": "Chennur (SC)",
        "jaipur": "Chennur (SC)", "జైపూర్": "Chennur (SC)",
        "bheemaram": "Chennur (SC)", "భీమారం": "Chennur (SC)"
    },
    "Rajanna Sircilla": {
        "sircilla": "Sircilla", "సిరిసిల్ల": "Sircilla",
        "rajanna sircilla": "Sircilla", "రాజన్న సిరిసిల్ల": "Sircilla",
        "thangallapalli": "Sircilla", "తంగళ్లపల్లి": "Sircilla",
        "mustabad": "Sircilla", "ముస్తాబాద్": "Sircilla",
        "gambhiraopet": "Sircilla", "గంభీరావుపేట": "Sircilla",
        "yellareddypet": "Sircilla", "ఎల్లారెడ్డిపేట": "Sircilla",
        "veernapalli": "Sircilla", "వీర్నపల్లి": "Sircilla",
        "vemulawada": "Vemulawada", "వేములవాడ": "Vemulawada",
        "chandurthi": "Vemulawada", "చందుర్తి": "Vemulawada",
        "boinpalli": "Vemulawada", "బోయినపల్లి": "Vemulawada",
        "konaraopet": "Vemulawada", "కోనరావుపేట": "Vemulawada",
        "rudrangi": "Vemulawada", "రుద్రంగి": "Vemulawada"
    },
    "Sangareddy": {
        "sangareddy": "Sangareddy", "సంగారెడ్డి": "Sangareddy",
        "sadashivpet": "Sangareddy", "సదాశివపేట": "Sangareddy", "sadasivpet": "Sangareddy",
        "kandi": "Sangareddy", "కంది": "Sangareddy",
        "kondapur sangareddy": "Sangareddy",
        "patancheru": "Patancheru", "పటాన్‌చెరు": "Patancheru",
        "ameenpur": "Patancheru", "అమీన్‌పూర్": "Patancheru",
        "tellapur": "Patancheru", "తెల్లాపూర్": "Patancheru",
        "rc puram": "Patancheru", "రామచంద్రాపురం": "Patancheru",
        "gummadidala": "Patancheru", "గుమ్మడిదల": "Patancheru",
        "jinnaram": "Patancheru", "జిన్నారం": "Patancheru",
        "bhel": "Patancheru",
        "andole": "Andole (SC)", "ఆందోల్": "Andole (SC)",
        "jogipet": "Andole (SC)", "జోగిపేట": "Andole (SC)",
        "raikode": "Andole (SC)", "రాయికోడ్": "Andole (SC)",
        "tekmall": "Andole (SC)", "టెక్మాల్": "Andole (SC)",
        "vatpally": "Andole (SC)", "వట్‌పల్లి": "Andole (SC)",
        "alladurg": "Andole (SC)", "అల్లాదుర్గం": "Andole (SC)",
        "zahirabad": "Zahirabad (SC)", "జహీరాబాద్": "Zahirabad (SC)", "zaheerabad": "Zahirabad (SC)",
        "kohir": "Zahirabad (SC)", "కోహీర్": "Zahirabad (SC)",
        "nyalkal": "Zahirabad (SC)", "న్యాల్కల్": "Zahirabad (SC)",
        "jharasangam": "Zahirabad (SC)", "ఝరాసంగం": "Zahirabad (SC)",
        "mogudampally": "Zahirabad (SC)", "మొగుడంపల్లి": "Zahirabad (SC)",
        "narayankhed": "Narayankhed", "నారాయణఖేడ్": "Narayankhed",
        "kangti": "Narayankhed", "కంగ్టి": "Narayankhed",
        "manoor": "Narayankhed", "మానూర్": "Narayankhed"
    },
    "Nizamabad": {
        "nizamabad": "Nizamabad Urban", "నిజామాబాద్": "Nizamabad Urban",
        "armur": "Armur", "ఆర్మూర్": "Armur",
        "nandipet": "Armur", "నందిపేట్": "Armur",
        "makloor": "Armur", "మాక్లూర్": "Armur",
        "bodhan": "Bodhan", "బోధన్": "Bodhan",
        "ranjal": "Bodhan", "రంజల్": "Bodhan",
        "yedpally": "Bodhan", "యెడపల్లి": "Bodhan",
        "navipet": "Bodhan", "నవీపేట్": "Bodhan",
        "balkonda": "Balkonda", "బాల్కొండ": "Balkonda",
        "velpur": "Balkonda", "వేల్పూర్": "Balkonda",
        "mupkal": "Balkonda", "ముప్కాల్": "Balkonda",
        "kammarpally": "Balkonda", "కమ్మర్‌పల్లి": "Balkonda",
        "bheemgal": "Balkonda", "భీమ్‌గల్": "Balkonda",
        "dichpally": "Nizamabad Rural", "డిచ్‌పల్లి": "Nizamabad Rural",
        "indalwai": "Nizamabad Rural", "ఇందల్వాయి": "Nizamabad Rural",
        "jakranpally": "Nizamabad Rural", "జక్రాన్‌పల్లి": "Nizamabad Rural",
        "sirikonda": "Nizamabad Rural", "సిరికొండ": "Nizamabad Rural",
        "dharpally": "Nizamabad Rural", "ధర్పల్లి": "Nizamabad Rural"
    },
    "Nalgonda": {
        "nalgonda": "Nalgonda", "నల్గొండ": "Nalgonda",
        "miryalaguda": "Miryalaguda", "మిర్యాలగూడ": "Miryalaguda",
        "devarakonda": "Devarakonda (ST)", "దేవరకొండ": "Devarakonda (ST)",
        "munugode": "Munugode", "మునుగోడు": "Munugode",
        "chandur": "Munugode", "చండూరు": "Munugode",
        "choutuppal": "Munugode", "చౌటుప్పల్": "Munugode",
        "nagarjuna sagar": "Nagarjuna Sagar", "నాగార్జున సాగర్": "Nagarjuna Sagar", "నాగార్జునసాగర్": "Nagarjuna Sagar",
        "nidamanoor": "Nagarjuna Sagar", "నిడమనూరు": "Nagarjuna Sagar",
        "tripuraram": "Nagarjuna Sagar", "త్రిపురారం": "Nagarjuna Sagar",
        "anumula": "Nagarjuna Sagar", "అనుముల": "Nagarjuna Sagar",
        "nakrekal": "Nakrekal (SC)", "నకిరేకల్": "Nakrekal (SC)",
        "chityala": "Nakrekal (SC)", "చిట్యాల": "Nakrekal (SC)",
        "narketpally": "Nakrekal (SC)", "నార్కట్‌పల్లి": "Nakrekal (SC)"
    },
    "Yadadri Bhuvanagiri": {
        "alair": "Alair", "ఆలేరు": "Alair",
        "yadagirigutta": "Alair", "యాదగిరిగుట్ట": "Alair",
        "turkapally": "Alair", "తుర్కపల్లి": "Alair",
        "rajapet": "Alair", "రాజాపేట": "Alair",
        "gundala yadadri": "Alair", "గుండాల": "Alair",
        "bhongir": "Bhongir", "భువనగిరి": "Bhongir",
        "bibinagar": "Bhongir", "బీబీనగర్": "Bhongir",
        "pochampally": "Bhongir", "పోచంపల్లి": "Bhongir"
    },
    "Nirmal": {
        "nirmal": "Nirmal", "నిర్మల్": "Nirmal",
        "soan": "Nirmal", "సోన్": "Nirmal",
        "mudhole": "Mudhole", "ముధోల్": "Mudhole",
        "basar": "Mudhole", "బాసర": "Mudhole",
        "bhainsa": "Mudhole", "భైంసా": "Mudhole",
        "tanoor": "Mudhole", "తానూర్": "Mudhole",
        "khanapur": "Khanapur (ST)", "ఖానాపూర్": "Khanapur (ST)",
        "kaddam": "Khanapur (ST)", "కడెం": "Khanapur (ST)"
    },
    "Jogulamba Gadwal": {
        "gadwal": "Gadwal", "గద్వాల": "Gadwal",
        "dharur gadwal": "Gadwal", "ధరూర్": "Gadwal",
        "alampur": "Alampur (SC)", "ఆలంపూర్": "Alampur (SC)",
        "undavelli": "Alampur (SC)", "ఉండవెల్లి": "Alampur (SC)",
        "manopad": "Alampur (SC)", "మానవపాడు": "Alampur (SC)",
        "waddepally": "Alampur (SC)", "వడ్డేపల్లి": "Alampur (SC)",
        "itikyala": "Alampur (SC)", "ఇటిక్యాల": "Alampur (SC)",
        "rajoli": "Alampur (SC)", "రాజోలి": "Alampur (SC)"
    },
    "Bhadradri Kothagudem": {
        "kothagudem": "Kothagudem", "కొత్తగూడెం": "Kothagudem",
        "palvancha": "Kothagudem", "పాల్వంచ": "Kothagudem",
        "bhadrachalam": "Bhadrachalam (ST)", "భద్రాచలం": "Bhadrachalam (ST)",
        "cherla": "Bhadrachalam (ST)", "చెర్ల": "Bhadrachalam (ST)",
        "dummugudem": "Bhadrachalam (ST)", "దుమ్ముగూడెం": "Bhadrachalam (ST)",
        "pinapaka": "Pinapaka (ST)", "పినపాక": "Pinapaka (ST)",
        "manuguru": "Pinapaka (ST)", "మణుగూరు": "Pinapaka (ST)",
        "aswapuram": "Pinapaka (ST)", "అశ్వాపురం": "Pinapaka (ST)",
        "burgampahad": "Pinapaka (ST)", "బూర్గంపాడు": "Pinapaka (ST)",
        "yellandu": "Yellandu (ST)", "ఇల్లందు": "Yellandu (ST)", "యెల్లందు": "Yellandu (ST)",
        "tekulapally": "Yellandu (ST)", "టేకులపల్లి": "Yellandu (ST)",
        "bayyaram": "Yellandu (ST)", "బయ్యారం": "Yellandu (ST)",
        "garla": "Yellandu (ST)", "గార్ల": "Yellandu (ST)",
        "aswaraopeta": "Aswaraopeta (ST)", "అశ్వారావుపేట": "Aswaraopeta (ST)",
        "dammapeta": "Aswaraopeta (ST)", "దమ్మపేట": "Aswaraopeta (ST)"
    },
    "Hyderabad": {
        "amberpet": "Amberpet", "అంబర్‌పేట్": "Amberpet",
        "bahadurpura": "Bahadurpura", "బహదూర్‌పురా": "Bahadurpura", "బహదూర్ పురా": "Bahadurpura",
        "nehru zoological park": "Bahadurpura", "nehru zoo": "Bahadurpura", "hyderabad zoo": "Bahadurpura", "zoo park": "Bahadurpura",
        "నెహ్రూ జూలాజికల్ పార్క్": "Bahadurpura", "నెహ్రూ జూ": "Bahadurpura", "జూ పార్క్": "Bahadurpura", "జూపార్క్": "Bahadurpura",
        "falaknuma": "Bahadurpura", "ఫలక్‌నుమా": "Bahadurpura", "ఫలక్ నుమా": "Bahadurpura",
        "mir alam": "Bahadurpura", "మీర్ ఆలం": "Bahadurpura", "tadbun": "Bahadurpura", "తాడ్‌బండ్": "Bahadurpura", "తాడ్ బండ్": "Bahadurpura",
        "kishanbagh": "Bahadurpura", "కిషన్‌బాగ్": "Bahadurpura", "కిషన్ బాగ్": "Bahadurpura", "aliabad": "Bahadurpura", "అలీబాద్": "Bahadurpura",
        "puranapool": "Bahadurpura", "పురానాపూల్": "Bahadurpura", "kalapathar": "Bahadurpura", "కాలాపత్తర్": "Bahadurpura",
        "vattepally": "Bahadurpura", "వట్టేపల్లి": "Bahadurpura",
        "chandrayangutta": "Chandrayangutta", "చాంద్రాయణగుట్ట": "Chandrayangutta", "barkas": "Chandrayangutta",
        "charminar": "Charminar", "చార్మినార్": "Charminar", "pathergatti": "Charminar",
        "goshamahal": "Goshamahal", "గోషామహల్": "Goshamahal", "dhoolpet": "Goshamahal", "ధూల్‌పేట్": "Goshamahal", "mangalhat": "Goshamahal", "begum bazar": "Goshamahal", "బేగం బజార్": "Goshamahal",
        "jubilee hills": "Jubilee Hills", "జూబ్లీహిల్స్": "Jubilee Hills", "banjara hills": "Jubilee Hills", "బంజారాహిల్స్": "Jubilee Hills", "film nagar": "Jubilee Hills",
        "karwan": "Karwan", "కార్వాన్": "Karwan", "golconda": "Karwan", "గోల్కొండ": "Karwan", "toli chowki": "Karwan", "తోలిచౌకి": "Karwan",
        "khairatabad": "Khairatabad", "ఖైరతాబాద్": "Khairatabad", "somajiguda": "Khairatabad", "సోమాజిగూడ": "Khairatabad", "punjagutta": "Khairatabad", "పంజాగుట్ట": "Khairatabad",
        "malakpet": "Malakpet", "మలక్‌పేట్": "Malakpet", "chanchalguda": "Malakpet", "చంచల్‌గూడ": "Malakpet", "saidabad": "Malakpet", "సైదాబాద్": "Malakpet",
        "musheerabad": "Musheerabad", "ముషీరాబాద్": "Musheerabad", "ramnagar": "Musheerabad", "రాంనగర్": "Musheerabad", "kavadiguda": "Musheerabad", "కవాడిగూడ": "Musheerabad",
        "nampally": "Nampally", "నాంపల్లి": "Nampally", "mehdipatnam": "Nampally", "మెహదీపట్నం": "Nampally", "asif nagar": "Nampally", "మల్లేపల్లి": "Nampally",
        "sanathnagar": "Sanathnagar", "సనత్‌నగర్": "Sanathnagar", "sr nagar": "Sanathnagar", "ఎస్సార్ నగర్": "Sanathnagar", "balkampet": "Sanathnagar", "బల్కంపేట్": "Sanathnagar", "ameerpet": "Sanathnagar", "అమీర్‌పేట్": "Sanathnagar",
        "secunderabad": "Secunderabad", "సికింద్రాబాద్": "Secunderabad", "tarnaka": "Secunderabad", "తార్నాక": "Secunderabad", "chilkalguda": "Secunderabad",
        "secunderabad cantt": "Secunderabad Cantt. (SC)", "బోయిన్‌పల్లి": "Secunderabad Cantt. (SC)", "bowenpally": "Secunderabad Cantt. (SC)", "marredpally": "Secunderabad Cantt. (SC)",
        "yakutpura": "Yakutpura", "యాకూత్‌పురా": "Yakutpura", "యాకూత్ పురా": "Yakutpura",
        "madannapet": "Yakutpura", "మదన్నపేట": "Yakutpura", "santoshnagar": "Yakutpura", "santosh nagar": "Yakutpura",
        "సంతోష్‌నగర్": "Yakutpura", "సంతోష్ నగర్": "Yakutpura", "dabeerpura": "Yakutpura", "దబీర్‌పురా": "Yakutpura", "దబీర్ పురా": "Yakutpura",
        "rein bazar": "Yakutpura", "రెయిన్ బజార్": "Yakutpura", "bada bazaar": "Yakutpura", "బాడా బజార్": "Yakutpura",
        "talab katta": "Yakutpura", "తాబేలు కట్ట": "Yakutpura", "bhavani nagar": "Yakutpura", "భవానీ నగర్": "Yakutpura",
        "edibazar": "Yakutpura", "ఈడి బజార్": "Yakutpura"
    }
}

# ============================================================
# 7. DISTRICT KEYWORDS DETECTOR
# Returns recognized district name or None
# ============================================================
def detect_district(text: str) -> Optional[str]:
    """Detects which of the 33 districts is explicitly mentioned in the text."""
    if not text:
        return None
    lower = text.lower()
    
    # 1. Check Telugu district names
    for te_dist, canonical in DISTRICT_TELUGU_MAP.items():
        if te_dist in lower:
            return canonical
            
    # 2. Check English district names
    for dist in DISTRICT_TO_CONSTITUENCIES:
        if dist.lower() in lower:
            return dist
            
    return None

# ============================================================
# 8. MASTER INTELLIGENT CLASSIFICATION FUNCTION
# ============================================================


# ============================================================
# 8. MASTER 119 ASSEMBLY CONSTITUENCY MLAs & LEADER ALIASES
# Every single MLA across Telangana with native Telugu script
# & English aliases for high-precision article mapping.
# ============================================================

# ============================================================
# 8. MASTER 119 ASSEMBLY CONSTITUENCY MLAs & LEADER ALIASES
# Every single MLA across Telangana with native Telugu script
# & English aliases for high-precision article mapping.
# Single-word ambiguities disambiguated with honorifics.
# ============================================================
ALL_119_MLAS = {
    "Achampet (SC)": {
        "name": "Dr. Chikudu Vamshi Krishna",
        "district": "Nagarkurnool",
        "party": "INC",
        "aliases": ["chikudu vamshi krishna", "vamshi krishna", "చిక్కుడు వంశీకృష్ణ", "వంశీకృష్ణ", "వంశీ కృష్ణ"]
    },
    "Adilabad": {
        "name": "Payal Shanker",
        "district": "Adilabad",
        "party": "BJP",
        "aliases": ["payal shanker", "payal shankar", "పాయల్ శంకర్", "పాయల్ శంకర్"]
    },
    "Alair": {
        "name": "Beerla Ilaiah",
        "district": "Yadadri Bhuvanagiri",
        "party": "INC",
        "aliases": ["beerla ilaiah", "beerla ailaiah", "బీర్ల అయిలయ్య", "బీర్ల ఐలయ్య", "బీర్ల ఇలయ్య"]
    },
    "Alampur (SC)": {
        "name": "Vijayudu",
        "district": "Jogulamba Gadwal",
        "party": "BRS",
        "aliases": ["ఎమ్మెల్యే విజయుడు", "mla vijayudu", "alampur vijayudu", "విజయుడు ఎమ్మెల్యే"]
    },
    "Amberpet": {
        "name": "Kaleru Venkatesh",
        "district": "Hyderabad",
        "party": "BRS",
        "aliases": ["kaleru venkatesh", "కాలేరు వెంకటేష్", "ఎమ్మెల్యే కాలేరు", "ఎమ్మెల్యే వెంకటేష్"]
    },
    "Andole (SC)": {
        "name": "Damodar Raja Narasimha",
        "district": "Sangareddy",
        "party": "INC",
        "aliases": ["damodar raja narasimha", "raja narasimha", "దామోదర రాజనర్సింహ", "రాజనర్సింహ", "మంత్రి రాజనర్సింహ"]
    },
    "Armur": {
        "name": "Paidi Rakesh Reddy",
        "district": "Nizamabad",
        "party": "BJP",
        "aliases": ["paidi rakesh reddy", "rakesh reddy", "పైడి రాకేష్ రెడ్డి", "రాకేష్ రెడ్డి"]
    },
    "Asifabad (ST)": {
        "name": "Kova Laxmi",
        "district": "Komaram Bheem Asifabad",
        "party": "BRS",
        "aliases": ["kova laxmi", "kova lakshmi", "కోవా లక్ష్మి", "కోవా లక్ష్మీ"]
    },
    "Aswaraopeta (ST)": {
        "name": "Adinarayana Jare",
        "district": "Bhadradri Kothagudem",
        "party": "INC",
        "aliases": ["adinarayana jare", "jare adinarayana", "జారే ఆదినారాయణ", "ఆదినారాయణ జారే"]
    },
    "Bahadurpura": {
        "name": "Mohammed Mubeen",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["mohammed mubeen", "మహమ్మద్ ముబీన్", "ఎమ్మెల్యే ముబీన్"]
    },
    "Balkonda": {
        "name": "Vemula Prashanth Reddy",
        "district": "Nizamabad",
        "party": "BRS",
        "aliases": ["vemula prashanth reddy", "prashanth reddy", "వేముల ప్రశాంత్ రెడ్డి", "ప్రశాంత్ రెడ్డి"]
    },
    "Banswada": {
        "name": "Pocharam Srinivas Reddy",
        "district": "Kamareddy",
        "party": "INC",
        "aliases": ["pocharam srinivas reddy", "పోచారం శ్రీనివాస్ రెడ్డి", "పోచారం శ్రీనివాసరెడ్డి"]
    },
    "Bellampalli (SC)": {
        "name": "Gaddam Vinod",
        "district": "Mancherial",
        "party": "INC",
        "aliases": ["gaddam vinod", "గడ్డం వినోద్", "ఎమ్మెల్యే వినోద్"]
    },
    "Bhadrachalam (ST)": {
        "name": "Tellam Venkata Rao",
        "district": "Bhadradri Kothagudem",
        "party": "BRS",
        "aliases": ["tellam venkata rao", "venkata rao", "తెల్లం వెంకట్రావు", "తెల్లం వెంకట రావు"]
    },
    "Bhongir": {
        "name": "Kumbam Anil Kumar Reddy",
        "district": "Yadadri Bhuvanagiri",
        "party": "INC",
        "aliases": ["kumbam anil kumar reddy", "anil kumar reddy", "కుంభం అనిల్ కుమార్ రెడ్డి", "అనిల్ కుమార్ రెడ్డి"]
    },
    "Bhupalpalle": {
        "name": "Gandra Satyanarayana Rao",
        "district": "Jayashankar Bhupalpally",
        "party": "INC",
        "aliases": ["gandra satyanarayana rao", "గండ్ర సత్యనారాయణ రావు", "గండ్ర సత్యనారాయణ"]
    },
    "Boath (ST)": {
        "name": "Anil Jadhav",
        "district": "Adilabad",
        "party": "BRS",
        "aliases": ["anil jadhav", "అనిల్ జాదవ్"]
    },
    "Bodhan": {
        "name": "P. Sudharshan Reddy",
        "district": "Nizamabad",
        "party": "INC",
        "aliases": ["sudharshan reddy", "p. sudharshan reddy", "సుదర్శన్ రెడ్డి", "పి. సుదర్శన్ రెడ్డి"]
    },
    "Chandrayangutta": {
        "name": "Akbaruddin Owaisi",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["akbaruddin owaisi", "akbaruddin", "అక్బరుద్దీన్ ఒవైసీ", "అక్బరుద్దీన్"]
    },
    "Charminar": {
        "name": "Mir Zulfeqar Ali",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["mir zulfeqar ali", "zulfeqar ali", "జుల్ఫికర్ అలీ", "మీర్ జుల్ఫికర్ అలీ"]
    },
    "Chennur (SC)": {
        "name": "Vivek Venkat Swamy",
        "district": "Mancherial",
        "party": "INC",
        "aliases": ["vivek venkat swamy", "vivek venkataswamy", "gaddam vivek", "గడ్డం వివేక్", "వివేక్ వెంకటస్వామి"]
    },
    "Chevella (SC)": {
        "name": "Kale Yadaiah",
        "district": "Ranga Reddy",
        "party": "BRS",
        "aliases": ["kale yadaiah", "కాలె యాదయ్య", "కాలే యాదయ్య", "ఎమ్మెల్యే యాదయ్య"]
    },
    "Choppadandi (SC)": {
        "name": "Medipally Satyam",
        "district": "Karimnagar",
        "party": "INC",
        "aliases": ["medipally satyam", "medipally", "మేడిపల్లి సత్యం", "మేడిపల్లి", "ఎమ్మెల్యే సత్యం"]
    },
    "Devarakonda (ST)": {
        "name": "Balu Naik Nenavath",
        "district": "Nalgonda",
        "party": "INC",
        "aliases": ["balu naik", "nenavath balu naik", "బాలు నాయక్", "నెనవత్ బాలు నాయక్"]
    },
    "Devarkadra": {
        "name": "Gavinolla Madhusudan Reddy",
        "district": "Mahabubnagar",
        "party": "INC",
        "aliases": ["madhusudan reddy", "gavinolla madhusudan reddy", "మధుసూదన్ రెడ్డి", "జిఎంఆర్"]
    },
    "Dharmapuri (SC)": {
        "name": "Adluri Laxman Kumar",
        "district": "Jagtial",
        "party": "INC",
        "aliases": ["adluri laxman kumar", "laxman kumar", "అడ్లూరి లక్ష్మణ్ కుమార్", "లక్ష్మణ్ కుమార్"]
    },
    "Dornakal (ST)": {
        "name": "Jatoth Ram Chander Naik",
        "district": "Mahabubabad",
        "party": "INC",
        "aliases": ["ram chander naik", "jatoth ram chander naik", "రాంచందర్ నాయక్", "జాటోత్ రాంచందర్ నాయక్"]
    },
    "Dubbak": {
        "name": "Kotha Prabhakar Reddy",
        "district": "Siddipet",
        "party": "BRS",
        "aliases": ["kotha prabhakar reddy", "kotha prabhakar", "కొత్త ప్రభాకర్ రెడ్డి", "కొత్త ప్రభాకర్"]
    },
    "Gadwal": {
        "name": "Bandla Krishna Mohan Reddy",
        "district": "Jogulamba Gadwal",
        "party": "BRS",
        "aliases": ["krishna mohan reddy", "bandla krishna mohan reddy", "బండ్ల కృష్ణమోహన్ రెడ్డి", "కృష్ణమోహన్ రెడ్డి"]
    },
    "Gajwel": {
        "name": "K. Chandrashekar Rao (KCR)",
        "district": "Siddipet",
        "party": "BRS",
        "aliases": ["kcr", "chandrashekar rao", "kalvakuntla chandrashekar rao", "కేసీఆర్", "కెసిఆర్", "చంద్రశేఖర్ రావు", "కల్వకుంట్ల చంద్రశేఖర్ రావు"]
    },
    "Goshamahal": {
        "name": "T. Raja Singh",
        "district": "Hyderabad",
        "party": "BJP",
        "aliases": ["raja singh", "t. raja singh", "tiger raja singh", "రాజా సింగ్", "రాజాసింగ్", "గోషామహల్ రాజా సింగ్"]
    },
    "Husnabad": {
        "name": "Ponnam Prabhakar",
        "district": "Siddipet",
        "party": "INC",
        "aliases": ["ponnam prabhakar", "ponnam", "పొన్నం ప్రభాకర్", "పొన్నం", "మంత్రి పొన్నం"]
    },
    "Huzurabad": {
        "name": "Padi Kaushik Reddy",
        "district": "Karimnagar",
        "party": "BRS",
        "aliases": ["kaushik reddy", "padi kaushik reddy", "కౌశిక్ రెడ్డి", "పాడి కౌశిక్ రెడ్డి"]
    },
    "Huzurnagar": {
        "name": "Nalamada Uttam Kumar Reddy",
        "district": "Suryapet",
        "party": "INC",
        "aliases": ["uttam kumar reddy", "uttam", "నలమాడ ఉత్తమ్ కుమార్ రెడ్డి", "ఉత్తమ్ కుమార్ రెడ్డి", "ఉత్తమ్", "మంత్రి ఉత్తమ్"]
    },
    "Ibrahimpatnam": {
        "name": "Malreddy Ranga Reddy",
        "district": "Ranga Reddy",
        "party": "INC",
        "aliases": ["malreddy ranga reddy", "మల్రెడ్డి రంగారెడ్డి", "మల్రెడ్డి"]
    },
    "Jadcherla": {
        "name": "Janampalli Anirudh Reddy",
        "district": "Mahabubnagar",
        "party": "INC",
        "aliases": ["anirudh reddy", "janampalli anirudh reddy", "జనంపల్లి అనిరుధ్ రెడ్డి", "అనిరుధ్ రెడ్డి"]
    },
    "Jagtial": {
        "name": "Dr. M. Sanjay Kumar",
        "district": "Jagtial",
        "party": "BRS",
        "aliases": ["sanjay kumar", "dr. m. sanjay kumar", "డాక్టర్ సంజయ్ కుమార్", "సంజయ్ కుమార్"]
    },
    "Jangaon": {
        "name": "Palla Rajeshwar Reddy",
        "district": "Jangaon",
        "party": "BRS",
        "aliases": ["palla rajeshwar reddy", "palla", "పల్లా రాజేశ్వర్ రెడ్డి", "పల్లా రాజేశ్వర్రెడ్డి", "పల్లా"]
    },
    "Jubilee Hills": {
        "name": "Maganti Gopinath",
        "district": "Hyderabad",
        "party": "BRS",
        "aliases": ["maganti gopinath", "gopinath", "మాగంటి గోపీనాథ్", "గోపీనాథ్"]
    },
    "Jukkal (SC)": {
        "name": "Laxmi Kantha Rao Thota",
        "district": "Kamareddy",
        "party": "INC",
        "aliases": ["thota laxmi kantha rao", "laxmi kantha rao", "తోట లక్ష్మీకాంతారావు", "లక్ష్మీకాంతారావు"]
    },
    "Kalwakurthy": {
        "name": "Kasireddy Narayan Reddy",
        "district": "Nagarkurnool",
        "party": "INC",
        "aliases": ["kasireddy narayan reddy", "narayan reddy", "కసిరెడ్డి నారాయణ్ రెడ్డి", "కసిరెడ్డి నారాయణరెడ్డి"]
    },
    "Kamareddy": {
        "name": "Katipalli Venkata Ramana Reddy",
        "district": "Kamareddy",
        "party": "BJP",
        "aliases": ["katipalli venkata ramana reddy", "venkata ramana reddy", "కాటిపల్లి వెంకటరమణారెడ్డి", "వెంకటరమణారెడ్డి", "కెవిఆర్"]
    },
    "Karimnagar": {
        "name": "Gangula Kamalakar",
        "district": "Karimnagar",
        "party": "BRS",
        "aliases": ["gangula kamalakar", "gangula", "గంగుల కమలాకర్", "గంగుల"]
    },
    "Karwan": {
        "name": "Kausar Mohiuddin",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["kausar mohiuddin", "కౌసర్ మొహియుద్దీన్"]
    },
    "Khairatabad": {
        "name": "Danam Nagender",
        "district": "Hyderabad",
        "party": "INC",
        "aliases": ["danam nagender", "danam", "దానం నాగేందర్", "దానం"]
    },
    "Khammam": {
        "name": "Tummala Nageswara Rao",
        "district": "Khammam",
        "party": "INC",
        "aliases": ["tummala nageswara rao", "tummala", "తుమ్మల నాగేశ్వరరావు", "తుమ్మల నాగేశ్వర్ రావు", "తుమ్మల", "మంత్రి తుమ్మల"]
    },
    "Khanapur (ST)": {
        "name": "Vedma Bhojju",
        "district": "Nirmal",
        "party": "INC",
        "aliases": ["vedma bhojju", "వెడ్మ బొజ్జు", "ఎమ్మెల్యే వెడ్మ బొజ్జు"]
    },
    "Kodad": {
        "name": "Nalamada Padmavathi Reddy",
        "district": "Suryapet",
        "party": "INC",
        "aliases": ["padmavathi reddy", "nalamada padmavathi reddy", "పద్మావతి రెడ్డి", "నలమాడ పద్మావతి రెడ్డి"]
    },
    "Kodangal": {
        "name": "A. Revanth Reddy",
        "district": "Vikarabad",
        "party": "INC",
        "aliases": ["revanth reddy", "revanth", "cm revanth", "anmula revanth reddy", "రేవంత్ రెడ్డి", "రేవంత్", "సీఎం రేవంత్", "సిఎం రేవంత్", "రేవంత్‌రెడ్డి"]
    },
    "Kollapur": {
        "name": "Jupally Krishna Rao",
        "district": "Nagarkurnool",
        "party": "INC",
        "aliases": ["jupally krishna rao", "jupally", "జూపల్లి కృష్ణారావు", "జూపల్లి", "మంత్రి జూపల్లి"]
    },
    "Koratla": {
        "name": "Kalvakuntla Sanjay",
        "district": "Jagtial",
        "party": "BRS",
        "aliases": ["kalvakuntla sanjay", "dr. sanjay", "కల్వకుంట్ల సంజయ్", "డాక్టర్ సంజయ్"]
    },
    "Kothagudem": {
        "name": "Kunamneni Sambasiva Rao",
        "district": "Bhadradri Kothagudem",
        "party": "CPI",
        "aliases": ["kunamneni sambasiva rao", "kunamneni", "కూనంనేని సాంబశివరావు", "కూనంనేని"]
    },
    "Kukatpally": {
        "name": "Madhavaram Krishna Rao",
        "district": "Medchal-Malkajgiri",
        "party": "BRS",
        "aliases": ["madhavaram krishna rao", "krishna rao", "మాధవరం కృష్ణారావు", "మాధవరం"]
    },
    "L.B. Nagar": {
        "name": "Devireddy Sudheer Reddy",
        "district": "Ranga Reddy",
        "party": "BRS",
        "aliases": ["sudheer reddy", "devireddy sudheer reddy", "సుధీర్ రెడ్డి", "దేవిరెడ్డి సుధీర్ రెడ్డి"]
    },
    "Madhira (SC)": {
        "name": "Mallu Bhatti Vikramarka",
        "district": "Khammam",
        "party": "INC",
        "aliases": ["bhatti vikramarka", "mallu bhatti vikramarka", "bhatti", "భట్టి విక్రమార్క", "మల్లు భట్టి విక్రమార్క", "డిప్యూటీ సీఎం భట్టి", "భట్టి"]
    },
    "Mahabubabad (ST)": {
        "name": "Dr. Murali Naik Bhukya",
        "district": "Mahabubabad",
        "party": "INC",
        "aliases": ["murali naik", "dr. murali naik", "మురళీ నాయక్", "డాక్టర్ మురళీ నాయక్"]
    },
    "Mahabubnagar": {
        "name": "Yennam Srinivas Reddy",
        "district": "Mahabubnagar",
        "party": "INC",
        "aliases": ["yennam srinivas reddy", "srinivas reddy", "ఎన్నం శ్రీనివాస్ రెడ్డి", "ఎన్నం"]
    },
    "Maheshwaram": {
        "name": "Sabitha Indra Reddy",
        "district": "Ranga Reddy",
        "party": "BRS",
        "aliases": ["sabitha indra reddy", "sabitha reddy", "సబితా ఇంద్రారెడ్డి", "సబితారెడ్డి"]
    },
    "Makthal": {
        "name": "Vakiti Srihari",
        "district": "Narayanpet",
        "party": "INC",
        "aliases": ["vakiti srihari", "వాకిటి శ్రీహరి", "వాకిటి", "ఎమ్మెల్యే వాకిటి శ్రీహరి"]
    },
    "Malakpet": {
        "name": "Ahmed Bin Abdullah Balala",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["balala", "ahmed bin abdullah balala", "బలాలా", "అహ్మద్ బలాలా"]
    },
    "Malkajgiri": {
        "name": "Marri Rajasekhar Reddy",
        "district": "Medchal-Malkajgiri",
        "party": "BRS",
        "aliases": ["marri rajasekhar reddy", "rajasekhar reddy", "మర్రి రాజశేఖర్ రెడ్డి", "రాజశేఖర్ రెడ్డి"]
    },
    "Manakondur (SC)": {
        "name": "Kavvampally Satyanarayana",
        "district": "Karimnagar",
        "party": "INC",
        "aliases": ["kavvampally satyanarayana", "కవ్వంపల్లి సత్యనారాయణ", "కవ్వంపల్లి"]
    },
    "Mancherial": {
        "name": "Kokkirala Premsagar Rao",
        "district": "Mancherial",
        "party": "INC",
        "aliases": ["premsagar rao", "kokkirala premsagar rao", "కొక్కిరాల ప్రేమ్ సాగర్ రావు", "ప్రేమ్ సాగర్ రావు", "ప్రేంసాగర్ రావు"]
    },
    "Manthani": {
        "name": "Duddilla Sridhar Babu",
        "district": "Peddapalli",
        "party": "INC",
        "aliases": ["sridhar babu", "duddilla sridhar babu", "శ్రీధర్ బాబు", "దుద్దిళ్ల శ్రీధర్ బాబు", "మంత్రి శ్రీధర్ బాబు"]
    },
    "Medak": {
        "name": "Mynampally Rohith",
        "district": "Medak",
        "party": "INC",
        "aliases": ["mynampally rohith", "mynampally", "మైనంపల్లి రోహిత్", "మైనంపల్లి రోహిత్ రావు", "రోహిత్ రావు", "ఎమ్మెల్యే రోహిత్"]
    },
    "Medchal": {
        "name": "Chamakura Malla Reddy",
        "district": "Medchal-Malkajgiri",
        "party": "BRS",
        "aliases": ["malla reddy", "chamakura malla reddy", "మల్లారెడ్డి", "చామకూర మల్లారెడ్డి", "మల్లా రెడ్డి"]
    },
    "Miryalaguda": {
        "name": "Bathula Laxma Reddy",
        "district": "Nalgonda",
        "party": "INC",
        "aliases": ["bathula laxma reddy", "laxma reddy", "బత్తుల లక్ష్మారెడ్డి", "లక్ష్మారెడ్డి"]
    },
    "Mudhole": {
        "name": "Ramarao Pawar",
        "district": "Nirmal",
        "party": "BJP",
        "aliases": ["ramarao pawar", "రామారావు పవార్", "పవార్ రామారావు", "ఎమ్మెల్యే పవార్"]
    },
    "Mulugu (ST)": {
        "name": "Dansari Anasuya (Seethakka)",
        "district": "Mulugu",
        "party": "INC",
        "aliases": ["seethakka", "dansari anasuya", "anasuya seethakka", "సీతక్క", "దానసరి అనసూయ", "అనసూయ సీతక్క", "మంత్రి సీతక్క"]
    },
    "Munugode": {
        "name": "Komatireddy Rajgopal Reddy",
        "district": "Nalgonda",
        "party": "INC",
        "aliases": ["rajgopal reddy", "komatireddy rajgopal reddy", "రాజ్ గోపాల్ రెడ్డి", "కోమటిరెడ్డి రాజగోపాల్ రెడ్డి", "రాజగోపాల్ రెడ్డి"]
    },
    "Musheerabad": {
        "name": "Muta Gopal",
        "district": "Hyderabad",
        "party": "BRS",
        "aliases": ["muta gopal", "ముఠా గోపాల్", "ఎమ్మెల్యే ముఠా గోపాల్"]
    },
    "Nagarjuna Sagar": {
        "name": "Jaiveer Kunduru",
        "district": "Nalgonda",
        "party": "INC",
        "aliases": ["jaiveer kunduru", "kunduru jaiveer", "కుందూరి జయవీర్", "జయవీర్ రెడ్డి", "ఎమ్మెల్యే జయవీర్"]
    },
    "Nagarkurnool": {
        "name": "Dr. Kuchukulla Rajesh Reddy",
        "district": "Nagarkurnool",
        "party": "INC",
        "aliases": ["rajesh reddy", "kuchukulla rajesh reddy", "కూచుకుళ్ల రాజేష్ రెడ్డి", "రాజేష్ రెడ్డి"]
    },
    "Nakrekal (SC)": {
        "name": "Vemula Veeresham",
        "district": "Nalgonda",
        "party": "INC",
        "aliases": ["vemula veeresham", "వేముల వీరేశం", "ఎమ్మెల్యే వీరేశం"]
    },
    "Nalgonda": {
        "name": "Komatireddy Venkat Reddy",
        "district": "Nalgonda",
        "party": "INC",
        "aliases": ["komatireddy venkat reddy", "venkat reddy", "కోమటిరెడ్డి వెంకట్ రెడ్డి", "కోమటిరెడ్డి వెంకటరెడ్డి", "కోమటిరెడ్డి", "మంత్రి కోమటిరెడ్డి"]
    },
    "Nampally": {
        "name": "Mohammad Majid Hussain",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["majid hussain", "mohammad majid hussain", "మాజిద్ హుస్సేన్"]
    },
    "Narasampet": {
        "name": "Donthi Madhava Reddy",
        "district": "Warangal",
        "party": "INC",
        "aliases": ["donthi madhava reddy", "madhava reddy", "దొంతి మాధవరెడ్డి", "మాధవరెడ్డి"]
    },
    "Narayankhed": {
        "name": "Patlolla Sanjeeva Reddy",
        "district": "Sangareddy",
        "party": "INC",
        "aliases": ["sanjeeva reddy", "patlolla sanjeeva reddy", "సంజీవ రెడ్డి", "పాట్లోళ్ల సంజీవ రెడ్డి"]
    },
    "Narayanpet": {
        "name": "Dr. Parnika Reddy",
        "district": "Narayanpet",
        "party": "INC",
        "aliases": ["parnika reddy", "dr. parnika reddy", "డాక్టర్ పర్ణికా రెడ్డి", "పర్ణికా రెడ్డి", "పర్ణికారెడ్డి"]
    },
    "Narsapur": {
        "name": "Vakiti Sunitha Laxma Reddy",
        "district": "Medak",
        "party": "BRS",
        "aliases": ["sunitha laxma reddy", "సునీతా లక్ష్మారెడ్డి", "సునీతా లక్ష్మా రెడ్డి", "వాకిటి సునీత", "ఎమ్మెల్యే సునీత"]
    },
    "Nirmal": {
        "name": "Alleti Maheshwar Reddy",
        "district": "Nirmal",
        "party": "BJP",
        "aliases": ["maheshwar reddy", "alleti maheshwar reddy", "ఏలేటి మహేశ్వర్ రెడ్డి", "మహేశ్వర్ రెడ్డి"]
    },
    "Nizamabad Rural": {
        "name": "Dr. R. Bhupathi Reddy",
        "district": "Nizamabad",
        "party": "INC",
        "aliases": ["bhupathi reddy", "dr. r. bhupathi reddy", "భూపతి రెడ్డి", "డాక్టర్ భూపతి రెడ్డి"]
    },
    "Nizamabad Urban": {
        "name": "Dhanpal Suryanarayana Gupta",
        "district": "Nizamabad",
        "party": "BJP",
        "aliases": ["suryanarayana gupta", "dhanpal suryanarayana gupta", "ధన్ పాల్ సూర్యనారాయణ గుప్త", "సూర్యనారాయణ గుప్త"]
    },
    "Palair": {
        "name": "Ponguleti Srinivasa Reddy",
        "district": "Khammam",
        "party": "INC",
        "aliases": ["ponguleti srinivasa reddy", "ponguleti", "పొంగులేటి శ్రీనివాస్ రెడ్డి", "పొంగులేటి శ్రీనివాసరెడ్డి", "పొంగులేటి", "మంత్రి పొంగులేటి"]
    },
    "Palakurthi": {
        "name": "Yashaswini Mamilidala",
        "district": "Jangaon",
        "party": "INC",
        "aliases": ["yashaswini mamidala", "yashaswini mamilidala", "యశస్విని మామిడాల", "యశస్విని"]
    },
    "Pargi": {
        "name": "T. Ram Mohan Reddy",
        "district": "Vikarabad",
        "party": "INC",
        "aliases": ["ram mohan reddy", "t. ram mohan reddy", "రామ్ మోహన్ రెడ్డి", "టి. రామ్ మోహన్ రెడ్డి"]
    },
    "Parkal": {
        "name": "Revuri Prakash Reddy",
        "district": "Hanumakonda",
        "party": "INC",
        "aliases": ["revuri prakash reddy", "prakash reddy", "రేవూరి ప్రకాష్ రెడ్డి", "రేవూరి"]
    },
    "Patancheru": {
        "name": "Gudem Mahipal Reddy",
        "district": "Sangareddy",
        "party": "BRS",
        "aliases": ["mahipal reddy", "gudem mahipal reddy", "గూడెం మహిపాల్ రెడ్డి", "మహిపాల్ రెడ్డి"]
    },
    "Peddapalle": {
        "name": "Chinthakunta Vijaya Ramana Rao",
        "district": "Peddapalli",
        "party": "INC",
        "aliases": ["vijaya ramana rao", "chinthakunta vijaya ramana rao", "విజయ రమణారావు", "చింతకుంట విజయ రమణారావు"]
    },
    "Pinapaka (ST)": {
        "name": "Payam Venkateswarlu",
        "district": "Bhadradri Kothagudem",
        "party": "INC",
        "aliases": ["payam venkateswarlu", "venkateswarlu", "పాయం వెంకటేశ్వర్లు", "పాయం"]
    },
    "Quthbullapur": {
        "name": "Kuna Pandu Vivekanand",
        "district": "Medchal-Malkajgiri",
        "party": "BRS",
        "aliases": ["vivekanand", "kuna pandu vivekanand", "వివేకానంద", "కేపీ వివేకానంద", "వివేకానంద్"]
    },
    "Rajendranagar": {
        "name": "T. Prakash Goud",
        "district": "Ranga Reddy",
        "party": "BRS",
        "aliases": ["prakash goud", "t. prakash goud", "ప్రకాష్ గౌడ్", "టి. ప్రకాష్ గౌడ్"]
    },
    "Ramagundam": {
        "name": "Makkan Singh Raj Thakur",
        "district": "Peddapalli",
        "party": "INC",
        "aliases": ["makkan singh", "makkan singh raj thakur", "raj thakur", "మక్కన్ సింగ్", "రాజ్ ఠాకూర్"]
    },
    "Sanathnagar": {
        "name": "Talasani Srinivas Yadav",
        "district": "Hyderabad",
        "party": "BRS",
        "aliases": ["talasani srinivas yadav", "talasani", "తలసాని శ్రీనివాస్ యాదవ్", "తలసాని"]
    },
    "Sangareddy": {
        "name": "Chinta Prabhakar",
        "district": "Sangareddy",
        "party": "BRS",
        "aliases": ["chinta prabhakar", "చింతా ప్రభాకర్", "చింతా", "ఎమ్మెల్యే చింతా ప్రభాకర్"]
    },
    "Sathupalli (SC)": {
        "name": "Dr. Matta Ragamayee",
        "district": "Khammam",
        "party": "INC",
        "aliases": ["matta ragamayee", "మట్టా రాగమయి", "ఎమ్మెల్యే రాగమయి"]
    },
    "Secunderabad": {
        "name": "T. Padma Rao Goud",
        "district": "Hyderabad",
        "party": "BRS",
        "aliases": ["padma rao goud", "padma rao", "పద్మారావు గౌడ్", "పద్మారావు", "పద్మన్న"]
    },
    "Secunderabad Cantt. (SC)": {
        "name": "Sri Ganesh Narayanan",
        "district": "Hyderabad",
        "party": "INC",
        "aliases": ["sri ganesh", "sri ganesh narayanan", "శ్రీ గణేష్"]
    },
    "Serilingampally": {
        "name": "Arekapudi Gandhi",
        "district": "Ranga Reddy",
        "party": "BRS",
        "aliases": ["arekapudi gandhi", "arekapudi", "అరికెపూడి గాంధీ", "అరికెపూడి", "ఎమ్మెల్యే గాంధీ", "mla gandhi", "ఎమ్మెల్యే అరికెపూడి గాంధీ"]
    },
    "Shadnagar": {
        "name": "K. Shankaraiah",
        "district": "Ranga Reddy",
        "party": "INC",
        "aliases": ["veerlapalli shankar", "shankaraiah", "వీర్లపల్లి శంకర్", "శంకరీయ్య"]
    },
    "Siddipet": {
        "name": "Thanneeru Harish Rao",
        "district": "Siddipet",
        "party": "BRS",
        "aliases": ["harish rao", "t. harish rao", "tanneeru harish rao", "హరీష్ రావు", "హరీశ్‌రావు", "హరీశ్ రావు", "తన్నీరు హరీశ్", "హరీష్‌రావు"]
    },
    "Sircilla": {
        "name": "Kalvakuntla Taraka Rama Rao (KTR)",
        "district": "Rajanna Sircilla",
        "party": "BRS",
        "aliases": ["ktr", "k.t. rama rao", "k.t.rama rao", "kalvakuntla taraka rama rao", "taraka rama rao", "కేటీఆర్", "కెటిఆర్", "కల్వకుంట్ల తారక రామారావు", "తారక రామారావు"]
    },
    "Sirpur": {
        "name": "Dr. Palvai Harish Babu",
        "district": "Komaram Bheem Asifabad",
        "party": "BJP",
        "aliases": ["harish babu", "palvai harish babu", "పాల్వాయి హరీష్ బాబు", "హరీష్ బాబు", "డాక్టర్ పాల్వాయి హరీష్ బాబు"]
    },
    "Station Ghanpur (SC)": {
        "name": "Kadiyam Srihari",
        "district": "Jangaon",
        "party": "INC",
        "aliases": ["kadiyam srihari", "kadiyam", "కడియం శ్రీహరి", "కడియం", "ఎమ్మెల్యే కడియం"]
    },
    "Suryapet": {
        "name": "Guntakandla Jagadish Reddy",
        "district": "Suryapet",
        "party": "BRS",
        "aliases": ["jagadish reddy", "guntakandla jagadish reddy", "జగదీష్ రెడ్డి", "గుంటకండ్ల జగదీష్ రెడ్డి"]
    },
    "Tandur": {
        "name": "B. Manohar Reddy",
        "district": "Vikarabad",
        "party": "INC",
        "aliases": ["manohar reddy", "buyyani manohar reddy", "మనోహర్ రెడ్డి", "బుయ్యని మనోహర్ రెడ్డి"]
    },
    "Thungathurthi (SC)": {
        "name": "Mandula Samual",
        "district": "Suryapet",
        "party": "INC",
        "aliases": ["mandula samual", "mandula samuel", "మందుల శామ్యూల్", "ఎమ్మెల్యే శామ్యూల్"]
    },
    "Uppal": {
        "name": "Bandaru Lakshma Reddy",
        "district": "Medchal-Malkajgiri",
        "party": "BRS",
        "aliases": ["bandaru lakshma reddy", "బండారు లక్ష్మారెడ్డి", "లక్ష్మారెడ్డి"]
    },
    "Vemulawada": {
        "name": "Aadi Srinivas",
        "district": "Rajanna Sircilla",
        "party": "INC",
        "aliases": ["aadi srinivas", "ఆది శ్రీనివాస్", "విప్ ఆది శ్రీనివాస్"]
    },
    "Vikarabad (SC)": {
        "name": "Gaddam Prasad Kumar",
        "district": "Vikarabad",
        "party": "INC",
        "aliases": ["prasad kumar", "gaddam prasad kumar", "గడ్డం ప్రసాద్ కుమార్", "స్పీకర్ ప్రసాద్ కుమార్"]
    },
    "Wanaparthy": {
        "name": "Megha Reddy Tudi",
        "district": "Wanaparthy",
        "party": "INC",
        "aliases": ["megha reddy", "tudi megha reddy", "మేఘారెడ్డి", "తుడి మేఘారెడ్డి"]
    },
    "Warangal East": {
        "name": "Konda Surekha",
        "district": "Warangal",
        "party": "INC",
        "aliases": ["konda surekha", "కొండా సురేఖ", "మంత్రి సురేఖ", "మంత్రి కొండా సురేఖ"]
    },
    "Warangal West": {
        "name": "Naini Rajender Reddy",
        "district": "Hanumakonda",
        "party": "INC",
        "aliases": ["naini rajender reddy", "rajender reddy", "నాయిని రాజేందర్ రెడ్డి", "నాయిని"]
    },
    "Wardhannapet (SC)": {
        "name": "K.R. Nagaraju",
        "district": "Warangal",
        "party": "INC",
        "aliases": ["nagaraju", "k.r. nagaraju", "కేఆర్ నాగరాజు", "నాగరాజు"]
    },
    "Wyra (ST)": {
        "name": "Maloth Ramdas",
        "district": "Khammam",
        "party": "INC",
        "aliases": ["maloth ramdas", "మాలోత్ రాందాస్", "ఎమ్మెల్యే రాందాస్"]
    },
    "Yakutpura": {
        "name": "Jaffar Hussain",
        "district": "Hyderabad",
        "party": "AIMIM",
        "aliases": ["jaffar hussain", "జాఫర్ హుస్సేన్", "ఎమ్మెల్యే జాఫర్", "jaffer hussain", "జాఫర్ హుస్సేన్ మేరాజ్"]
    },
    "Yellandu (ST)": {
        "name": "Koram Kanakaiah",
        "district": "Bhadradri Kothagudem",
        "party": "INC",
        "aliases": ["koram kanakaiah", "కోరం కనకయ్య", "ఎమ్మెల్యే కనకయ్య"]
    },
    "Yellareddy": {
        "name": "K. Madan Mohan Rao",
        "district": "Kamareddy",
        "party": "INC",
        "aliases": ["madan mohan rao", "k. madan mohan rao", "మదన్ మోహన్ రావు"]
    },
    "Zahirabad (SC)": {
        "name": "Koninty Manik Rao",
        "district": "Sangareddy",
        "party": "BRS",
        "aliases": ["manik rao", "koninty manik rao", "మాణిక్ రావు"]
    }
}

# ============================================================
# 8A. NEGATIVE STOP-PHRASES & POSITIVE OVERRIDES
# Prevents false positive triggers (e.g. Gandhi Bhavan, Rohit Sharma)
# ============================================================
MLA_NEGATIVE_PATTERNS = {
    "Serilingampally": [
        "గాంధీ భవన్", "గాంధీ హాస్పిటల్", "గాంధీ ఆసుపత్రి", "గాంధీ సరోవర్", "గాంధీ విగ్రహం",
        "గాంధీ జయంతి", "మహాత్మా గాంధీ", "రాహుల్ గాంధీ", "సోనియా గాంధీ", "ఇందిరా గాంధీ",
        "ప్రియాంకా గాంధీ", "ప్రియాంక గాంధీ", "రాజీవ్ గాంధీ",
        "gandhi bhavan", "gandhi hospital", "mahatma gandhi", "rahul gandhi",
        "sonia gandhi", "indira gandhi", "priyanka gandhi", "rajiv gandhi"
    ],
    "Medak": [
        "రోహిత్ శర్మ", "rohit sharma", "రోహిత్ వేముల", "rohit vemula"
    ],
    "Choppadandi (SC)": [
        "సత్యమేవ జయతే", "సత్యం ఎప్పటికీ", "satyam eva jayathe"
    ]
}

MLA_POSITIVE_OVERRIDE = {
    "Serilingampally": ["అరికెపూడి", "arekapudi", "సెరిలింగంపల్లి", "serilingampally"],
    "Medak": ["మైనంపల్లి", "mynampally", "మెదక్", "medak"],
    "Choppadandi (SC)": ["మేడిపల్లి", "medipally", "చొప్పదండి", "choppadandi"]
}

# ============================================================
# 8B. SUB-MANDAL CO-OCCURRENCE VERIFICATION RULES
# Resolves duplicate mandal names across districts (e.g. Venkatapur, Chandur)
# ============================================================
AMBIGUOUS_MANDAL_RULES = {
    "venkatapur": {
        "Mulugu (ST)": ["mulugu", "ములుగు", "govindaraopet", "eturnagaram", "tadvai", "గోవిందరావుపేట", "ఏటూరునాగారం", "తాడ్వాయి"],
        "Chennur (SC)": ["mancherial", "మంచిర్యాల", "chennur", "చెన్నూర్", "kotapally", "జన్నారం", "నెల్కి"],
        "Bhupalpalle": ["bhupalpally", "భూపాలపల్లి", "ghanpur", "మొగుళ్లపల్లి"]
    },
    "వెంకటాపూర్": {
        "Mulugu (ST)": ["mulugu", "ములుగు", "govindaraopet", "eturnagaram", "tadvai", "గోవిందరావుపేట", "ఏటూరునాగారం", "తాడ్వాయి"],
        "Chennur (SC)": ["mancherial", "మంచిర్యాల", "chennur", "చెన్నూర్", "kotapally", "జన్నారం", "నెల్కి"],
        "Bhupalpalle": ["bhupalpally", "భూపాలపల్లి", "ghanpur", "మొగుళ్లపల్లి"]
    },
    "chandur": {
        "Munugode": ["nalgonda", "నల్గొండ", "munugode", "మునుగోడు", "choutuppal", "చౌటుప్పల్", "marriguda", "మర్రిగూడ"],
        "Bodhan": ["nizamabad", "నిజామాబాద్", "bodhan", "బోధన్", "varni", "వర్ని", "rudrur", "రుద్రూర్"]
    },
    "చండూరు": {
        "Munugode": ["nalgonda", "నల్గొండ", "munugode", "మునుగోడు", "choutuppal", "చౌటుప్పల్", "marriguda", "మర్రిగూడ"],
        "Bodhan": ["nizamabad", "నిజామాబాద్", "bodhan", "బోధన్", "varni", "వర్ని", "rudrur", "రుద్రూర్"]
    },
    "sarangapur": {
        "Nirmal": ["nirmal", "నిర్మల్", "dilawarpur", "దిలావర్‌పూర్", "soan", "సోన్"],
        "Jagtial": ["jagtial", "జగిత్యాల", "koratla", "కోరుట్ల", "beerpur", "బీర్పూర్"]
    },
    "సారంగాపూర్": {
        "Nirmal": ["nirmal", "నిర్మల్", "dilawarpur", "దిలావర్‌పూర్", "soan", "సోన్"],
        "Jagtial": ["jagtial", "జగిత్యాల", "koratla", "కోరుట్ల", "beerpur", "బీర్పూర్"]
    }
}

# Pre-compiled MLA alias patterns for maximum classification speed (zero runtime compilation overhead)
COMPILED_MLA_PATTERNS = {}
for _c, _data in ALL_119_MLAS.items():
    _patterns = []
    for _alias in _data["aliases"]:
        if _alias.isascii():
            _patterns.append((_alias, re.compile(r'\b' + re.escape(_alias) + r'\b', re.IGNORECASE)))
        else:
            _pat_str = r'(?<![\u0c00-\u0c7f])' + re.escape(_alias) + r'(?:$|[^\u0c00-\u0c7f]|(?=(?:లో|కు|కి|ను|గారు|గారి|తో|పై|యొక్క|వద్ద)(?:$|[^\u0c00-\u0c7f])))'
            _patterns.append((_alias, re.compile(_pat_str)))
    COMPILED_MLA_PATTERNS[_c] = _patterns


def detect_all_mlas_in_text(text: str) -> list:
    """
    Detects all MLAs mentioned in text (Telugu or English).
    Includes negative stop-phrase verification and positive override checks.
    Returns list of dicts: [{'constituency': str, 'district': str, 'leader_name': str, 'party': str}, ...]
    """
    if not text:
        return []
    clean = text.lower()
    matches = []
    matched_consts = set()
    for const, data in ALL_119_MLAS.items():
        # Check negative stop-phrases for sensitive MLAs
        if const in MLA_NEGATIVE_PATTERNS:
            has_neg = any(p in clean for p in MLA_NEGATIVE_PATTERNS[const])
            if has_neg:
                has_override = any(o in clean for o in MLA_POSITIVE_OVERRIDE.get(const, []))
                if not has_override:
                    continue  # Invalidate false positive trigger

        # Fast pre-compiled pattern matching
        compiled_list = COMPILED_MLA_PATTERNS.get(const, [])
        for alias, compiled_pat in compiled_list:
            if compiled_pat.search(clean):
                if const not in matched_consts:
                    matches.append({
                        "constituency": const,
                        "district": data["district"],
                        "leader_name": data["name"],
                        "party": data["party"]
                    })
                    matched_consts.add(const)
                break
    return matches

def get_mla_for_constituency(constituency: str):
    """Returns the official MLA record for a given constituency."""
    if not constituency:
        return None
    if constituency in ALL_119_MLAS:
        return ALL_119_MLAS[constituency]
    clean = re.sub(r'\s*\((SC|ST)\)', '', constituency, flags=re.IGNORECASE).strip()
    if clean in ALL_119_MLAS:
        return ALL_119_MLAS[clean]
    clean_lower = clean.lower()
    for k, v in ALL_119_MLAS.items():
        k_clean = re.sub(r'\s*\((SC|ST)\)', '', k, flags=re.IGNORECASE).strip().lower()
        if k_clean == clean_lower:
            return v
    return None


def classify_article_constituency(
    title: str,
    summary: str = "",
    text: str = "",
    district: str = "Statewide",
    return_all: bool = False
):
    """
    Classifies an article into:
    (primary_const, primary_dist) or
    (primary_const, primary_dist, all_constituencies, all_leaders, civic_constituencies)
    if return_all=True.
    
    Guarantees:
    1. MLA-to-Constituency Mapping: Any article mentioning an MLA is captured in all_constituencies!
    2. Civic vs Leader Separation: Local mandal/town/civic issues are tagged in civic_constituencies!
    3. Multi-Constituency Support: All relevant constituencies across the 119 MLAs are captured!
    4. Negative Stop-Phrases: Gandhi Bhavan/Hospital, Rohit Sharma, etc. do NOT produce false positives!
    5. Sub-Mandal Disambiguation: Ambiguous mandals (Venkatapur, Chandur) verified via co-occurrence!
    """
    content = f"{title or ''} {summary or ''} {text or ''}"
    clean = content.lower()
    
    # Step 1: Detect all MLAs mentioned in text (Leader Attribution)
    detected_mlas = detect_all_mlas_in_text(content)
    mla_constituencies = [m["constituency"] for m in detected_mlas]
    mla_leaders = [m["leader_name"] for m in detected_mlas]

    # Step 2: Detect if a specific district is explicitly mentioned in text
    district_in_text = detect_district(clean)
    detected_dist = district_in_text
    if not detected_dist and district and district not in ("Statewide", "All", "All Districts", "National"):
        detected_dist = district.strip()

    # Step 3: Check explicit constituency mentions (Headline priority)
    clean_title = (title or '').lower()
    geo_consts = []

    # Title check first
    for te_name, canonical in CONSTITUENCY_TELUGU.items():
        # Check both raw and suffix-stripped form (Telugu morphological stemming)
        if te_name in clean_title or strip_telugu_suffix(te_name) in clean_title:
            if canonical not in geo_consts:
                geo_consts.append(canonical)

    for clean_name, canonical in CANONICAL_CONSTITUENCIES.items():
        if len(clean_name) >= 4 and canonical not in geo_consts:
            if re.search(r'\b' + re.escape(clean_name.lower()) + r'\b', clean_title):
                geo_consts.append(canonical)

    # Content check
    for te_name, canonical in CONSTITUENCY_TELUGU.items():
        # Check both raw and suffix-stripped form (Telugu morphological stemming)
        if te_name in clean or strip_telugu_suffix(te_name) in clean:
            if canonical not in geo_consts:
                geo_consts.append(canonical)

    for clean_name, canonical in CANONICAL_CONSTITUENCIES.items():
        if len(clean_name) >= 4 and canonical not in geo_consts:
            if re.search(r'\b' + re.escape(clean_name.lower()) + r'\b', clean):
                geo_consts.append(canonical)

    # Step 4: Sub-Mandal Co-Occurrence Disambiguation
    for amb_keyword, district_cooc in AMBIGUOUS_MANDAL_RULES.items():
        if amb_keyword in clean:
            for target_const, cooc_tokens in district_cooc.items():
                if any(tok in clean for tok in cooc_tokens):
                    if target_const not in geo_consts:
                        geo_consts.append(target_const)
                    break

    # Step 5: District-constrained Mandals and Towns
    if detected_dist and detected_dist in DISTRICT_MANDAL_MAP:
        for kw, canonical in DISTRICT_MANDAL_MAP[detected_dist].items():
            if kw in AMBIGUOUS_MANDAL_RULES:
                continue  # Handled above via strict co-occurrence
            if kw.isascii():
                if re.search(r'\b' + re.escape(kw) + r'\b', clean):
                    if canonical not in geo_consts:
                        geo_consts.append(canonical)
                    break
            else:
                if kw in clean:
                    if canonical not in geo_consts:
                        geo_consts.append(canonical)
                    break

    # Step 6: Local politician aliases (for civic/geographic assignment)
    for pol_kw, canonical in LOCAL_POLITICIAN_ALIASES.items():
        target_dist = CONSTITUENCY_TO_DISTRICT.get(canonical)
        if pol_kw.isascii():
            matched = bool(re.search(r'\b' + re.escape(pol_kw) + r'\b', clean))
        else:
            matched = pol_kw in clean
            
        if matched:
            if not detected_dist or detected_dist == target_dist:
                if canonical not in geo_consts:
                    geo_consts.append(canonical)
                break

    # Assembly constituencies identified
    civic_constituencies = list(dict.fromkeys([c for c in geo_consts if c and c != "Statewide"]))
    mla_consts = list(dict.fromkeys([c for c in mla_constituencies if c and c != "Statewide"]))
    all_consts = list(dict.fromkeys(civic_constituencies + mla_consts))

    # Determine primary constituency and district
    if civic_constituencies:
        primary_const = civic_constituencies[0]
        primary_dist = CONSTITUENCY_TO_DISTRICT.get(primary_const, detected_dist or "Statewide")
    elif mla_consts:
        primary_const = mla_consts[0]
        primary_dist = detected_mlas[0]["district"]
    else:
        # If no specific constituency or mandal is mentioned, keep civic_constituencies empty!
        # Do NOT blindly dump all district constituencies into civic_constituencies.
        # The article remains a clean district-level or statewide article.
        primary_const = "Statewide"
        primary_dist = detected_dist if (detected_dist and detected_dist not in ("Statewide", "All", "All Districts", "National")) else "Statewide"

    if return_all:
        return primary_const, primary_dist, all_consts, mla_leaders, civic_constituencies
    return primary_const, primary_dist


def get_canonical_district(constituency: str) -> str:
    """Returns the official parent district for any constituency, robust to (SC)/(ST) variations."""
    if not constituency or constituency in ("Statewide", "All", "All Constituencies", "All Assembly Constituencies"):
        return "Statewide"
    
    # Direct match
    if constituency in CONSTITUENCY_TO_DISTRICT:
        return CONSTITUENCY_TO_DISTRICT[constituency]

    clean = re.sub(r'\s*\((SC|ST)\)', '', constituency, flags=re.IGNORECASE).strip()
    for variant in [clean, f"{clean} (ST)", f"{clean} (SC)"]:
        if variant in CONSTITUENCY_TO_DISTRICT:
            return CONSTITUENCY_TO_DISTRICT[variant]

    # Fuzzy / case-insensitive match
    clean_lower = clean.lower()
    for c_key, dist in CONSTITUENCY_TO_DISTRICT.items():
        k_clean = re.sub(r'\s*\((SC|ST)\)', '', c_key, flags=re.IGNORECASE).strip().lower()
        if clean_lower == k_clean:
            return dist

    for c_key, dist in CONSTITUENCY_TO_DISTRICT.items():
        k_clean = re.sub(r'\s*\((SC|ST)\)', '', c_key, flags=re.IGNORECASE).strip().lower()
        if clean_lower in k_clean or k_clean in clean_lower:
            return dist

    return "Statewide"


# Reverse Map: District -> All Canonical Constituencies
DISTRICT_TO_CONSTITUENCIES: Dict[str, List[str]] = {}
for _c, _d in CONSTITUENCY_TO_DISTRICT.items():
    DISTRICT_TO_CONSTITUENCIES.setdefault(_d, []).append(_c)


def get_constituencies_for_district(district: str) -> List[str]:
    """Returns all 119 canonical assembly constituencies belonging to a given district."""
    if not district or district in ("Statewide", "All", "All Districts", "National"):
        return []
    if district in DISTRICT_TO_CONSTITUENCIES:
        return list(DISTRICT_TO_CONSTITUENCIES[district])
    dist_lower = district.lower().strip()
    for d_name, consts in DISTRICT_TO_CONSTITUENCIES.items():
        if d_name.lower() == dist_lower:
            return list(consts)
    for d_name, consts in DISTRICT_TO_CONSTITUENCIES.items():
        if d_name.lower() in dist_lower or dist_lower in d_name.lower():
            return list(consts)
    return []
