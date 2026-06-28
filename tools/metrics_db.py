#!/usr/bin/env python3
# metrics_db.py — computes REAL product/growth/finance/AI/etc. metrics from the
# NYUS prod MySQL DB. Runs ON the prod host (only it reaches 10.0.0.88). Prints a
# JSON object to stdout. Every metric is wrapped so one failure never aborts the
# rest (failed metric -> null + an "_errors" list). No mock data — all live SQL.
import re, json, sys
from datetime import datetime, timezone
from sqlalchemy import create_engine, text

url = re.search(r'DATABASE_URL=(.+)', open('.env').read()).group(1).strip().strip('"')
eng = create_engine(url)
out = {"_generated_at": datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), "_errors": []}

def q1(c, sql, **p):
    return c.execute(text(sql), p).scalar()

def metric(name, fn):
    try:
        with eng.connect() as c:
            out[name] = fn(c)
    except Exception as ex:
        out[name] = None
        out["_errors"].append(f"{name}: {str(ex)[:120]}")

# ---- Product & Growth ----
metric("users_total",      lambda c: q1(c, "SELECT COUNT(*) FROM users"))
metric("users_active",     lambda c: q1(c, "SELECT COUNT(*) FROM users WHERE is_active=1 AND (is_banned=0 OR is_banned IS NULL)"))
metric("users_new_today",  lambda c: q1(c, "SELECT COUNT(*) FROM users WHERE created_at >= CURDATE()"))
metric("users_new_7d",     lambda c: q1(c, "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 7 DAY"))
metric("users_new_30d",    lambda c: q1(c, "SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL 30 DAY"))
metric("users_verified",   lambda c: q1(c, "SELECT COUNT(*) FROM users WHERE is_verified=1"))
metric("onboarding_complete", lambda c: q1(c, "SELECT COUNT(*) FROM users WHERE onboarding_complete=1"))
# Activation = onboarding_complete / verified (the "aha": finished onboarding -> has a plan)
def _activation(c):
    comp = q1(c, "SELECT COUNT(*) FROM users WHERE onboarding_complete=1")
    tot  = q1(c, "SELECT COUNT(*) FROM users WHERE is_verified=1") or 0
    return round(100.0*comp/tot, 1) if tot else None
metric("activation_rate_pct", _activation)

# DAU / WAU / MAU via user_sessions.last_active (distinct users)
metric("dau", lambda c: q1(c, "SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE last_active >= NOW() - INTERVAL 1 DAY"))
metric("wau", lambda c: q1(c, "SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE last_active >= NOW() - INTERVAL 7 DAY"))
metric("mau", lambda c: q1(c, "SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE last_active >= NOW() - INTERVAL 30 DAY"))
def _sticky(c):
    d = q1(c, "SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE last_active >= NOW() - INTERVAL 1 DAY") or 0
    m = q1(c, "SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE last_active >= NOW() - INTERVAL 30 DAY") or 0
    return round(100.0*d/m, 1) if m else None
metric("stickiness_dau_mau_pct", _sticky)

# Retention DN: of users who signed up ~N days ago, % with a session on/after day N
def _ret(days):
    def fn(c):
        cohort = q1(c, f"SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL {days+1} DAY AND created_at < NOW() - INTERVAL {days} DAY") or 0
        if not cohort: return None
        ret = q1(c, f"""SELECT COUNT(DISTINCT u.id) FROM users u JOIN user_sessions s ON s.user_id COLLATE utf8mb4_unicode_ci = u.id
                        WHERE u.created_at >= NOW() - INTERVAL {days+1} DAY AND u.created_at < NOW() - INTERVAL {days} DAY
                        AND s.last_active >= u.created_at + INTERVAL {days} DAY""") or 0
        return {"cohort": cohort, "retained": ret, "pct": round(100.0*ret/cohort, 1)}
    return fn
metric("retention_d1", _ret(1))
metric("retention_d7", _ret(7))
metric("retention_d30", _ret(30))

# North Star + feature adoption + engagement volume
metric("workouts_completed_7d", lambda c: q1(c, "SELECT COUNT(*) FROM workout_session_logs WHERE completed_at >= NOW() - INTERVAL 7 DAY"))
metric("workouts_completed_30d", lambda c: q1(c, "SELECT COUNT(*) FROM workout_session_logs WHERE completed_at >= NOW() - INTERVAL 30 DAY"))
metric("meals_logged_7d",  lambda c: q1(c, "SELECT COUNT(*) FROM meal_logs WHERE log_date >= CURDATE() - INTERVAL 7 DAY"))
metric("meals_logged_30d", lambda c: q1(c, "SELECT COUNT(*) FROM meal_logs WHERE log_date >= CURDATE() - INTERVAL 30 DAY"))
metric("weight_logs_30d",  lambda c: q1(c, "SELECT COUNT(*) FROM weight_log WHERE logged_at >= NOW() - INTERVAL 30 DAY"))
def _adopt(c):
    mau = q1(c, "SELECT COUNT(DISTINCT user_id) FROM user_sessions WHERE last_active >= NOW() - INTERVAL 30 DAY") or 0
    if not mau: return None
    meal = q1(c, "SELECT COUNT(DISTINCT user_id) FROM meal_logs WHERE log_date >= CURDATE() - INTERVAL 30 DAY") or 0
    wo   = q1(c, "SELECT COUNT(DISTINCT user_id) FROM workout_session_logs WHERE completed_at >= NOW() - INTERVAL 30 DAY") or 0
    wt   = q1(c, "SELECT COUNT(DISTINCT user_id) FROM weight_log WHERE logged_at >= NOW() - INTERVAL 30 DAY") or 0
    return {"meal_logging_pct": round(100.0*meal/mau,1), "workout_pct": round(100.0*wo/mau,1), "weight_pct": round(100.0*wt/mau,1)}
metric("feature_adoption_30d", _adopt)

# Funnel: signups -> verified -> onboarding_complete -> subscribed
def _funnel(c):
    signs = q1(c, "SELECT COUNT(*) FROM users") or 0
    ver   = q1(c, "SELECT COUNT(*) FROM users WHERE is_verified=1") or 0
    onb   = q1(c, "SELECT COUNT(*) FROM users WHERE onboarding_complete=1") or 0
    sub   = q1(c, "SELECT COUNT(DISTINCT user_id) FROM subscriptions WHERE status IN ('active','trialing','authenticated')") or 0
    def pct(a,b): return round(100.0*a/b,1) if b else None
    return {"signups": signs, "verified": ver, "onboarded": onb, "subscribed": sub,
            "verify_pct": pct(ver,signs), "onboard_pct": pct(onb,ver), "subscribe_pct": pct(sub,onb)}
metric("funnel", _funnel)

# ---- Finance & Monetization (subscriptions table; amount_paid is minor units) ----
def _subs(c):
    active = q1(c, "SELECT COUNT(*) FROM subscriptions WHERE status IN ('active','trialing','authenticated')") or 0
    trialing = q1(c, "SELECT COUNT(*) FROM subscriptions WHERE status='trialing'") or 0
    canceled_30d = q1(c, "SELECT COUNT(*) FROM subscriptions WHERE canceled_at >= NOW() - INTERVAL 30 DAY") or 0
    # MRR: sum of amount_paid for currently-active paid subs (amount in minor units -> /100)
    mrr_minor = q1(c, "SELECT COALESCE(SUM(amount_paid),0) FROM subscriptions WHERE status='active' AND amount_paid > 0") or 0
    by_cur = {}
    try:
        for r in c.execute(text("SELECT currency, COALESCE(SUM(amount_paid),0), COUNT(*) FROM subscriptions WHERE status='active' AND amount_paid>0 GROUP BY currency")):
            by_cur[(r[0] or 'unknown')] = {"sum_minor": int(r[1]), "count": int(r[2])}
    except Exception: pass
    active_start = active + canceled_30d
    churn = round(100.0*canceled_30d/active_start, 1) if active_start else None
    return {"active": active, "trialing": trialing, "canceled_30d": canceled_30d,
            "mrr_minor_units": int(mrr_minor), "mrr_by_currency": by_cur,
            "churn_30d_pct": churn,
            "_note": "amount_paid is in minor units (paise/cents); divide by 100. ARPU/LTV/CAC need Stripe+ad-spend (owner)."}
metric("subscriptions", _subs)

# ---- AI System (llm_interaction_logs) ----
def _ai(c):
    total_30d = q1(c, "SELECT COUNT(*) FROM llm_interaction_logs WHERE created_at >= NOW() - INTERVAL 30 DAY") or 0
    today = q1(c, "SELECT COUNT(*) FROM llm_interaction_logs WHERE created_at >= CURDATE()") or 0
    errs_30d = q1(c, "SELECT COUNT(*) FROM llm_interaction_logs WHERE created_at >= NOW() - INTERVAL 30 DAY AND error IS NOT NULL AND error <> ''") or 0
    cnt = q1(c, "SELECT COUNT(*) FROM llm_interaction_logs WHERE latency_ms IS NOT NULL AND created_at >= NOW()-INTERVAL 30 DAY") or 0
    def pct_latency(frac):
        if not cnt: return None
        off = min(int(cnt*frac), cnt-1)
        return q1(c, f"SELECT latency_ms FROM llm_interaction_logs WHERE latency_ms IS NOT NULL AND created_at >= NOW()-INTERVAL 30 DAY ORDER BY latency_ms LIMIT 1 OFFSET {off}")
    p50 = pct_latency(0.50)
    p95v = pct_latency(0.95)
    cost_30d = q1(c, "SELECT COALESCE(SUM(cost_usd),0) FROM llm_interaction_logs WHERE created_at >= NOW() - INTERVAL 30 DAY")
    cost_today = q1(c, "SELECT COALESCE(SUM(cost_usd),0) FROM llm_interaction_logs WHERE created_at >= CURDATE()")
    tokens_30d = q1(c, "SELECT COALESCE(SUM(total_tokens),0) FROM llm_interaction_logs WHERE created_at >= NOW() - INTERVAL 30 DAY") or 0
    safety = q1(c, "SELECT COUNT(*) FROM llm_interaction_logs WHERE content_safety_flagged=1 AND created_at >= NOW()-INTERVAL 30 DAY") or 0
    inj = q1(c, "SELECT COUNT(*) FROM llm_interaction_logs WHERE injection_detected=1 AND created_at >= NOW()-INTERVAL 30 DAY") or 0
    by_model = {}
    for r in c.execute(text("SELECT model, COUNT(*), COALESCE(SUM(cost_usd),0), COALESCE(AVG(latency_ms),0) FROM llm_interaction_logs WHERE created_at >= NOW()-INTERVAL 30 DAY GROUP BY model")):
        by_model[(r[0] or 'unknown')] = {"calls": int(r[1]), "cost_usd": float(r[2]), "avg_latency_ms": int(r[3])}
    return {"calls_30d": total_30d, "calls_today": today,
            "error_rate_30d_pct": round(100.0*errs_30d/total_30d,2) if total_30d else None,
            "latency_p50_ms": int(p50) if p50 else None, "latency_p95_ms": int(p95v) if p95v else None,
            "cost_usd_30d": round(float(cost_30d),4) if cost_30d is not None else None,
            "cost_usd_today": round(float(cost_today),4) if cost_today is not None else None,
            "tokens_30d": int(tokens_30d), "safety_flagged_30d": safety, "injection_detected_30d": inj,
            "by_model": by_model,
            "_note": "Hallucination/factual-accuracy rate needs an eval harness (owner) — not auto-derivable from logs."}
metric("ai", _ai)

# ---- Support ----
def _support(c):
    fb_30d = q1(c, "SELECT COUNT(*) FROM app_feedback WHERE created_at >= NOW() - INTERVAL 30 DAY") or 0
    avg_stars = q1(c, "SELECT AVG(stars) FROM app_feedback WHERE stars IS NOT NULL AND stars > 0")
    with_comment = q1(c, "SELECT COUNT(*) FROM app_feedback WHERE comment IS NOT NULL AND comment <> ''") or 0
    tickets_open = None
    try: tickets_open = q1(c, "SELECT COUNT(*) FROM admin_support_tickets WHERE status NOT IN ('closed','resolved')")
    except Exception: pass
    return {"feedback_30d": fb_30d, "avg_stars": round(float(avg_stars),2) if avg_stars else None,
            "feedback_with_comment": with_comment, "support_tickets_open": tickets_open}
metric("support", _support)

# ---- Security ----
def _sec(c):
    by_sev = {}
    for r in c.execute(text("SELECT severity, COUNT(*) FROM security_event_logs WHERE created_at >= NOW()-INTERVAL 30 DAY GROUP BY severity")):
        by_sev[(r[0] or 'unknown')] = int(r[1])
    by_type = {}
    for r in c.execute(text("SELECT event_type, COUNT(*) FROM security_event_logs WHERE created_at >= NOW()-INTERVAL 30 DAY GROUP BY event_type ORDER BY COUNT(*) DESC LIMIT 8")):
        by_type[(r[0] or 'unknown')] = int(r[1])
    otp_30d = None
    try: otp_30d = q1(c, "SELECT COUNT(*) FROM otps WHERE created_at >= NOW()-INTERVAL 30 DAY")
    except Exception: pass
    return {"events_30d_by_severity": by_sev, "events_30d_by_type": by_type, "otp_requests_30d": otp_30d}
metric("security", _sec)

# ---- Social / Community (in-app) ----
def _social(c):
    def safe(sql):
        try: return q1(c, sql)
        except Exception: return None
    return {"friendships_total": safe("SELECT COUNT(*) FROM friendships"),
            "direct_messages_30d": safe("SELECT COUNT(*) FROM direct_messages WHERE created_at >= NOW()-INTERVAL 30 DAY"),
            "group_messages_30d": safe("SELECT COUNT(*) FROM group_messages WHERE created_at >= NOW()-INTERVAL 30 DAY"),
            "active_challenges": safe("SELECT COUNT(*) FROM challenges WHERE end_date >= CURDATE()"),
            "challenge_participants": safe("SELECT COUNT(*) FROM challenge_participants")}
metric("social_community", _social)

# ---- Web content (page_views) ----
def _web(c):
    pv_30d = q1(c, "SELECT COUNT(*) FROM page_views WHERE created_at >= NOW()-INTERVAL 30 DAY") or 0
    top = {}
    for r in c.execute(text("SELECT page, COUNT(*) FROM page_views WHERE created_at >= NOW()-INTERVAL 30 DAY GROUP BY page ORDER BY COUNT(*) DESC LIMIT 8")):
        top[(r[0] or '/')[:48]] = int(r[1])
    return {"page_views_30d": pv_30d, "top_pages_30d": top}
metric("web_content", _web)

# ---- Segmentation (analytics) ----
def _seg(c):
    def grp(col, tbl="user_health_profiles"):
        d = {}
        try:
            for r in c.execute(text(f"SELECT {col}, COUNT(*) FROM {tbl} WHERE {col} IS NOT NULL GROUP BY {col} ORDER BY COUNT(*) DESC LIMIT 8")):
                d[str(r[0])] = int(r[1])
        except Exception: pass
        return d
    return {"by_goal_type": grp("goal_type"), "by_gender": grp("gender"),
            "by_activity_level": grp("activity_level"), "by_platform": grp("platform","app_feedback")}
metric("segmentation", _seg)

# ---- Infra (scheduler health) ----
def _infra(c):
    def safe(sql):
        try: return q1(c, sql)
        except Exception: return None
    return {"scheduler_jobs": safe("SELECT COUNT(*) FROM apscheduler_jobs"),
            "deploy_log_30d": safe("SELECT COUNT(*) FROM admin_deploy_log WHERE created_at >= NOW()-INTERVAL 30 DAY")}
metric("infra_db", _infra)

# ---- Engagement extras (streaks/levels/xp/PRs) ----
def _eng(c):
    def safe(sql):
        try: return q1(c, sql)
        except Exception: return None
    return {"active_streaks": safe("SELECT COUNT(*) FROM user_streaks WHERE current_streak > 0"),
            "personal_records_30d": safe("SELECT COUNT(*) FROM personal_records WHERE created_at >= NOW()-INTERVAL 30 DAY"),
            "badges_earned_total": safe("SELECT COUNT(*) FROM user_badges"),
            "waitlist_signups": safe("SELECT COUNT(*) FROM waitlist_signups")}
metric("engagement_extra", _eng)

# ---- Experiments (A/B) ----
def _experiments(c):
    def safe(sql):
        try: return q1(c, sql)
        except Exception: return None
    return {"active": safe("SELECT COUNT(DISTINCT experiment_id) FROM user_experiment_assignments"),
            "assignments": safe("SELECT COUNT(*) FROM user_experiment_assignments"),
            "defined_active": safe("SELECT COUNT(*) FROM notification_experiments WHERE status='active'")}
metric("experiments", _experiments)

# ---- GDPR / privacy (table exists) ----
def _gdpr(c):
    def safe(sql):
        try: return q1(c, sql)
        except Exception: return None
    return {"requests_30d": safe("SELECT COUNT(*) FROM admin_gdpr_requests WHERE created_at >= NOW()-INTERVAL 30 DAY"),
            "open": safe("SELECT COUNT(*) FROM admin_gdpr_requests WHERE status NOT IN ('completed','closed','resolved')")}
metric("gdpr", _gdpr)

print(json.dumps(out, default=str))
