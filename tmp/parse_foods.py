import json, sys
d = json.load(open(sys.argv[1]))
foods = (d.get('data') or {}).get('foods') or d.get('foods') or []
print("COUNT:", len(foods))
for f in foods:
    print(repr(f.get('name')), "|", f.get('category'), "|", f.get('source'), "|", f.get('calories') or f.get('kcal'))
