"""Query-count harness for GET /api/v1/activity/overview (QA, 2026-10-21, board issue i-20261021-aov1).
Loads the REAL backend.py monolith with the MySQL connect check stubbed, swaps the engine for in-memory sqlite,
seeds one progressive plan (QA_NSES sessions x QA_NEX exercises, 2 completed cycles, exercises with image_url),
calls the route and prints every SQL statement grouped by the backend.py line that issued it.
Run from a checkout root:  PYTHONIOENCODING=utf-8 <venv>/python.exe -W ignore tools/aov_query_count_harness.py
Baseline at e38ef80c (prod): 91 statements for 5x6 (prod QA account logged 92). QA_MAX_STMTS=N turns it into a gate.
Turn the seeding + count block into a pytest fixture/subprocess for the repo test (importing backend in-process pollutes sys.modules).
"""
import os, sys, types, datetime, re, collections, json
os.environ.setdefault('DATABASE_URL', 'mysql+mysqlconnector://u:p@localhost/qa')
os.environ.setdefault('JWT_SECRET_KEY', 'qa-secret-qa-secret-qa-secret-qa-secret-1')
os.environ.setdefault('SECRET_KEY', 'qa-secret-qa-secret-qa-secret-qa-secret-2')
os.environ.setdefault('FLASK_ENV', 'testing')
os.environ.setdefault('SOCKETIO_SECRET_KEY', 'qa-secret-qa-secret-qa-secret-qa-secret-3')
if 'openai' not in sys.modules:
    try:
        import openai  # noqa
    except ImportError:
        m = types.ModuleType('openai')
        class _O:  # noqa
            def __init__(self, *a, **k): pass
        m.OpenAI = _O
        sys.modules['openai'] = m
import mysql.connector
class _Conn:
    def close(self): pass
mysql.connector.connect = lambda *a, **k: _Conn()
sys.path.insert(0, os.getcwd())
import backend  # noqa
from backend import nyus_app, db
from sqlalchemy import create_engine, event
from sqlalchemy.pool import StaticPool
eng = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
@event.listens_for(eng, 'connect')
def _fn(dbapi, rec):
    dbapi.create_function('year', 1, lambda v: int(str(v)[:4]) if v else None)
    dbapi.create_function('week', 1, lambda v: int(datetime.datetime.fromisoformat(str(v)[:19]).strftime('%W')) if v else None)
    dbapi.create_function('curdate', 0, lambda: datetime.date.today().isoformat())
    dbapi.create_function('now', 0, lambda: datetime.datetime.utcnow().isoformat(sep=' '))
engs = db._app_engines[nyus_app]
for k in list(engs.keys()):
    engs[k] = eng
nyus_app.config['TESTING'] = True
nyus_app.config['PROPAGATE_EXCEPTIONS'] = True
backend.register_urls(nyus_app) if not any(r.rule.endswith('/activity/overview') for r in nyus_app.url_map.iter_rules()) else None
import db_models as M
with nyus_app.app_context():
    try:
        db.create_all()
    except Exception as e:
        print('create_all warning:', str(e)[:200])
from sqlalchemy import text
with eng.begin() as cx:
    cx.execute(text("CREATE TABLE IF NOT EXISTS exercise_progression_state (user_id TEXT, exercise_id INTEGER, plan_id INTEGER, status TEXT, next_weight_kg REAL, next_reps INTEGER, increment_kg REAL, evaluated_session_log_id INTEGER)"))
print('MODELS OK; tables:', len(db.metadata.tables))

# ---------------- seed ----------------
import traceback
from flask_jwt_extended import create_access_token
UID = 'aov-user-1'
today = datetime.date.today()
NEX, NSES = int(os.environ.get('QA_NEX', '6')), int(os.environ.get('QA_NSES', '5'))
with nyus_app.app_context():
    u = M.User(id=UID, email='aov@example.com', onboarding_complete=True, is_verified=True, name='AOV')
    db.session.add(u)
    exs = []
    for i in range(NEX * NSES):
        e = M.Exercise(name=f'Exercise {i}', canonical_name=f'exercise-{i}', image_url=(None if os.environ.get('QA_NOIMG') else f'https://nyus.in/img/{i}.png'))
        db.session.add(e); exs.append(e)
    db.session.flush()
    plan = M.WorkoutPlan(user_id=UID, name='QA Progressive', start_date=today - datetime.timedelta(days=40), is_progressive=True, is_active=True, sessions_per_block=NSES, blocks_count=1, cycles_count=4)
    db.session.add(plan); db.session.flush()
    sess = []
    for s in range(NSES):
        ws = M.WorkoutSession(plan_id=plan.id, name=f'Session {s+1}', session_number=s + 1, block_number=1, day_offset=s, day_of_week=s)
        db.session.add(ws); db.session.flush(); sess.append(ws)
        for k in range(NEX):
            db.session.add(M.SessionExercise(session_id=ws.id, exercise_id=exs[s * NEX + k].id, display_order=k + 1, target_sets=3, target_reps='8-10', notes=json.dumps({'rest_seconds': 90})))
    db.session.flush()
    # history: 2 completed cycles of sessions, with sets for every exercise
    d = today - datetime.timedelta(days=30)
    LID=[0]; SID=[0]
    for cyc in (1, 2):
        for s in range(NSES):
            st = datetime.datetime.combine(d, datetime.time(7, 0)); d += datetime.timedelta(days=1)
            LID[0]+=1; lg = M.WorkoutSessionLog(id=LID[0], user_id=UID, session_id=sess[s].id, started_at=st, completed_at=st + datetime.timedelta(hours=1), cycle_number=cyc)
            db.session.add(lg); db.session.flush()
            for k in range(NEX):
                for sn in (1, 2, 3):
                    SID[0]+=1; db.session.add(M.SetLog(id=SID[0], session_log_id=lg.id, exercise_id=exs[s * NEX + k].id, set_number=sn, reps=8 + sn, weight_kg=20 + cyc * 2 + sn, body_weight_kg=70))
    db.session.commit()
    token = create_access_token(identity=UID)

stmts = []
here = os.path.abspath(os.path.dirname(backend.__file__))
@event.listens_for(eng, 'before_cursor_execute')
def _cnt(conn, cur, statement, params, ctx, many):
    site = None
    for fr in reversed(traceback.extract_stack()):
        if os.path.abspath(fr.filename).startswith(here) and 'site-packages' not in fr.filename and not fr.filename.endswith('qa-aov-harness.py'):
            site = f"{os.path.relpath(fr.filename, here)}:{fr.lineno}"; break
    stmts.append((site, ' '.join(statement.split())[:140]))

c = nyus_app.test_client()
def hit(label):
    stmts.clear()
    import traceback as _tb
    try:
        r = c.get('/api/v1/activity/overview', headers={'Authorization': f'Bearer {token}'})
    except Exception:
        _tb.print_exc(); raise
    n = len(stmts)
    print(f'## {label}: HTTP {r.status_code}, {n} SQL statements')
    return r, list(stmts)
r, st = hit('seeded: %d sessions x %d exercises, 2 completed cycles' % (NSES, NEX))
FIRST_N = len(st)
if r.status_code != 200:
    print(r.get_data(as_text=True)[:500])
by = collections.Counter(s for s, _ in st)
for s, n in by.most_common(25):
    print(f'{n:4d} x {s}')
print('--- distinct statement shapes (top):')
shape = collections.Counter(re.sub(r'\d+', 'N', q)[:110] for _, q in st)
for q, n in shape.most_common(12):
    print(f'{n:4d} x {q}')

stmts.clear()
rb = c.get('/api/v1/payments/launch-offer-status', headers={'Authorization': f'Bearer {token}'})
print(f'## baseline authenticated trivial route (launch-offer-status): HTTP {rb.status_code}, {len(stmts)} SQL statements')
for s, n in collections.Counter(s for s, _ in stmts).most_common(12): print(f'{n:4d} x {s}')

# ---- verify the proposed 2-query replacement for the 7-day + 7-week loops gives identical numbers ----
from sqlalchemy import func
from backend import _set_volume_sql
with nyus_app.app_context():
    SetLog, WSL = M.SetLog, M.WorkoutSessionLog
    # make the data non-trivial: spread completed logs over the last 49 days
    import random
    random.seed(1)
    logs = WSL.query.filter(WSL.user_id == UID).order_by(WSL.id).all()
    for i, lg in enumerate(logs):
        lg.started_at = datetime.datetime.combine(today - datetime.timedelta(days=(i * 5) % 48), datetime.time(7, 0))
        lg.completed_at = lg.started_at + datetime.timedelta(hours=1)
    db.session.commit()
    stmts.clear()
    old_daily, old_weekly = [], []
    for i in range(6, -1, -1):
        d = today - datetime.timedelta(days=i)
        v = db.session.query(func.sum(_set_volume_sql())).join(WSL, WSL.id == SetLog.session_log_id).filter(WSL.user_id == UID).filter(WSL.completed_at != None).filter(func.date(WSL.completed_at) == d).scalar() or 0
        n = db.session.query(func.count(WSL.id)).filter(WSL.user_id == UID).filter(WSL.completed_at != None).filter(func.date(WSL.completed_at) == d).scalar() or 0
        old_daily.append((d, float(v), int(n)))
    for i in range(6, -1, -1):
        we = today - datetime.timedelta(days=i * 7); ws = we - datetime.timedelta(days=6)
        v = db.session.query(func.sum(_set_volume_sql())).join(WSL, WSL.id == SetLog.session_log_id).filter(WSL.user_id == UID).filter(WSL.completed_at != None).filter(func.date(WSL.completed_at) >= ws).filter(func.date(WSL.completed_at) <= we).scalar() or 0
        old_weekly.append((we, float(v)))
    n_old = len(stmts)
    stmts.clear()
    since = today - datetime.timedelta(days=48)
    day_col = func.date(WSL.completed_at)
    vol_rows = db.session.query(day_col, func.sum(_set_volume_sql())).join(WSL, WSL.id == SetLog.session_log_id).filter(WSL.user_id == UID, WSL.completed_at != None, WSL.completed_at >= datetime.datetime.combine(since, datetime.time.min)).group_by(day_col).all()
    cnt_rows = db.session.query(day_col, func.count(WSL.id)).filter(WSL.user_id == UID, WSL.completed_at != None, WSL.completed_at >= datetime.datetime.combine(since, datetime.time.min)).group_by(day_col).all()
    n_new = len(stmts)
    key = lambda d: d if isinstance(d, datetime.date) else datetime.date.fromisoformat(str(d)[:10])
    vol = {key(d): float(v or 0) for d, v in vol_rows}; cnt = {key(d): int(n) for d, n in cnt_rows}
    new_daily = [(today - datetime.timedelta(days=i), vol.get(today - datetime.timedelta(days=i), 0.0), cnt.get(today - datetime.timedelta(days=i), 0)) for i in range(6, -1, -1)]
    new_weekly = []
    for i in range(6, -1, -1):
        we = today - datetime.timedelta(days=i * 7)
        new_weekly.append((we, sum(vol.get(we - datetime.timedelta(days=k), 0.0) for k in range(7))))
    print(f'## loops replacement check: old {n_old} statements -> new {n_new}; daily equal={old_daily == new_daily}; weekly equal={all(abs(a[1]-b[1])<1e-6 and a[0]==b[0] for a, b in zip(old_weekly, new_weekly))}')
    print('   non-zero days:', sum(1 for x in old_daily if x[1] or x[2]), 'non-zero weeks:', sum(1 for x in old_weekly if x[1]))

# ---- profile where the non-DB time goes (second call, warm) ----
import cProfile, pstats, io, time
hit('warm-up')
pr = cProfile.Profile(); t0 = time.perf_counter(); pr.enable()
rr = c.get('/api/v1/activity/overview', headers={'Authorization': f'Bearer {token}'})
pr.disable(); wall = (time.perf_counter() - t0) * 1000
s = io.StringIO(); ps = pstats.Stats(pr, stream=s).sort_stats('cumulative'); ps.print_stats(45)
print(f'## profile: wall {wall:.0f} ms (sqlite in-memory, cProfile overhead included), status {rr.status_code}')
for line in s.getvalue().splitlines():
    if any(k in line for k in ('qa-be-aov', 'backend.py', 'app\services', 'progress', 'logging', 'print', 'sqlalchemy\orm\query', 'cursor.execute', '_log_')) and 'cumtime' not in line:
        print(line[:200])
print('## callers')
for fn in ('heal_stale_session_logs', 'get_current_unlocked_session', 'resolve_active_workout_plan'):
    s2 = io.StringIO(); pstats.Stats(pr, stream=s2).print_callers(fn)
    for ln in s2.getvalue().splitlines():
        if 'backend.py' in ln or 'app\services' in ln:
            print(' ', fn, '<-', ln.strip()[:170])

# ---- gate: QA_MAX_STMTS=64 python qa-aov-harness.py  -> exit 1 when the seeded overview issues more statements than allowed
if os.environ.get('QA_MAX_STMTS') and FIRST_N > int(os.environ['QA_MAX_STMTS']):
    print(f'FAIL: {FIRST_N} statements > QA_MAX_STMTS={os.environ["QA_MAX_STMTS"]}'); sys.exit(1)
