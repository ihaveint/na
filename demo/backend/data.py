from datetime import datetime, timezone, timedelta
from models import Thread

_now = datetime.now(timezone.utc)
_d = lambda days: _now - timedelta(days=days)
_f = lambda days: _now + timedelta(days=days)


THREADS: list[Thread] = [
    Thread(id="t1", subject="Q2 budget review — need your sign-off", sender="cfo@acme.com",
           sender_name="Rachel Kim", preview="Hi, attached is the Q2 budget draft. We need approval before Friday.",
           project="Finance", urgency_score=92, date=_d(0), is_read=False, due_date=_f(2),
           tags=["budget", "approval"]),

    Thread(id="t2", subject="Production incident: API latency spike", sender="ops@acme.com",
           sender_name="Ops Bot", preview="Alert: p99 latency exceeded 2s threshold for 10+ minutes.",
           project="Engineering", urgency_score=98, date=_d(0), is_read=False,
           tags=["incident", "urgent"]),

    Thread(id="t3", subject="Interview feedback needed — senior eng candidate", sender="hr@acme.com",
           sender_name="Dana Lee", preview="Could you submit your scorecard for Alex M. by EOD?",
           project="Hiring", urgency_score=75, date=_d(1), is_read=True, due_date=_f(1),
           tags=["hiring"]),

    Thread(id="t4", subject="Re: Partnership proposal — follow up", sender="biz@partnercorp.com",
           sender_name="Mark Torres", preview="Following up on our conversation last week about the integration.",
           project="BD", urgency_score=60, date=_d(1), is_read=True,
           tags=["partnership"]),

    Thread(id="t5", subject="Design review: new onboarding flow", sender="design@acme.com",
           sender_name="Priya Shah", preview="Sharing the updated Figma for the onboarding redesign. Would love your thoughts.",
           project="Product", urgency_score=45, date=_d(2), is_read=True, due_date=_f(3),
           tags=["design", "review"]),

    Thread(id="t6", subject="AWS bill spike — 40% increase this month", sender="billing@aws.amazon.com",
           sender_name="AWS Billing", preview="Your estimated charges for April are $14,200, up from $10,100.",
           project="Engineering", urgency_score=80, date=_d(2), is_read=False,
           tags=["cost", "infra"]),

    Thread(id="t7", subject="CS 189 — Assignment 4 grades posted", sender="no-reply@university.edu",
           sender_name="University Portal", preview="Your grade for Assignment 4 has been posted. Check the portal.",
           project="School", urgency_score=55, date=_d(0), is_read=False,
           tags=["grades"]),

    Thread(id="t8", subject="Study group — midterm prep Thursday 7pm", sender="classmate@university.edu",
           sender_name="Jamie Wu", preview="Hey, we're meeting in the library Thursday at 7 to go over linear algebra.",
           project="School", urgency_score=70, date=_d(1), is_read=True, due_date=_f(2),
           tags=["study", "midterm"]),

    Thread(id="t9", subject="Internship offer from Stripe — please respond by May 2", sender="recruiting@stripe.com",
           sender_name="Stripe Recruiting", preview="We're thrilled to extend you an offer for our summer engineering internship.",
           project="Career", urgency_score=95, date=_d(1), is_read=False, due_date=_f(4),
           tags=["offer", "deadline"]),

    Thread(id="t10", subject="Sublet listing — room available May 1 near campus", sender="roomie@gmail.com",
           sender_name="Alex Chen", preview="I'm looking for someone to sublet my room May–August, $900/mo.",
           project=None, urgency_score=30, date=_d(3), is_read=True,
           tags=[]),

    Thread(id="t11", subject="PR review requested: auth middleware refactor", sender="github@github.com",
           sender_name="GitHub", preview="@you was requested to review a pull request by @sarah-dev.",
           project="Engineering", urgency_score=65, date=_d(0), is_read=False,
           tags=["pr", "review"]),

    Thread(id="t12", subject="Terraform plan diff — staging deploy", sender="ci@acme.com",
           sender_name="CI Bot", preview="Terraform plan complete. 3 resources to add, 1 to destroy. Approval needed.",
           project="Engineering", urgency_score=70, date=_d(0), is_read=False,
           tags=["infra", "approval"]),

    Thread(id="t13", subject="Quarterly board deck — first draft", sender="ceo@acme.com",
           sender_name="Sarah Chen (CEO)", preview="Attaching the first draft of the Q2 board deck. Please review slides 8–12.",
           project="Finance", urgency_score=85, date=_d(1), is_read=True, due_date=_f(5),
           tags=["board", "review"]),

    Thread(id="t14", subject="User research session — can you join Thursday?", sender="ux@acme.com",
           sender_name="Jordan Kim", preview="We have 3 user research sessions Thursday 2–5pm. Would love an eng observer.",
           project="Product", urgency_score=40, date=_d(2), is_read=True, due_date=_f(2),
           tags=["research"]),

    Thread(id="t15", subject="Security audit findings — action items", sender="security@acme.com",
           sender_name="Security Team", preview="Sharing the pen test results. 2 high-severity findings need immediate attention.",
           project="Engineering", urgency_score=90, date=_d(1), is_read=False,
           tags=["security", "urgent"]),

    Thread(id="t16", subject="Re: Async vs sync API design — RFC", sender="eng@acme.com",
           sender_name="Dev Mailing List", preview="Continuing the thread on whether the new export API should be sync or async.",
           project="Engineering", urgency_score=35, date=_d(4), is_read=True,
           tags=["rfc"]),

    Thread(id="t17", subject="Visa appointment confirmation — June 3", sender="consulate@gov.example",
           sender_name="Consulate Booking", preview="Your appointment is confirmed for June 3 at 9:00am. Bring original documents.",
           project="Personal", urgency_score=88, date=_d(5), is_read=True, due_date=_f(36),
           tags=["visa", "important"]),

    Thread(id="t18", subject="Lunch Tuesday? Catching up on the new role", sender="friend@gmail.com",
           sender_name="Mia Rodriguez", preview="Hey! Heard you started the new job — would love to hear about it over lunch.",
           project=None, urgency_score=20, date=_d(3), is_read=True,
           tags=[]),

    Thread(id="t19", subject="Contract renewal — SaaS vendor", sender="renewals@vendor.com",
           sender_name="Vendor Sales", preview="Your annual contract expires May 15. Renewing now locks in your current rate.",
           project="Finance", urgency_score=72, date=_d(2), is_read=False, due_date=_f(17),
           tags=["contract", "renewal"]),

    Thread(id="t20", subject="Hackathon this weekend — team forming", sender="club@university.edu",
           sender_name="CS Club", preview="TreeHacks is this Friday–Sunday. We still have spots on the team if you're interested.",
           project="School", urgency_score=50, date=_d(1), is_read=True, due_date=_f(3),
           tags=["hackathon"]),
]

THREADS_BY_ID: dict[str, Thread] = {t.id: t for t in THREADS}
