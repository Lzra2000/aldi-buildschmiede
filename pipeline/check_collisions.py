# -*- coding: utf-8 -*-
"""Print catalog name collisions (same display name, different entries).

Useful after catalog refreshes. Exit 0 always; prints nothing if clean.
"""
from __future__ import print_function
import json
import os
import sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

def main():
    cat = json.load(open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    sid_path = os.path.join(DATA, "spellids.json")
    ids = None
    if os.path.exists(sid_path):
        ids = json.load(open(sid_path, encoding="utf-8"))

    by = defaultdict(list)
    for i, e in enumerate(cat):
        by[e[0]].append(i)

    dups = [(n, idxs) for n, idxs in by.items() if len(idxs) > 1]
    if not dups:
        return 0

    dups.sort(key=lambda kv: (-len(kv[1]), kv[0]))
    print("%d colliding names (%d extra rows) in catalog.json" % (
        len(dups), sum(len(v) - 1 for _, v in dups)))
    for n, idxs in dups:
        bits = []
        for i in idxs:
            sid = ids[i][0] if ids and i < len(ids) else "?"
            bits.append("%s/%s#%s" % (cat[i][2], cat[i][3], sid))
        print("  %s (%dx): %s" % (n, len(idxs), ", ".join(bits)))
    return 0

if __name__ == "__main__":
    sys.exit(main())
