"""
District data and bilingual keyword mappings for all 33 Telangana districts.
Used by scrapers, deduplication engine, and API.
"""

DISTRICTS_33 = [
    "Adilabad",
    "Bhadradri Kothagudem",
    "Hanumakonda",
    "Hyderabad",
    "Jagtial",
    "Jangaon",
    "Jayashankar Bhupalpally",
    "Jogulamba Gadwal",
    "Kamareddy",
    "Karimnagar",
    "Khammam",
    "Komaram Bheem Asifabad",
    "Mahabubabad",
    "Mahabubnagar",
    "Mancherial",
    "Medak",
    "Medchal-Malkajgiri",
    "Mulugu",
    "Nagarkurnool",
    "Nalgonda",
    "Narayanpet",
    "Nirmal",
    "Nizamabad",
    "Peddapalli",
    "Rajanna Sircilla",
    "Ranga Reddy",
    "Sangareddy",
    "Siddipet",
    "Suryapet",
    "Vikarabad",
    "Wanaparthy",
    "Warangal",
    "Yadadri Bhuvanagiri"
]

# District Slugs for HTML Crawlers (Sakshi, Eenadu, Andhra Jyothi, etc.)
DISTRICT_SLUGS = {
    "Adilabad": "adilabad",
    "Bhadradri Kothagudem": "kothagudem",
    "Hanumakonda": "hanumakonda",
    "Hyderabad": "hyderabad",
    "Jagtial": "jagtial",
    "Jangaon": "jangaon",
    "Jayashankar Bhupalpally": "bhupalpally",
    "Jogulamba Gadwal": "gadwal",
    "Kamareddy": "kamareddy",
    "Karimnagar": "karimnagar",
    "Khammam": "khammam",
    "Komaram Bheem Asifabad": "asifabad",
    "Mahabubabad": "mahabubabad",
    "Mahabubnagar": "mahabubnagar",
    "Mancherial": "mancherial",
    "Medak": "medak",
    "Medchal-Malkajgiri": "medchal",
    "Mulugu": "mulugu",
    "Nagarkurnool": "nagarkurnool",
    "Nalgonda": "nalgonda",
    "Narayanpet": "narayanpet",
    "Nirmal": "nirmal",
    "Nizamabad": "nizamabad",
    "Peddapalli": "peddapalli",
    "Rajanna Sircilla": "sircilla",
    "Ranga Reddy": "rangareddy",
    "Sangareddy": "sangareddy",
    "Siddipet": "siddipet",
    "Suryapet": "suryapet",
    "Vikarabad": "vikarabad",
    "Wanaparthy": "wanaparthy",
    "Warangal": "warangal",
    "Yadadri Bhuvanagiri": "yadadri-bhuvanagiri"
}

# Bilingual Keywords (English & Telugu) for each district
DISTRICT_KEYWORDS = {
    "Adilabad": [
        "adilabad", "ఆదిలాబాద్", "బోథ్", "ఉట్నూర్", "తాంసి", "బేల", "బోరం",
        "utnoor", "boath", "tamsi", "ichoda"
    ],
    "Bhadradri Kothagudem": [
        "bhadradri", "kothagudem", "భద్రాద్రి", "కొత్తగూడెం", "భద్రాచలం",
        "పాల్వంచ", "ఇల్లందు", "మణుగూరు", "bhadrachalam", "palvancha", "yellandu", "manuguru"
    ],
    "Hanumakonda": [
        "hanumakonda", "హనుమకొండ", "కాజీపేట", "వరంగల్ పశ్చిమ", "kazipet",
        "hasanparthy", "హసన్‌పర్తి"
    ],
    "Hyderabad": [
        "hyderabad", "హైదరాబాద్", "భాగ్యనగరం", "సికింద్రాబాద్", "secunderabad",
        "charminar", "చార్మినార్", "jubilee hills", "banjara hills", "ghmc", "hmda"
    ],
    "Jagtial": [
        "jagtial", "జగిత్యాల", "కోరుట్ల", "ధర్మపురి", "మెట్‌పల్లి",
        "korutla", "dharmapuri", "metpally", "రాయికల్"
    ],
    "Jangaon": [
        "jangaon", "జనగామ", "జనగాం", "స్టేషన్ ఘన్‌పూర్", "పాలకుర్తి",
        "station ghanpur", "palakurthi"
    ],
    "Jayashankar Bhupalpally": [
        "bhupalpally", "jayashankar", "జయశంకర్", "భూపాలపల్లి", "కాళేశ్వరం",
        "kaleshwaram", "రేగొండ", "మహాదేవపూర్", "mahadevpur"
    ],
    "Jogulamba Gadwal": [
        "gadwal", "jogulamba", "గద్వాల", "జోగులాంబ", "అలంపూర్",
        "alampur", "శాంతినగర్", "ధరూర్"
    ],
    "Kamareddy": [
        "kamareddy", "కామారెడ్డి", "బాన్సువాడ", "ఎల్లారెడ్డి", "జుక్కల్",
        "banswada", "yellareddy", "jukkal"
    ],
    "Karimnagar": [
        "karimnagar", "కరీంనగర్", "హుజూరాబాద్", "మానకొండూరు", "చొప్పదండి",
        "huzurabad", "manakondur", "choppadandi"
    ],
    "Khammam": [
        "khammam", "ఖమ్మం", "మధిర", "వైరా", "సత్తుపల్లి", "పాలేరు",
        "madhira", "wyra", "sathupalli", "palair"
    ],
    "Komaram Bheem Asifabad": [
        "asifabad", "komaram bheem", "ఆసిఫాబాద్", "కొమరం భీమ్", "కాగజ్‌నగర్",
        "kagaznagar", "సిర్పూర్", "sirpur", "రెబ్బెన"
    ],
    "Mahabubabad": [
        "mahabubabad", "మహబూబాబాద్", "మానుకోట", "డోర్నకల్", "మరిపెడ",
        "గార్ల", "dornakal", "maripeda", "kesamudram", "కేసముద్రం"
    ],
    "Mahabubnagar": [
        "mahabubnagar", "మహబూబ్ నగర్", "పాలమూరు", "జడ్చర్ల", "దేవరకద్ర",
        "jadcherla", "devarakadra", "భూత్పూర్", "కోయిలకొండ"
    ],
    "Mancherial": [
        "mancherial", "మంచిర్యాల", "బెల్లంపల్లి", "చెన్నూర్", "నస్పూర్",
        "bellampalli", "chennur", "mandamarri", "మందమర్రి"
    ],
    "Medak": [
        "medak", "మెదక్", "నర్సాపూర్", "తూప్రాన్", "హవేలీ ఘన్‌పూర్",
        "narsapur", "toopran", "రామాయంపేట", "ramayampet"
    ],
    "Medchal-Malkajgiri": [
        "medchal", "malkajgiri", "మేడ్చల్", "మల్కాజిగిరి", "కూకట్‌పల్లి",
        "కుత్బుల్లాపూర్", "ఉప్పల్", "kukatpally", "quthbullapur", "uppal", "alwal"
    ],
    "Mulugu": [
        "mulugu", "ములుగు", "మేడారం", "సమ్మక్క సారలమ్మ", "వెంకటాపురం",
        "medaram", "eturnagaram", "ఏటూరునాగారం", "గోవిందరావుపేట"
    ],
    "Nagarkurnool": [
        "nagarkurnool", "నాగర్ కర్నూల్", "అచ్చంపేట", "కొల్లాపూర్", "కల్వకుర్తి",
        "achampet", "kollapur", "kalwakurthy", "శ్రీశైలం"
    ],
    "Nalgonda": [
        "nalgonda", "నల్గొండ", "మిర్యాలగూడ", "దేవరకొండ", "నాగార్జునసాగర్",
        "miryalaguda", "devarakonda", "nagarjunasagar", "నకిరేకల్", "nakrekal"
    ],
    "Narayanpet": [
        "narayanpet", "నారాయణపేట", "మక్తల్", "దామరగిద్ద", "కోస్గి",
        "makthal", "kosgi", "మద్దూర్"
    ],
    "Nirmal": [
        "nirmal", "నిర్మల్", "ముధోల్", "ఖానాపూర్", "బాసర",
        "mudhole", "khanapur", "basara", "సోన్"
    ],
    "Nizamabad": [
        "nizamabad", "నిజామాబాద్", "ఇందూరు", "బోధన్", "ఆర్మూర్", "బాల్కొండ",
        "bodhan", "armur", "balkonda", "డిచ్‌పల్లి"
    ],
    "Peddapalli": [
        "peddapalli", "పెద్దపల్లి", "రామగుండం", "మంథని", "సుల్తానాబాద్",
        "ramagundam", "manthani", "sultanabad", "గోదావరిఖని", "godavarikhani"
    ],
    "Rajanna Sircilla": [
        "sircilla", "rajanna sircilla", "సిరిసిల్ల", "రాజన్న సిరిసిల్ల",
        "వేములవాడ", "vemulawada", "ఇల్లంతకుంట", "బోయినపల్లి"
    ],
    "Ranga Reddy": [
        "ranga reddy", "rangareddy", "రంగారెడ్డి", "రాజేంద్రనగర్", "ఇబ్రహీంపట్నం",
        "మహేశ్వరం", "చేవెళ్ల", "rajendranagar", "ibrahimpatnam", "maheshwaram", "chevella", "shamshabad"
    ],
    "Sangareddy": [
        "sangareddy", "సంగారెడ్డి", "పటాన్‌చెరు", "జహీరాబాద్", "ఆందోల్", "నారాయణఖేడ్",
        "patancheru", "zaheerabad", "andole", "narayankhed"
    ],
    "Siddipet": [
        "siddipet", "సిద్దిపేట", "గజ్వేల్", "దుబ్బాక", "హుస్నాబాద్",
        "gajwel", "dubbaka", "husnabad", "కొమురవెల్లి"
    ],
    "Suryapet": [
        "suryapet", "సూర్యాపేట", "కోదాడ", "హుజూర్‌నగర్", "తుంగతుర్తి",
        "kodad", "huzurnagar", "tungaturthi"
    ],
    "Vikarabad": [
        "vikarabad", "వికారాబాద్", "తాండూరు", "పరిగి", "కొడంగల్",
        "tandur", "parigi", "kodangal", "అనంతగిరి"
    ],
    "Wanaparthy": [
        "wanaparthy", "వనపర్తి", "కొత్తకోట", "ఆత్మకూరు", "పెబ్బేరు",
        "kothakota", "atmakur", "pebber"
    ],
    "Warangal": [
        "warangal", "వరంగల్", "ఓరుగల్లు", "వరంగల్ తూర్పు", "వర్ధన్నపేట",
        "నర్సంపేట", "wardhannapet", "narsampet"
    ],
    "Yadadri Bhuvanagiri": [
        "yadadri", "bhuvanagiri", "యాదాద్రి", "భువనగిరి", "యాదగిరిగుట్ట",
        "ఆలేరు", "చౌటుప్పల్", "yadagirigutta", "aler", "choutuppal", "bhongir"
    ]
}

def detect_district_from_text(text: str, default: str = "Statewide") -> str:
    """
    Detects which of the 33 districts a piece of text (title, summary, or url)
    refers to using bilingual regex/substring matching.
    """
    if not text:
        return default
        
    lower = text.lower()
    
    # Priority check: exact district keyword hits
    for dist, kws in DISTRICT_KEYWORDS.items():
        for kw in kws:
            if kw.lower() in lower:
                return dist
                
    return default
