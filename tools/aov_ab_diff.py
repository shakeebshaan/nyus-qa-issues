import json,sys
def norm(o):
    if isinstance(o, dict): return {k: norm(v) for k, v in o.items() if k != 'achieved_at'}
    if isinstance(o, list): return [norm(x) for x in o]
    return o
def diff(a, b, p=''):
    out = []
    if type(a) != type(b): return [(p, a, b)]
    if isinstance(a, dict):
        for k in sorted(set(a) | set(b)):
            if k not in a: out.append((p + '.' + k, '<absent>', b[k]))
            elif k not in b: out.append((p + '.' + k, a[k], '<absent>'))
            else: out += diff(a[k], b[k], p + '.' + k)
    elif isinstance(a, list):
        if len(a) != len(b): return [(p, f'len {len(a)}', f'len {len(b)}')]
        for i, (x, y) in enumerate(zip(a, b)): out += diff(x, y, f'{p}[{i}]')
    elif a != b: out.append((p, a, b))
    return out
for s in sys.argv[1:]:
    o = json.load(open(f'{s}-old.json')); n = json.load(open(f'{s}-new.json'))
    d = diff(norm(o), norm(n))
    dd = n.get('data', n); tw = dd.get('todays_workout')
    state = f"plan={dd.get('plan_name')!r} prog={dd.get('is_progressive')} rest={dd.get('is_rest_day_today')} today={'None' if tw is None else (tw.get('session_name'), 'log' if tw.get('session_log_id') else '-', 'done' if tw.get('completed_today') else '-', len(tw.get('exercises') or []))}"
    print(f"{s:16} {'IDENTICAL' if not d else 'DIFF ' + str(len(d))} ({len(json.dumps(n))}b) | {state}")
    for x in d[:8]: print('    ', x)
