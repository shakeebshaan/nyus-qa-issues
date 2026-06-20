"""Create a FRESH, non-onboarded throwaway user + mint a session, so the
onboarding flow can be walked + captured for QA i-20260617-9375.
Run on prod from ~/nyu_backend:  ./venv/bin/python /tmp/provision_onboarding_user.py
"""
import json
import uuid
from backend import nyus_app as app, create_access_token, create_refresh_token, _stamp_user_session
from db_models import db, User

with app.app_context():
    email = "qa-onboard-" + uuid.uuid4().hex[:8] + "@nyustest.local"
    u = User(email=email, is_verified=True, onboarding_complete=False)
    db.session.add(u)
    db.session.commit()
    access = create_access_token(identity=u.id)
    refresh = create_refresh_token(identity=u.id)
    _stamp_user_session(u.id, access)
    db.session.commit()
    print("FRESH_USER_JSON_START")
    print(json.dumps({
        "id": u.id,
        "email": email,
        "onboarding_complete": u.onboarding_complete,
        "access_token": access,
    }))
    print("FRESH_USER_JSON_END")
