import smtplib
from email.message import EmailMessage
from .config import get_settings


def send_code_email(email: str, code: str, purpose: str) -> bool:
    settings = get_settings()
    if not settings.smtp_host or not settings.smtp_username or not settings.smtp_password:
        return False
    titles = {
        "password_reset": "كود استعادة كلمة السر - منصة مستر رائد",
        "admin_email_login": "كود دخول الإدارة - منصة مستر رائد",
        "admin_pin_reset": "كود تغيير PIN الإدارة - منصة مستر رائد",
        "admin_password_reset": "كود استعادة كلمة سر الإدارة - منصة مستر رائد",
    }
    intro = {
        "password_reset": "استخدم الكود التالي لاستعادة كلمة السر:",
        "admin_email_login": "استخدم الكود التالي لتسجيل الدخول إلى لوحة الإدارة:",
        "admin_pin_reset": "استخدم الكود التالي لتعيين PIN جديد للإدارة:",
        "admin_password_reset": "استخدم الكود التالي لتعيين كلمة سر جديدة للإدارة:",
    }
    msg = EmailMessage()
    msg["Subject"] = titles.get(purpose, "كود التحقق - منصة مستر رائد")
    msg["From"] = settings.smtp_from or settings.smtp_username
    msg["To"] = email
    msg.set_content(
        f"{intro.get(purpose, 'كود التحقق الخاص بك:')}\n\n{code}\n\n"
        "الكود صالح لمدة 10 دقائق ويُستخدم مرة واحدة فقط.\n"
        "لو إنت ما طلبتش الكود، تجاهل الرسالة."
    )
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(msg)
    return True
