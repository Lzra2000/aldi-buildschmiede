# -*- coding: utf-8 -*-
"""itemId -> icon (+ optional cls/sub/inv) aus Item.dbc + ItemDisplayInfo.dbc.

3.3.5a (Ascension-Layout verifiziert):
  Item.dbc            Feld 5 = DisplayInfoID, 1=class, 2=subclass, 6=invType
  ItemDisplayInfo.dbc Feld 5 = inventoryIcon[0]  (z.B. INV_Sword_04)

Default (einbettbar als D.iic, assemble-Limit 512 KB):
  ItemIds aus data/testexport*.txt (GEAR|…|itemId, WEAPON|…|itemId)
  plus SEED_IDS + LEVELING_SEED (haeufige Levelrun-Ausruestung 1–59).
  Ausgabe: data/itemicons.json als flaches Dict
    {"1482":{"i":"inv_sword_13","cls":2,"sub":7,"inv":13}, …}
  Vorhandene data:-WebP-`url`-Felder (z. B. von mkchrome.py) bleiben erhalten.

Vollscan (Forschung, nicht einbetten):
  python3 pipeline/itemicons.py --all
  schreibt data/itemicons-all.json (itemicons.json bleibt kompakt).

Fehlen die DBCs: schreibt data/itemicons.json = {} und exit 0
(assemble ueberspringt fehlende Optional-Dateien ohnehin).

BLP→WebP-Sprite fuer ~18k Item-Icons ist absichtlich nicht gebaut —
zu gross fuer die Einbettung; die Seite kann spaeter per iconName
auf Interface-Icons zeigen oder ein schlankes Subset-Sprite bauen.
"""
from __future__ import print_function

import io
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")

DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
DBC_ITEM = os.path.join(DBC_DIR, "Item.dbc")
DBC_DISPLAY = os.path.join(DBC_DIR, "ItemDisplayInfo.dbc")
ICON_ROOT = r"C:\Users\x\Documents\AscensionInterfaceExtract\by-archive"

EMBED_SOFT_MAX_KB = 400

# Bekannte Probe-/Seed-Ids (WotLK-Klassiker + fruehere Testexporte).
SEED_IDS = (
    25, 35, 36, 37, 38, 39, 40, 117, 6948, 19019, 49623,
    1482, 17071, 34334, 8191, 8192, 8193, 8194, 8197, 8198,
    8175, 8176, 14134, 21933, 9538, 19863, 7971, 17774,
)

# Haeufige Levelrun-Ausruestung (Vanilla–Wrath 1–59: Starter, Vendor,
# Handwerk, Quest/Dungeon-Gruen/Blau). Kein Vollkatalog — kompakt halten.
LEVELING_SEED = (
    # Starter / early whites
    25, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49,
    51, 52, 53, 55, 56, 57, 59, 79, 80, 85, 117, 118, 159, 727, 766,
    776, 777, 778, 789, 790, 791, 792, 793, 794, 795, 837, 840, 844,
    845, 846, 847, 848, 849, 864, 865, 866, 867, 868, 869, 870, 871,
    872, 873, 880, 890, 897, 911, 913, 920, 922, 923, 924, 925, 926,
    927, 928, 934, 935, 936, 937, 943, 1011, 1121, 1127, 1131, 1146,
    # Early greens / quest
    1292, 1296, 1297, 1299, 1300, 1302, 1318, 1405, 1406, 1430, 1440,
    1443, 1454, 1455, 1457, 1458, 1459, 1460, 1461, 1465, 1469, 1473,
    1480, 1481, 1482, 1483, 1484, 1486, 1488, 1489, 1491, 1493, 1495,
    1510, 1511, 1512, 1513, 1514, 1515, 1516, 1521, 1522, 1523, 1602,
    1607, 1608, 1624, 1625, 1640, 1680, 1721, 1722, 1726, 1727, 1728,
    1935, 1936, 1937, 1938, 1951, 1958, 1959, 1976, 1978, 1979, 1980,
    1981, 1982, 1986, 1990, 1991, 1994, 1996, 1997, 1998, 2011, 2013,
    2014, 2015, 2020, 2021, 2039, 2040, 2041, 2042, 2043, 2044, 2046,
    2057, 2058, 2059, 2064, 2065, 2066, 2067, 2069, 2072, 2073, 2074,
    2075, 2077, 2078, 2079, 2080, 2087, 2088, 2089, 2169, 2175, 2194,
    2202, 2203, 2204, 2205, 2207, 2208, 2209, 2210, 2211, 2212, 2213,
    2214, 2215, 2216, 2217, 2218, 2219, 2220, 2221, 2222, 2224, 2225,
    2226, 2227, 2232, 2233, 2234, 2235, 2236, 2243, 2244, 2249, 2263,
    2264, 2265, 2266, 2267, 2268, 2271, 2273, 2274, 2276, 2277, 2278,
    2280, 2291, 2292, 2299, 2300, 2307, 2308, 2309, 2310, 2311, 2312,
    2313, 2314, 2315, 2316, 2317, 2318, 2319, 2361, 2362, 2408, 2409,
    # Mid leveling (SM / ZF / Mara / Uldaman band)
    2807, 2815, 2816, 2817, 2818, 2819, 2821, 2822, 2823, 2824, 2825,
    2878, 2879, 2912, 2915, 2916, 2941, 2942, 2943, 2950, 2957, 2958,
    2959, 2960, 2961, 2962, 2963, 2964, 2965, 2966, 2967, 2968, 2969,
    2970, 2971, 2972, 2973, 2974, 2975, 2976, 2977, 2978, 2979, 2980,
    2981, 2982, 2983, 2984, 2985, 2986, 2987, 2988, 2989, 2990, 2991,
    2992, 2993, 2994, 2995, 2996, 2997, 2998, 3020, 3021, 3036, 3037,
    3039, 3040, 3041, 3042, 3071, 3078, 3079, 3184, 3185, 3186, 3187,
    3188, 3189, 3190, 3191, 3192, 3193, 3194, 3195, 3196, 3197, 3198,
    3199, 3201, 3203, 3206, 3207, 3208, 3209, 3210, 3222, 3223, 3224,
    3225, 3227, 3229, 3230, 3231, 3413, 3414, 3415, 3416, 3417, 3419,
    3422, 3426, 3427, 3429, 3430, 3431, 3455, 3456, 3457, 3461, 3462,
    3469, 3470, 3471, 3472, 3473, 3474, 3475, 3487, 3488, 3489, 3490,
    3491, 3492, 3493, 3535, 3536, 3537, 3538, 3539, 3540, 3541, 3542,
    3543, 3544, 3545, 3546, 3547, 3548, 3549, 3550, 3551, 3552, 3553,
    3554, 3555, 3556, 3559, 3560, 3561, 3562, 3563, 3564, 3565, 3566,
    3567, 3569, 3570, 3571, 3572, 3581, 3582, 3583, 3585, 3586, 3591,
    # Late pre-60 / crafted / dungeon
    4087, 4088, 4089, 4090, 4091, 4236, 4237, 4239, 4240, 4241, 4242,
    4243, 4244, 4246, 4247, 4248, 4249, 4250, 4251, 4252, 4253, 4254,
    4255, 4256, 4257, 4258, 4259, 4260, 4262, 4263, 4264, 4265, 4302,
    4303, 4439, 4444, 4445, 4446, 4447, 4448, 4449, 4450, 4451, 4452,
    4453, 4454, 4455, 4456, 4457, 4458, 4459, 4460, 4461, 4462, 4463,
    4464, 4465, 4474, 4476, 4477, 4478, 4505, 4506, 4507, 4508, 4509,
    4510, 4511, 4512, 4513, 4514, 4515, 4516, 4517, 4518, 4519, 4520,
    4547, 4548, 4549, 4550, 4551, 4552, 4553, 4554, 4555, 4556, 4557,
    4558, 4560, 4561, 4562, 4563, 4564, 4565, 4566, 4567, 4568, 4569,
    4570, 4571, 4575, 4576, 4577, 4641, 4642, 4643, 4652, 4653, 4656,
    4657, 4658, 4659, 4660, 4661, 4662, 4663, 4665, 4666, 4668, 4669,
    4671, 4672, 4674, 4675, 4677, 4678, 4680, 4681, 4683, 4684, 4686,
    4687, 4689, 4690, 4692, 4693, 4694, 4695, 4697, 4698, 4699, 4700,
    4701, 4706, 4707, 4708, 4709, 4710, 4711, 4712, 4713, 4714, 4715,
    4716, 4717, 4718, 4719, 4720, 4721, 4722, 4723, 4724, 4725, 4726,
    4727, 4729, 4731, 4732, 4733, 4734, 4735, 4736, 4737, 4738, 4741,
    4744, 4745, 4746, 4747, 4748, 4749, 4751, 4752, 4753, 4755, 4756,
    4757, 4758, 4759, 4760, 4761, 4762, 4763, 4764, 4765, 4766, 4767,
    4768, 4769, 4770, 4771, 4772, 4773, 4774, 4775, 4776, 4777, 4778,
    4779, 4780, 4781, 4782, 4783, 4784, 4785, 4786, 4787, 4788, 4789,
    4790, 4791, 4792, 4793, 4794, 4795, 4796, 4797, 4798, 4799, 4800,
    # Nightscape / Turtle / mid greens (testexport band + peers)
    8175, 8176, 8191, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199,
    8200, 8201, 8202, 8203, 8204, 8205, 8206, 8207, 8208, 8209, 8210,
    8211, 8212, 8213, 8214, 8215, 8216, 8245, 8246, 8247, 8248, 8249,
    8250, 8251, 8252, 8253, 8254, 8255, 8256, 8257, 8258, 8259, 8260,
    8261, 8262, 8263, 8264, 8265, 8266, 8267, 8268, 8269, 8270, 8271,
    8272, 8273, 8274, 8275, 8276, 8277, 8278, 8279, 8280, 8281, 8282,
    8283, 8284, 8285, 8286, 8287, 8288, 8289, 8290, 8291, 8292, 8293,
    8294, 8295, 8296, 8297, 8298, 8299, 8300, 8301, 8302, 8303, 8304,
    # Jewelry / trinkets / cloaks seen while leveling
    9538, 11994, 11995, 11996, 11997, 11998, 11999, 12000, 12001, 12002,
    12003, 12004, 12005, 12006, 12007, 12008, 12009, 12010, 12011, 12012,
    12013, 12014, 12015, 12016, 12017, 12018, 12019, 12020, 12022, 12023,
    12024, 12025, 12026, 12027, 12028, 12029, 12030, 12031, 12032, 12034,
    12035, 12036, 12037, 12038, 12039, 12040, 12042, 12043, 12044, 12045,
    12046, 12047, 12048, 12049, 12050, 12052, 12053, 12054, 12055, 12056,
    12057, 12058, 14134, 17774, 19863, 21933, 7971,
    # Notable blues / weapons from exports + peers
    17071, 19019, 34334, 32237, 42555, 45078, 47604, 49623, 50024, 50314,
)

PROBE_IDS = (25, 1482, 8191, 14134, 17071, 19019, 34334)


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("kein WDBC: %s (%r)" % (path, magic))
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def sref(strings, off):
    if off <= 0 or off >= len(strings):
        return ""
    end = strings.find(b"\x00", off)
    if end < 0:
        end = len(strings)
    return strings[off:end].decode("utf-8", "replace")


def icon_basename(name):
    if not name:
        return ""
    for sep in ("\\", "/"):
        if sep in name:
            name = name.split(sep)[-1]
    if name.lower().endswith(".blp"):
        name = name[:-4]
    return name.lower()


def write_json(path, obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"),
                     sort_keys=True)
    io.open(path, "w", encoding="utf-8").write(raw)
    return len(raw.encode("utf-8")) / 1024.0


def load_existing_urls():
    """Behalte data:-WebP aus mkchrome, wenn itemicons.json schon angereichert ist."""
    path = os.path.join(DATA, "itemicons.json")
    if not os.path.isfile(path):
        return {}
    try:
        raw = json.load(io.open(path, encoding="utf-8"))
    except (ValueError, IOError, OSError):
        return {}
    urls = {}
    for k, v in raw.items():
        if isinstance(v, dict):
            u = v.get("url") or ""
            if isinstance(u, str) and u.startswith("data:image/"):
                urls[str(k)] = u
    return urls


def collect_export_item_ids():
    """ItemIds aus Addon-Testexporten + Seed + Levelrun-Seed."""
    ids = set(SEED_IDS)
    ids.update(LEVELING_SEED)
    if not os.path.isdir(DATA):
        return ids
    for name in os.listdir(DATA):
        if not name.startswith("testexport") or not name.endswith(".txt"):
            continue
        text = io.open(os.path.join(DATA, name), encoding="utf-8").read()
        for line in text.splitlines():
            if line.startswith("GEAR|"):
                parts = line.split("|")
                # GEAR|Slot|Name|ilvl|quality|subtype|itemId|…
                if len(parts) >= 7 and re.match(r"^\d+$", parts[6]):
                    ids.add(int(parts[6]))
            elif line.startswith("WEAPON|"):
                parts = line.split("|")
                # WEAPON|tag|name|ilvl|speed|lo-hi|dps|loc|sub|itemId|…
                for p in parts[9:]:
                    if re.match(r"^\d+$", p):
                        ids.add(int(p))
                        break
    ids.discard(0)
    return ids


def load_item_meta(wanted):
    """itemId -> (displayInfoId, classId, subclassId, invType).

    wanted=None = alle Zeilen.
    """
    rc, fc, rs, data, _ = read_dbc(DBC_ITEM)
    if fc < 7:
        raise SystemExit("Item.dbc: zu wenige Felder (%d), erwartet >= 7" % fc)
    want = None if wanted is None else set(wanted)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        iid = row[0]
        if want is not None and iid not in want:
            continue
        did = row[5]
        if did and did != 0xFFFFFFFF:
            out[iid] = (did, int(row[1]), int(row[2]), int(row[6]))
    return out, rc


def load_icons_for(display_ids):
    rc, fc, rs, data, sb = read_dbc(DBC_DISPLAY)
    if fc < 6:
        raise SystemExit(
            "ItemDisplayInfo.dbc: zu wenige Felder (%d), erwartet >= 6" % fc)
    want = set(display_ids)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        if row[0] not in want:
            continue
        icon = icon_basename(sref(sb, row[5]))
        if icon:
            out[row[0]] = icon
    return out


def index_blp_names():
    """icon basename (klein) -> True, wenn BLP unter Interface/Icons liegt."""
    found = set()
    if not os.path.isdir(ICON_ROOT):
        return found
    for root, _dirs, files in os.walk(ICON_ROOT):
        if "icon" not in root.lower():
            continue
        for fn in files:
            if fn.lower().endswith(".blp"):
                found.add(fn[:-4].lower())
    return found


def write_empty(reason):
    dest = os.path.join(DATA, "itemicons.json")
    write_json(dest, {})
    print(reason)
    print("Geschrieben: %s = {}" % dest)
    return 0


def build_entry(icon, cls, sub, inv, url=None):
    """Kompakter Eintrag: Name allein oder Objekt mit Meta (+ optionale url)."""
    if cls or sub or inv or url:
        o = {"i": icon}
        if cls:
            o["cls"] = cls
        if sub:
            o["sub"] = sub
        if inv:
            o["inv"] = inv
        if url:
            o["url"] = url
        return o
    return icon


def main(argv=None):
    argv = list(argv or sys.argv[1:])
    full = "--all" in argv
    check_blp = "--blp" in argv or full

    if not os.path.exists(DBC_ITEM) or not os.path.exists(DBC_DISPLAY):
        return write_empty(
            "DBC fehlt (Item.dbc / ItemDisplayInfo.dbc unter %s) — leere Map."
            % DBC_DIR)

    keep_urls = load_existing_urls()

    if full:
        print("Vollscan: alle ItemIds mit DisplayInfo-Icon "
              "-> data/itemicons-all.json")
        wanted = None
        dest = os.path.join(DATA, "itemicons-all.json")
    else:
        wanted = collect_export_item_ids()
        print("Kompakt: %d ItemIds (Testexporte + Seed + Levelrun)"
              % len(wanted))
        dest = os.path.join(DATA, "itemicons.json")

    item_meta, n_item = load_item_meta(wanted)
    print("Item.dbc Zeilen:", n_item, "| Treffer:", len(item_meta))

    icons = load_icons_for([m[0] for m in item_meta.values()])
    print("DisplayInfo-Icons:", len(icons))

    by_item = {}
    miss = []
    for iid, (did, cls, sub, inv) in item_meta.items():
        icon = icons.get(did)
        if not icon:
            miss.append(iid)
            continue
        key = str(iid)
        by_item[key] = build_entry(
            icon, cls, sub, inv, url=keep_urls.get(key))

    if miss:
        print("Ohne Icon:", len(miss), "Beispiel:", miss[:10])

    print("Probe:")
    for iid in PROBE_IDS:
        print(" ", iid, by_item.get(str(iid), "—"))

    if check_blp:
        blps = index_blp_names()
        if not blps:
            print("BLP-Index leer/fehlt:", ICON_ROOT)
        else:
            names = set()
            for v in by_item.values():
                if isinstance(v, str):
                    names.add(v)
                elif isinstance(v, dict) and v.get("i"):
                    names.add(v["i"])
            have = sum(1 for ic in names if ic in blps)
            print("BLP-Treffer: %d / %d eindeutige Icons (von %d BLP-Dateien)"
                  % (have, len(names), len(blps)))

    kb = write_json(dest, by_item)
    print("Geschrieben:", dest, "| %d Eintraege | %.2f KB"
          % (len(by_item), kb))
    if keep_urls:
        kept = sum(1 for k in by_item if k in keep_urls)
        print("WebP-urls behalten:", kept, "/", len(keep_urls))

    # Kompakte Einbettungsdatei immer pflegen, auch nach --all.
    if full:
        compact_ids = collect_export_item_ids()
        compact = {str(i): by_item[str(i)]
                   for i in compact_ids if str(i) in by_item}
        cdest = os.path.join(DATA, "itemicons.json")
        ckb = write_json(cdest, compact)
        print("Kompakt parallel:", cdest, "| %d | %.2f KB"
              % (len(compact), ckb))
    elif kb > EMBED_SOFT_MAX_KB:
        print("Hinweis: ueber Soft-Limit %d KB — assemble skippt iic (>512 KB)."
              % EMBED_SOFT_MAX_KB)

    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
