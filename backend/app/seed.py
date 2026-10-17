from sqlalchemy import select, text
from sqlalchemy.orm import selectinload
from .db import Base, engine, SessionLocal
from .models import User, Quiz, Question, Choice, SiteSetting, SitePage, ChatKnowledge, AuthorizedAdminEmail
from .security import hash_password
from .config import get_settings

QUESTIONS = [('A1', 'I ___ a student.', ['am', 'is', 'are', 'be'], 0, 'Verb to be'), ('A1', 'She ___ from Egypt.', ['am', 'is', 'are', 'be'], 1, 'Verb to be'), ('A1', 'They ___ English every day.', ['study', 'studies', 'studying', 'studied'], 0, 'Present simple'), ('A1', 'He ___ to school by bus.', ['go', 'goes', 'going', 'went'], 1, 'Present simple'), ('A1', 'There ___ a book on the table.', ['are', 'is', 'be', 'were'], 1, 'There is/are'), ('A1', 'I have ___ apple.', ['a', 'an', 'the', 'some'], 1, 'Articles'), ('A1', 'This is ___ brother.', ['me', 'my', 'I', 'mine'], 1, 'Possessive adjective'), ('A1', 'We ___ TV now.', ['watch', 'watched', 'are watching', 'watches'], 2, 'Present continuous'), ('A1', "The opposite of 'big' is ___.", ['small', 'long', 'fast', 'old'], 0, 'Vocabulary'), ('A1', 'Choose the correct plural: child → ___.', ['childs', 'children', 'childes', 'childrens'], 1, 'Irregular plural'), ('A2', 'Yesterday, I ___ my homework.', ['do', 'did', 'done', 'does'], 1, 'Past simple'), ('A2', 'We have lived here ___ 2020.', ['for', 'since', 'from', 'at'], 1, 'Present perfect'), ('A2', 'She is ___ than her sister.', ['tall', 'taller', 'tallest', 'more tall'], 1, 'Comparatives'), ('A2', "You ___ smoke here. It's prohibited.", ['must', "mustn't", 'can', 'should'], 1, 'Modals'), ('A2', 'How ___ water do you drink?', ['many', 'much', 'few', 'some'], 1, 'Quantifiers'), ('A2', "I don't have ___ money.", ['many', 'much', 'a few', 'several'], 1, 'Quantifiers'), ('A2', 'He was tired, ___ he went to bed early.', ['but', 'so', 'because', 'although'], 1, 'Conjunctions'), ('A2', 'If it rains, we ___ at home.', ['stay', 'stayed', 'will stay', 'would stay'], 2, 'First conditional'), ('A2', 'The train ___ at 7 tomorrow morning.', ['leave', 'leaves', 'left', 'leaving'], 1, 'Timetables'), ('A2', 'Could you ___ me the time?', ['say', 'tell', 'speak', 'talk'], 1, 'Vocabulary'), ('B1', 'I ___ this film three times.', ['see', 'saw', 'have seen', 'had seen'], 2, 'Present perfect'), ('B1', 'When I arrived, they ___ dinner.', ['have', 'had', 'were having', 'are having'], 2, 'Past continuous'), ('B1', 'If I ___ more time, I would learn Spanish.', ['have', 'had', 'will have', 'would have'], 1, 'Second conditional'), ('B1', 'The book ___ by millions of people every year.', ['reads', 'is read', 'was reading', 'has read'], 1, 'Passive voice'), ('B1', 'She asked me where I ___.', ['live', 'lived', 'am living', 'will live'], 1, 'Reported speech'), ('B1', "I'm interested ___ photography.", ['on', 'at', 'in', 'for'], 2, 'Prepositions'), ('B1', 'He apologized ___ being late.', ['for', 'to', 'about', 'of'], 0, 'Verb + preposition'), ('B1', 'By the time we got there, the shop ___.', ['closed', 'has closed', 'had closed', 'closes'], 2, 'Past perfect'), ('B1', 'I wish I ___ more confident.', ['am', 'was', 'were', 'will be'], 2, 'Wish'), ('B1', 'The meeting has been ___ until Monday.', ['put off', 'put out', 'put up', 'put on'], 0, 'Phrasal verbs'), ('B2', 'Hardly ___ the room when the phone rang.', ['I had left', 'had I left', 'I left', 'did I leave'], 1, 'Inversion'), ('B2', 'The manager insisted that he ___ the report immediately.', ['submits', 'submit', 'submitted', 'will submit'], 1, 'Subjunctive'), ('B2', 'No sooner had we arrived ___ it started raining.', ['when', 'than', 'then', 'that'], 1, 'Correlative structure'), ('B2', 'She denied ___ the confidential file.', ['to open', 'opening', 'open', 'opened'], 1, 'Gerund/infinitive'), ('B2', 'The proposal, ___ was discussed yesterday, was approved.', ['that', 'which', 'what', 'where'], 1, 'Relative clauses'), ('B2', 'Were I in your position, I ___ the offer.', ['accept', 'will accept', 'would accept', 'accepted'], 2, 'Inverted conditional'), ('B2', 'His explanation was so ___ that everyone understood.', ['ambiguous', 'coherent', 'scarce', 'reluctant'], 1, 'Vocabulary'), ('B2', 'We need to ___ the problem before it gets worse.', ['address', 'attend', 'approach to', 'reach'], 0, 'Collocation'), ('B2', 'The new policy is expected to ___ significant changes.', ['bring about', 'bring up', 'bring in', 'bring back'], 0, 'Phrasal verbs'), ('B2', "Despite ___ hard, he didn't pass the exam.", ['study', 'studied', 'studying', 'to study'], 2, 'Despite + gerund'), ('C1', 'Not until later ___ the significance of the decision.', ['I realized', 'did I realize', 'I did realize', 'realized I'], 1, 'Advanced inversion'), ('C1', "The evidence is ___ with the witness's account.", ['compatible', 'capable', 'comprehensive', 'comparable to'], 0, 'Academic vocabulary'), ('C1', 'Had it not been for your help, we ___ the deadline.', ['would miss', 'would have missed', 'missed', 'had missed'], 1, 'Third conditional'), ('C1', 'Her argument was persuasive, ___ somewhat overstated.', ['despite', 'albeit', 'whereas', 'unless'], 1, 'Concession'), ('C1', 'The findings should be interpreted with ___.', ['caution', 'cautious', 'cautiously', 'cautions'], 0, 'Word formation'), ('C1', 'He has a tendency to ___ minor issues out of proportion.', ['blow', 'make', 'put', 'set'], 0, 'Idiomatic phrase'), ('C1', 'The committee reached a ___ after several hours of debate.', ['consensus', 'consent', 'concession', 'consequence'], 0, 'Academic vocabulary'), ('C1', 'Scarcely had the speech begun ___ the power failed.', ['than', 'when', 'that', 'while'], 1, 'Inversion'), ('C1', "She is widely regarded ___ one of the field's leading experts.", ['to', 'for', 'as', 'like'], 2, 'Regard as'), ('C1', 'The report calls for a more ___ approach to assessment.', ['nuance', 'nuanced', 'nuancing', 'nuances'], 1, 'Word formation')]


def _seed_placement_quiz(db):
    quiz = db.scalar(
        select(Quiz)
        .where(Quiz.slug == "english-placement-50")
        .options(selectinload(Quiz.questions).selectinload(Question.choices))
    )
    if not quiz:
        quiz = Quiz(
            slug="english-placement-50",
            title_ar="اختبار تحديد المستوى في اللغة الإنجليزية",
            title_en="English Placement Test",
            description_ar="50 سؤالًا عشوائيًا من بنك الأسئلة لتحديد مستواك المبدئي من A1 إلى C1. سؤال واحد في كل خطوة والنتيجة تظهر فورًا.",
            description_en="50 questions to estimate your English level from A1 to C1.",
            duration_minutes=45,
            passing_score=60,
            max_attempts=2,
            randomize_questions=True,
            show_result_immediately=True,
            is_published=True,
            is_placement=True,
            is_archived=False,
        )
        db.add(quiz)
        db.flush()
    else:
        quiz.title_ar = "اختبار تحديد المستوى في اللغة الإنجليزية"
        quiz.title_en = "English Placement Test"
        quiz.description_ar = "50 سؤالًا عشوائيًا من بنك الأسئلة لتحديد مستواك المبدئي من A1 إلى C1. سؤال واحد في كل خطوة والنتيجة تظهر فورًا."
        quiz.duration_minutes = 45
        quiz.max_attempts = max(quiz.max_attempts or 0, 2)
        quiz.randomize_questions = True
        quiz.show_result_immediately = True
        quiz.is_published = True
        quiz.is_placement = True
        quiz.is_archived = False

    active_questions = [q for q in quiz.questions if q.is_active] if quiz.questions else []
    # Seed the canonical question bank only once. Admin changes/additions/deletions
    # must remain untouched on every later restart or redeploy.
    if active_questions:
        return
    for position, (level, prompt, choices, correct_index, explanation) in enumerate(QUESTIONS, start=1):
        question = Question(
            quiz_id=quiz.id,
            prompt=prompt,
            explanation=explanation,
            level=level,
            question_type="mcq",
            position=position,
            points=1,
            is_active=True,
        )
        db.add(question)
        db.flush()
        for choice_position, choice_text in enumerate(choices, start=1):
            db.add(
                Choice(
                    question_id=question.id,
                    text=choice_text,
                    is_correct=(choice_position - 1 == correct_index),
                    position=choice_position,
                )
            )


def run_seed():
    Base.metadata.create_all(bind=engine)
    settings = get_settings()
    if not settings.admin_email.strip() or not settings.admin_password.strip():
        raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding the owner account")
    db = SessionLocal()
    try:
        if engine.dialect.name == "postgresql":
            db.execute(text("SELECT pg_advisory_xact_lock(987654321)"))

        admin = db.scalar(select(User).where(User.email == settings.admin_email.lower()))
        if not admin:
            admin = User(
                first_name="Raed",
                last_name="Admin",
                email=settings.admin_email.lower(),
                phone="01000000000",
                password_hash=hash_password(settings.admin_password),
                role="owner",
                is_active=True,
                is_verified=True,
            )
            db.add(admin)

        # Authorized OTP-login allow-list requested for the platform.
        # Passwords and PINs are never stored here.
        authorized = {
            "raedzeid15@gmail.com": "owner",
            "m47662266@gmail.com": "admin",
        }
        for email, role in authorized.items():
            row = db.scalar(select(AuthorizedAdminEmail).where(AuthorizedAdminEmail.email == email))
            if not row:
                db.add(AuthorizedAdminEmail(email=email, role=role, is_active=True))
            # Existing allow-list entries are deliberately preserved so an owner can
            # change a role or disable an email without a later redeploy undoing it.

        defaults = {
            "teacher_name": "Mr. Raed Zeid",
            "teacher_name_ar": "مستر رائد زيد",
            "primary_phone": "01033246113",
            "secondary_phone": "01278833689",
            "whatsapp": "201033246113",
            "contact_email": "Raedzeid15@gmail.com",
            "center_hours": "كل أيام الأسبوع من 8 صباحًا إلى 8 مساءً",
            "center_address": "سنتر إبداع، شارع 20، العمارة المواجهة لمحول الكهرباء، الدور الثاني علوي",
            "center_landmark": "محول الكهرباء في منتصف شارع 20",
            "maintenance_mode": "false",
            "maintenance_message": "الموقع تحت الصيانة مؤقتًا. هنرجعلك قريب.",
            "stage_primary_enabled": "false",
            "stage_prep_enabled": "true",
            "stage_secondary_enabled": "true",
            "stage_university_enabled": "false",
            "stage_adults_enabled": "true",
            "youtube": "https://youtube.com/@rempire929",
        }
        for key, value in defaults.items():
            if not db.get(SiteSetting, key):
                db.add(SiteSetting(key=key, value=value))

        pages = [
            ("home", "الرئيسية", "/", 0, True),
            ("about", "عن المستر", "/#about", 10, True),
            ("quizzes", "الكويزات والامتحانات", "/quizzes", 20, True),
            ("moments", "الأجواء", "/#moments", 30, True),
            ("students", "طلابنا", "/#students", 40, True),
            ("honors", "تكريمات نعتز بها", "/#honors", 50, True),
            ("reviews", "آراء الطلاب", "/#reviews", 60, True),
            ("contact", "تواصل", "/#contact", 70, True),
        ]
        for slug, title, path, order, system in pages:
            page = db.scalar(select(SitePage).where(SitePage.slug == slug))
            if not page:
                db.add(SitePage(slug=slug, title=title, path=path, sort_order=order, is_visible=True, is_system=system))
            # Never overwrite an admin's title/order/visibility choices on redeploy.

        knowledge = [
            ("المواعيد", "مواعيد السنتر إيه؟", "السنتر شغال كل أيام الأسبوع من 8 صباحًا لحد 8 مساءً، والمواعيد شبه ثابتة.", "مواعيد ميعاد السنتر الساعة وقت"),
            ("الغياب", "لو غبت عن الحصة أعمل إيه؟", "تواصل معانا ونحدد لك ميعاد تاني لتعويض الحصة، وفيه حصة تعويض للغياب.", "غبت غياب تعويض حصة"),
            ("المجموعات", "إمتى تبدأ المجموعات الجديدة؟", "في بداية كل شهر بيكون فيه مجموعات جديدة، وفيه مجموعات صباحية ومسائية.", "مجموعات جديدة صباحية مسائية بداية شهر"),
            ("المكان", "عنوان السنتر فين؟", "سنتر إبداع في شارع 20، العمارة المواجهة لمحول الكهرباء، الدور الثاني علوي. أقرب علامة هي محول الكهرباء في منتصف شارع 20.", "عنوان مكان سنتر ابداع شارع 20 محول كهرباء"),
            ("التواصل", "رقم الواتساب إيه؟", "الواتساب الأساسي 01033246113، ورقم التواصل الإضافي 01278833689.", "واتساب رقم تواصل فون"),
            ("المراحل", "المستر بيدرس أنهي مراحل؟", "مستر رائد بيدرس إعدادي، ثانوي عام، ثانوي أزهري، وثانوي فني وتجاري وزراعي، وكمان فيه كورسات للكبار. الابتدائي غير متاح حاليًا.", "مراحل اعدادي ثانوي ازهر فني تجاري زراعي كبار ابتدائي"),
            ("الحجز", "أحجز إزاي؟", "تقدر تحجز أونلاين من الموقع، أو على واتساب، أو من مقر السنتر مع السكرتارية. يفضل تتواصل قبل أول حصة.", "حجز احجز اونلاين واتساب سكرتارية"),
            ("الأسعار", "الاشتراك بكام؟", "إعدادي 150 جنيه، ثانوي 200 جنيه، وفني وتجاري وزراعي 150 جنيه. الدفع شهري مقدم.", "سعر اسعار اشتراك دفع اعدادي ثانوي فني تجاري زراعي"),
            ("الخصومات", "فيه خصومات؟", "فيه خصومات للتوأم: الاتنين بسعر واحد، وكمان مراعاة لغير القادر وحافظ القرآن الكريم.", "خصم خصومات توأم غير قادر حافظ القرآن"),
            ("الدراسة", "نظام الشرح إيه؟", "الشرح على سبورة تفاعلية، وبعده تطبيق وحل من الكتاب وواجبات. فيه واجب بعد كل حصة وبيتم تصحيحه.", "شرح سبورة تفاعلية واجب حل كتاب"),
            ("الامتحانات", "فيه امتحانات ومراجعات؟", "بعد كل وحدة فيه مراجعة وامتحان، وفيه مراجعات قبل الامتحانات لغاية ليلة الامتحان، والطالب يقدر يشوف نتيجته.", "امتحان اختبارات مراجعة وحدة نتيجة"),
            ("المحتوى", "فيه ملازم أو PDF وفيديوهات؟", "أيوه، فيه ملازم وملفات PDF وفيديوهات شرح، وكمان متابعة أونلاين خارج وقت الحصة.", "ملازم pdf فيديو شرح متابعة اونلاين"),
            ("الكويزات", "الكويزات بتشتغل إزاي؟", "الكويزات متاحة للإعدادي والثانوي بكل أنواعه. لازم الطالب يسجل دخول، بعض الاختبارات لها وقت محدد والباقي مفتوح، والنتيجة تظهر فورًا، وإعادة المحاولة بتكون بحدود يحددها المستر.", "كويز اختبار تسجيل دخول وقت نتيجة اعادة محاولة"),
        ]
        for category, question, answer, keywords in knowledge:
            item = db.scalar(select(ChatKnowledge).where(ChatKnowledge.question == question))
            if not item:
                db.add(ChatKnowledge(category=category, question=question, answer=answer, keywords=keywords, is_active=True))
            # Existing admin-edited knowledge is intentionally preserved across restarts.

        db.flush()
        _seed_placement_quiz(db)
        db.commit()
        print("Seed completed: owner + authorized admins + settings + pages + assistant knowledge + placement quiz")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
