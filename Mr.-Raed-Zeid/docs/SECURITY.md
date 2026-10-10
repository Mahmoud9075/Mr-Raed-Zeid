# الأمان

لا يوجد موقع يمكن وصفه بأنه "غير قابل للاختراق". المشروع يطبق طبقات حماية عملية، ويحتاج تشغيلًا صحيحًا على HTTPS وتحديثات ونسخ احتياطية مستمرة.

## مطبق في الكود
- كلمات المرور لا تُخزن كنص؛ يتم اشتقاق hash باستخدام `scrypt` + salt عشوائي.
- Access JWT قصير العمر + Refresh Token منفصل، ويتم إرسالهما للويب في **HttpOnly cookies**؛ والـRefresh Token محفوظ في قاعدة البيانات كـSHA-256 hash فقط.
- تدوير Refresh Token عند التجديد وإمكانية إلغائه.
- قفل مؤقت بعد 5 محاولات تسجيل دخول فاشلة.
- Rate limiting لمسارات الدخول وباقي الـAPI.
- Role-Based Access Control للأدمن.
- ORM parameterization ضد SQL injection.
- React escaping يقلل مخاطر XSS في النصوص المعروضة.
- CORS allowlist بدل فتح الـAPI لكل المصادر، مع credentials للمصادر المصرح بها فقط.
- Security headers: nosniff, DENY frames, Referrer Policy, Permissions Policy, HSTS في الإنتاج.
- التقييمات لا تنشر مباشرة؛ تبدأ Pending وتحتاج اعتماد الأدمن.
- علاقات قاعدة البيانات تستخدم قيودًا تمنع حذف بيانات مرتبطة بطريق الخطأ في المناطق الحساسة.
- Audit Log لأحداث الحسابات الأساسية.
- `.env` مستبعد من Git.

## قبل الإطلاق الحقيقي
1. غيّر `JWT_SECRET`, `POSTGRES_PASSWORD`, `ADMIN_PASSWORD` لقيم قوية وعشوائية.
2. فعّل HTTPS بدومين حقيقي.
3. لا ترفع `.env` إلى GitHub.
4. استخدم نسخًا احتياطية يومية واختبر الاسترجاع شهريًا.
5. استخدم خدمة بريد/OTP للتحقق من الحسابات وإعادة تعيين كلمة المرور.
6. ضع Redis rate limiter إذا شغلت أكثر من نسخة Backend.
7. فعّل مراقبة الأخطاء والـuptime والتنبيهات.
8. نفّذ فحص dependencies وSAST في CI قبل كل إصدار.
