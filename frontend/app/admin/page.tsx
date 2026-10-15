'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Stats = {
  users:number; students:number; quizzes:number; attempts:number; submitted_attempts:number;
  average_score:number|null; manual_pending:number; pending_reviews:number; new_messages:number; admins:number;
};
type Settings = Record<string,string>;
type PageItem = {id:number;slug:string;title:string;path:string;is_visible:boolean;sort_order:number;is_system:boolean;content_json:string};
type Quiz = {id:number;slug:string;title_ar:string;stage?:string;education_type?:string;grade?:string;published:boolean;questions:number;max_attempts:number;duration_minutes:number;is_placement:boolean;randomize_questions:boolean};
type AdminChoice = {id:number;text:string;position:number;is_correct:boolean};
type AdminQuestion = {id:number;prompt:string;explanation:string;level:string;question_type:'mcq'|'true_false'|'short'|'essay';expected_answer?:string|null;position:number;points:number;is_active:boolean;choices:AdminChoice[]};
type QuizDetails = {id:number;slug:string;title_ar:string;is_placement:boolean;randomize_questions:boolean;question_pool_count:number;questions_per_attempt:number;questions:AdminQuestion[]};
type User = {id:number;name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;role:string;active:boolean;profile_image?:string};
type UserDetails = {user:{id:number;name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;school_name?:string;active:boolean};attempts:{id:number;quiz:string;score:number|null;level_result?:string;needs_manual_review:boolean;submitted_at?:string}[]};
type AdminUser = {id:number;name:string;email:string;role:string;active:boolean};
type Review = {id:number;name:string;stage:string;rating:number;body:string;status:string};
type Message = {id:number;name:string;phone:string;message:string;status:string};
type Knowledge = {id:number;category:string;question:string;answer:string;keywords:string;active:boolean};
type AdminNote = {id:number;title:string;body:string;stage?:string;education_type?:string;grade?:string;user_id?:number;active:boolean};
type ResultItem = {id:number;student_id:number;student_name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;quiz_id:number;quiz:string;score:number|null;level_result?:string;needs_manual_review:boolean;submitted_at?:string};
type ResultPage = {items:ResultItem[];total:number;page:number;page_size:number};
type ResultDetail = ResultItem & {answers:{answer_id:number;question_id:number;question:string;question_type:string;points:number;choice?:string;text_answer?:string;is_correct:boolean|null;awarded_points:number|null}[]};
type AuditItem = {id:number;actor:number|null;action:string;entity:string;entity_id?:string;metadata:string;created_at:string};

const stages = ['', 'إعدادي', 'ثانوي', 'كورسات للكبار'];
const types:Record<string,string[]> = {
  'إعدادي':['','عام','أزهري'],
  'ثانوي':['','عام','أزهري','فني صناعي','تجاري','زراعي'],
  'كورسات للكبار':['','كورسات عامة']
};
const grades:Record<string,string[]> = {
  'إعدادي':['','الصف الأول الإعدادي','الصف الثاني الإعدادي','الصف الثالث الإعدادي'],
  'ثانوي':['','الصف الأول الثانوي','الصف الثاني الثانوي','الصف الثالث الثانوي'],
  'كورسات للكبار':['','كورسات للكبار']
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'تعذر تنفيذ العملية. حاول مرة أخرى.';
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const international = digits.startsWith('0') ? `20${digits.slice(1)}` : digits;
  return `https://wa.me/${international}`;
}

export default function Admin() {
  const router = useRouter();
  const [tab,setTab] = useState('overview');
  const [stats,setStats] = useState<Stats|null>(null);
  const [settings,setSettings] = useState<Settings>({});
  const [pages,setPages] = useState<PageItem[]>([]);
  const [quizzes,setQuizzes] = useState<Quiz[]>([]);
  const [users,setUsers] = useState<User[]>([]);
  const [admins,setAdmins] = useState<AdminUser[]>([]);
  const [reviews,setReviews] = useState<Review[]>([]);
  const [messages,setMessages] = useState<Message[]>([]);
  const [knowledge,setKnowledge] = useState<Knowledge[]>([]);
  const [adminNotes,setAdminNotes] = useState<AdminNote[]>([]);
  const [results,setResults] = useState<ResultPage>({items:[],total:0,page:1,page_size:50});
  const [resultDetail,setResultDetail] = useState<ResultDetail|null>(null);
  const [auditItems,setAuditItems] = useState<AuditItem[]>([]);
  const [userDetail,setUserDetail] = useState<UserDetails|null>(null);
  const [meRole,setMeRole] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [loading,setLoading] = useState(true);
  const [actionBusy,setActionBusy] = useState(false);
  const [inviteLink,setInviteLink] = useState('');
  const [noteStage,setNoteStage] = useState('');
  const [selectedQuiz,setSelectedQuiz] = useState<number|''>('');
  const [quizDetails,setQuizDetails] = useState<QuizDetails|null>(null);
  const [editingQuestion,setEditingQuestion] = useState<AdminQuestion|null>(null);
  const [editQType,setEditQType] = useState('mcq');
  const [qType,setQType] = useState('mcq');
  const [quizStage,setQuizStage] = useState('');
  const [userSearch,setUserSearch] = useState('');
  const [resultSearch,setResultSearch] = useState('');
  const [resultQuiz,setResultQuiz] = useState('');
  const [resultStage,setResultStage] = useState('');
  const [manualOnly,setManualOnly] = useState(false);

  async function loadCore() {
    setLoading(true); setError('');
    try {
      const me = await api<{role:string}>('/auth/me');
      if (!['admin','owner'].includes(me.role)) { router.replace('/student'); return; }
      setMeRole(me.role);
      const [s,st,p,q,a] = await Promise.all([
        api<Stats>('/admin/dashboard'), api<Settings>('/admin/site-settings'), api<PageItem[]>('/admin/pages'),
        api<Quiz[]>('/admin/quizzes'), api<AdminUser[]>('/admin/admins')
      ]);
      setStats(s); setSettings(st); setPages(p); setQuizzes(q); setAdmins(a);
    } catch (e) {
      setError(errorText(e));
      router.replace('/admin/login');
    } finally { setLoading(false); }
  }

  useEffect(() => { loadCore(); }, []);

  async function loadTab(target = tab) {
    setError('');
    try {
      if (target === 'users') {
        const query = userSearch.trim() ? `?search=${encodeURIComponent(userSearch.trim())}` : '';
        setUsers(await api<User[]>(`/admin/users${query}`));
      } else if (target === 'results') {
        const params = new URLSearchParams();
        if (resultSearch.trim()) params.set('search', resultSearch.trim());
        if (resultQuiz) params.set('quiz_id', resultQuiz);
        if (resultStage) params.set('stage', resultStage);
        if (manualOnly) params.set('manual_only','true');
        params.set('page_size','100');
        setResults(await api<ResultPage>(`/admin/results?${params}`));
      } else if (target === 'notifications') {
        setAdminNotes(await api<AdminNote[]>('/admin/notifications'));
      } else if (target === 'assistant') {
        setKnowledge(await api<Knowledge[]>('/admin/knowledge'));
      } else if (target === 'reviews') {
        const [r,m] = await Promise.all([api<Review[]>('/admin/reviews'),api<Message[]>('/admin/messages')]);
        setReviews(r); setMessages(m);
      } else if (target === 'audit' && meRole === 'owner') {
        setAuditItems(await api<AuditItem[]>('/admin/audit?page_size=150'));
      }
    } catch (e) { setError(errorText(e)); }
  }

  useEffect(() => {
    if (!meRole) return;
    loadTab(tab);
  // Filters are applied explicitly with their search buttons.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab,meRole]);

  async function run(task:()=>Promise<void>, success?:string) {
    setActionBusy(true); setError('');
    try { await task(); if (success) setNotice(success); }
    catch (e) { setError(errorText(e)); }
    finally { setActionBusy(false); }
  }

  async function saveSettings(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    const payload = {
      maintenance_message:f.get('maintenance_message'), primary_phone:f.get('primary_phone'),
      secondary_phone:f.get('secondary_phone'), whatsapp:f.get('whatsapp'), contact_email:f.get('contact_email'),
      center_hours:f.get('center_hours'), center_address:f.get('center_address'), stage_primary_enabled:false,
      stage_prep_enabled:!!f.get('stage_prep_enabled'), stage_secondary_enabled:!!f.get('stage_secondary_enabled'),
      stage_university_enabled:false, stage_adults_enabled:!!f.get('stage_adults_enabled')
    };
    await run(async()=>{ await api('/admin/site-settings',{method:'PUT',body:JSON.stringify(payload)}); await loadCore(); },'تم حفظ إعدادات الموقع بنجاح.');
  }

  async function toggleMaintenance() {
    const next = settings.maintenance_mode !== 'true';
    if (!confirm(next?'متأكد إنك عايز تدخل الموقع وضع الصيانة؟':'متأكد إنك عايز تشغل الموقع للزوار؟')) return;
    await run(async()=>{ await api('/admin/site-settings',{method:'PUT',body:JSON.stringify({maintenance_mode:next})}); await loadCore(); }, next?'تم تشغيل وضع الصيانة.':'تم تشغيل الموقع.');
  }

  async function togglePage(p:PageItem) {
    if (!confirm(`${p.is_visible?'إخفاء':'إظهار'} صفحة ${p.title}؟`)) return;
    await run(async()=>{ await api(`/admin/pages/${p.id}/visibility?visible=${!p.is_visible}`,{method:'PATCH'}); await loadCore(); });
  }

  async function archivePage(p:PageItem) {
    if (!confirm(`تأكيد أرشفة صفحة ${p.title}؟`)) return;
    await run(async()=>{ await api(`/admin/pages/${p.id}`,{method:'DELETE'}); await loadCore(); },'تمت أرشفة الصفحة.');
  }

  async function addPage(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    const slug=String(f.get('slug')||'').trim(); const title=String(f.get('title')||'').trim(); const body=String(f.get('body')||'');
    await run(async()=>{ await api('/admin/pages',{method:'POST',body:JSON.stringify({slug,title,path:`/p/${slug}`,is_visible:true,sort_order:90,content_json:JSON.stringify({body})})}); form.reset(); await loadCore(); },'تم إنشاء الصفحة.');
  }

  async function addQuiz(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    const payload={slug:f.get('slug'),title_ar:f.get('title_ar'),title_en:'',description_ar:f.get('description_ar'),stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,duration_minutes:Number(f.get('duration_minutes')||30),passing_score:60,max_attempts:Number(f.get('max_attempts')||2),randomize_questions:!!f.get('randomize_questions'),show_result_immediately:true,is_published:false,is_placement:false};
    await run(async()=>{ const r=await api<{id:number}>('/admin/quizzes',{method:'POST',body:JSON.stringify(payload)}); setSelectedQuiz(r.id); form.reset(); setQuizStage(''); await loadCore(); },'تم إنشاء الاختبار كمسودة. أضف الأسئلة ثم انشره.');
  }

  async function loadQuizDetails(quizId:number|'') {
    setSelectedQuiz(quizId);
    setEditingQuestion(null);
    if (!quizId) { setQuizDetails(null); return; }
    await run(async()=>setQuizDetails(await api<QuizDetails>(`/admin/quizzes/${quizId}`)));
  }

  async function addQuestion(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!selectedQuiz)return; const form=e.currentTarget; const f=new FormData(form);
    const choices=qType==='mcq'||qType==='true_false'?[1,2,3,4].map(i=>[String(f.get(`choice${i}`)||'').trim(),Number(f.get('correct'))===i] as [string,boolean]).filter(x=>x[0]):[];
    await run(async()=>{ await api(`/admin/quizzes/${selectedQuiz}/questions`,{method:'POST',body:JSON.stringify({prompt:f.get('prompt'),explanation:f.get('explanation')||'',level:f.get('level')||'A1',question_type:qType,expected_answer:qType==='short'?f.get('expected_answer'):null,position:Number(f.get('position')||1),points:Number(f.get('points')||1),choices})}); form.reset(); await loadCore(); await loadQuizDetails(selectedQuiz); },'تمت إضافة السؤال وحفظه.');
  }

  async function saveQuestionEdit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); if(!editingQuestion||!selectedQuiz)return; const f=new FormData(e.currentTarget);
    const type=String(f.get('question_type')||'mcq');
    const choices=type==='mcq'||type==='true_false'?[1,2,3,4].map(i=>[String(f.get(`edit_choice${i}`)||'').trim(),Number(f.get('edit_correct'))===i] as [string,boolean]).filter(x=>x[0]):[];
    const payload={prompt:f.get('prompt'),explanation:f.get('explanation')||'',level:f.get('level')||'A1',question_type:type,expected_answer:type==='short'?f.get('expected_answer'):null,position:Number(f.get('position')||editingQuestion.position),points:Number(f.get('points')||1),choices};
    await run(async()=>{ await api(`/admin/questions/${editingQuestion.id}`,{method:'PUT',body:JSON.stringify(payload)}); setEditingQuestion(null); await loadCore(); await loadQuizDetails(selectedQuiz); },'تم تعديل السؤال وحفظه.');
  }

  async function deleteQuestion(question:AdminQuestion) {
    if(!selectedQuiz||!confirm(`حذف السؤال رقم ${question.position} من بنك الأسئلة؟ النتائج القديمة لن تتأثر.`))return;
    await run(async()=>{ await api(`/admin/questions/${question.id}`,{method:'DELETE'}); if(editingQuestion?.id===question.id)setEditingQuestion(null); await loadCore(); await loadQuizDetails(selectedQuiz); },'تم حذف السؤال من بنك الأسئلة.');
  }

  async function togglePublish(q:Quiz) {
    if(!confirm(`${q.published?'إلغاء نشر':'نشر'} اختبار ${q.title_ar}؟`))return;
    await run(async()=>{ await api(`/admin/quizzes/${q.id}/publish?published=${!q.published}`,{method:'PATCH'}); await loadCore(); },q.published?'تم إلغاء النشر.':'تم نشر الاختبار.');
  }

  async function archiveQuiz(q:Quiz) {
    if(!confirm(`تأكيد أرشفة اختبار ${q.title_ar}؟ النتائج القديمة ستظل محفوظة.`))return;
    await run(async()=>{ await api(`/admin/quizzes/${q.id}`,{method:'DELETE'}); await loadCore(); },'تمت أرشفة الاختبار.');
  }

  async function toggleUser(u:User) {
    if(!confirm(`${u.active?'إيقاف':'تفعيل'} حساب ${u.name}؟`))return;
    await run(async()=>{ await api(`/admin/users/${u.id}/active?active=${!u.active}`,{method:'PATCH'}); await loadTab('users'); },`تم ${u.active?'إيقاف':'تفعيل'} الحساب.`);
  }

  async function openUser(userId:number) {
    await run(async()=>setUserDetail(await api<UserDetails>(`/admin/users/${userId}`)));
  }

  async function inviteAdmin(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{ const r=await api<{token:string}>('/admin/admins/invite',{method:'POST',body:JSON.stringify({email:f.get('email'),role:'admin'})}); setInviteLink(`${location.origin}/admin/accept?token=${encodeURIComponent(r.token)}`); await loadCore(); },'تم إنشاء دعوة الأدمن. انسخ الرابط وأرسله للشخص المطلوب.');
  }

  async function moderate(id:number,status:string) {
    if(!confirm('تأكيد الإجراء على التقييم؟'))return;
    await run(async()=>{ await api(`/admin/reviews/${id}?status=${status}`,{method:'PATCH'}); await loadTab('reviews'); });
  }

  async function updateMessage(id:number,status:'new'|'followed_up'|'closed') {
    await run(async()=>{ await api(`/admin/messages/${id}`,{method:'PATCH',body:JSON.stringify({status})}); await loadTab('reviews'); },'تم تحديث حالة الرسالة.');
  }

  async function addNotification(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    await run(async()=>{ await api('/admin/notifications',{method:'POST',body:JSON.stringify({title:f.get('title'),body:f.get('body'),stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,user_id:null})}); form.reset(); setNoteStage(''); await loadTab('notifications'); },'تم إرسال الإشعار.');
  }

  async function addKnowledge(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    await run(async()=>{ await api('/admin/knowledge',{method:'POST',body:JSON.stringify({category:f.get('category'),question:f.get('question'),answer:f.get('answer'),keywords:f.get('keywords')})}); form.reset(); await loadTab('assistant'); },'تمت إضافة المعلومة للمساعد.');
  }

  async function toggleKnowledge(k:Knowledge) {
    await run(async()=>{ await api(`/admin/knowledge/${k.id}/active?active=${!k.active}`,{method:'PATCH'}); await loadTab('assistant'); },k.active?'تم تعطيل المعلومة.':'تم تفعيل المعلومة.');
  }

  async function editKnowledge(k:Knowledge) {
    const answer=prompt('عدّل الإجابة المعتمدة:',k.answer); if(answer===null)return;
    await run(async()=>{ await api(`/admin/knowledge/${k.id}`,{method:'PUT',body:JSON.stringify({answer})}); await loadTab('assistant'); },'تم تحديث إجابة المساعد.');
  }

  async function deleteKnowledge(k:Knowledge) {
    if(!confirm(`حذف المعلومة: ${k.question}؟`))return;
    await run(async()=>{ await api(`/admin/knowledge/${k.id}`,{method:'DELETE'}); await loadTab('assistant'); },'تم حذف المعلومة.');
  }

  async function openResult(id:number) {
    await run(async()=>setResultDetail(await api<ResultDetail>(`/admin/results/${id}`)));
  }

  async function gradeEssay(answerId:number, max:number) {
    const raw=prompt(`اكتب الدرجة من 0 إلى ${max}:`); if(raw===null)return;
    const points=Number(raw); if(!Number.isFinite(points)||points<0||points>max){setError(`الدرجة لازم تكون من 0 إلى ${max}`);return;}
    await run(async()=>{ if(!resultDetail)return; await api(`/admin/results/answers/${answerId}/grade`,{method:'PATCH',body:JSON.stringify({awarded_points:points})}); await openResult(resultDetail.id); await loadTab('results'); await loadCore(); },'تم حفظ التصحيح وتحديث الدرجة.');
  }

  const selected = useMemo(()=>quizzes.find(q=>q.id===selectedQuiz),[quizzes,selectedQuiz]);
  const tabs = [
    ['overview','الرئيسية'],['results','النتائج والتقارير'],['quizzes','الاختبارات'],['users','الطلاب'],
    ['notifications','الإشعارات'],['assistant','المساعد'],['reviews','التقييمات والرسائل'],['site','الموقع'],
    ['pages','الصفحات'],['admins','الأدمنز'],...(meRole==='owner'?[['audit','سجل النشاط']]:[])
  ];

  if (loading || !meRole) return <main className="admin-login-screen"><section className="admin-login-card admin-loading-card"><div className="admin-login-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/></div><span className="admin-login-kicker">Secure Administration</span><h1>جاري التحقق</h1><p>بنراجع صلاحية حساب الإدارة...</p></section></main>;

  return <main className="section admin-page">
    <div className="admin-console-head"><a href="/admin" className="admin-console-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/><span><b>لوحة إدارة مستر رائد</b><small>Secure Control Center</small></span></a><button className="btn" onClick={()=>api('/auth/logout',{method:'POST',body:JSON.stringify({})}).finally(()=>router.replace('/admin/login'))}>تسجيل الخروج</button></div>
    <div className="container admin-shell">
      <aside className="card admin-nav"><div><span className="eyebrow">Admin</span><h3>لوحة التحكم</h3></div>{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</aside>
      <section className="admin-content">
        {error&&<div className="notice error">{error}<button className="notice-close" onClick={()=>setError('')}>×</button></div>}
        {notice&&<div className="notice success">{notice}<button onClick={()=>setNotice('')}>×</button></div>}

        {tab==='overview'&&<><div className="admin-title"><div><span className="eyebrow">نظرة عامة</span><h1 className="section-title">كل حاجة مهمة في مكان واحد</h1></div><button className="btn" onClick={()=>loadCore()}>تحديث البيانات</button></div><div className="admin-grid"><div className="card stat"><span>الطلاب</span><b>{stats?.students??0}</b></div><div className="card stat"><span>النتائج المسجلة</span><b>{stats?.submitted_attempts??0}</b></div><div className="card stat"><span>متوسط الدرجات</span><b>{stats?.average_score==null?'—':`${stats.average_score}%`}</b></div><div className="card stat"><span>في انتظار التصحيح</span><b>{stats?.manual_pending??0}</b></div><div className="card stat"><span>الاختبارات</span><b>{stats?.quizzes??0}</b></div><div className="card stat"><span>رسائل جديدة</span><b>{stats?.new_messages??0}</b></div><div className="card stat"><span>تقييمات منتظرة</span><b>{stats?.pending_reviews??0}</b></div><div className="card stat"><span>الأدمنز</span><b>{stats?.admins??0}</b></div></div><div className="card admin-panel"><h2>اختصارات سريعة</h2><div className="admin-grid"><button className="action-card" onClick={()=>setTab('results')}><b>النتائج والتقارير</b><span>درجات · Excel · طباعة · تصحيح مقالي</span></button><button className="action-card" onClick={()=>setTab('quizzes')}><b>الاختبارات</b><span>إنشاء ونشر وإدارة الأسئلة</span></button><button className="action-card" onClick={()=>setTab('users')}><b>الطلاب</b><span>بحث وملف كامل لكل طالب</span></button><button className="action-card" onClick={()=>setTab('reviews')}><b>المتابعة</b><span>التقييمات ورسائل التواصل</span></button></div></div></>}

        {tab==='results'&&<><div className="admin-title"><div><span className="eyebrow">Results Center</span><h1 className="section-title">النتائج والتقارير</h1><p className="section-subtitle">بحث، تصحيح المقالي، Excel وطباعة PDF من المتصفح.</p></div><div className="row-actions"><a className="btn btn-primary" href="/api/v1/admin/results-export.xlsx">تحميل Excel</a><a className="btn" href="/admin/results/print" target="_blank">طباعة / PDF</a></div></div><form className="card admin-panel" onSubmit={e=>{e.preventDefault();loadTab('results')}}><div className="form-grid"><div className="field"><label>بحث بالطالب / الهاتف / الاختبار</label><input className="input" value={resultSearch} onChange={e=>setResultSearch(e.target.value)}/></div><div className="field"><label>الاختبار</label><select className="input" value={resultQuiz} onChange={e=>setResultQuiz(e.target.value)}><option value="">كل الاختبارات</option>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title_ar}</option>)}</select></div><div className="field"><label>المرحلة</label><select className="input" value={resultStage} onChange={e=>setResultStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'كل المراحل'}</option>)}</select></div><label className="checkbox-row"><input type="checkbox" checked={manualOnly} onChange={e=>setManualOnly(e.target.checked)}/> في انتظار التصحيح فقط</label></div><button className="btn btn-dark" disabled={actionBusy}>تطبيق الفلاتر</button></form><div className="card admin-panel"><div className="panel-head"><h2>النتائج ({results.total})</h2></div><div className="mobile-list">{results.items.length===0?<p>لا توجد نتائج مطابقة.</p>:results.items.map(r=><div className="admin-list-item" key={r.id}><div><b>{r.student_name} — {r.score??0}%</b><span>{r.quiz} · {[r.stage,r.education_type,r.grade].filter(Boolean).join(' · ')||'بدون تصنيف'}{r.level_result?` · مستوى ${r.level_result}`:''}</span>{r.needs_manual_review&&<span className="status-chip off">يحتاج تصحيح مقالي</span>}</div><div className="row-actions"><button className="btn" onClick={()=>openResult(r.id)}>عرض وتصحيح</button></div></div>)}</div></div>{resultDetail&&<div className="card admin-panel result-detail-panel"><div className="panel-head"><div><span className="eyebrow">تفاصيل النتيجة</span><h2>{resultDetail.student_name} — {resultDetail.score??0}%</h2><p>{resultDetail.quiz}</p></div><button className="btn" onClick={()=>setResultDetail(null)}>إغلاق</button></div><div className="mobile-list">{resultDetail.answers.map(a=><div className="admin-list-item stacked" key={a.answer_id}><div><b>{a.question}</b><span>الدرجة: {a.awarded_points??'بانتظار التصحيح'} / {a.points}</span><p>{a.choice||a.text_answer||'بدون إجابة'}</p></div>{a.question_type==='essay'&&a.text_answer&&<button className="btn btn-primary" onClick={()=>gradeEssay(a.answer_id,a.points)}>تصحيح</button>}</div>)}</div></div>}</>}

        {tab==='users'&&<><form className="card admin-panel" onSubmit={e=>{e.preventDefault();loadTab('users')}}><div className="panel-head"><div><h2>حسابات الطلاب</h2><p>ابحث بالاسم أو الهاتف أو البريد.</p></div><div className="row-actions"><input className="input" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="بحث..."/><button className="btn btn-dark">بحث</button></div></div></form><div className="card admin-panel"><div className="mobile-list">{users.filter(u=>u.role==='student').map(u=><div className="admin-list-item" key={u.id}><div><b>{u.name}</b><span>{u.phone} · {[u.stage,u.education_type,u.grade].filter(Boolean).join(' · ')||'بدون مرحلة'}</span></div><div className="row-actions"><button className="btn" onClick={()=>openUser(u.id)}>ملف الطالب</button><button className={`btn ${u.active?'btn-danger':'btn-primary'}`} onClick={()=>toggleUser(u)}>{u.active?'إيقاف':'تفعيل'}</button></div></div>)}</div></div>{userDetail&&<div className="card admin-panel"><div className="panel-head"><div><h2>{userDetail.user.name}</h2><p>{userDetail.user.phone} · {userDetail.user.email}</p></div><button className="btn" onClick={()=>setUserDetail(null)}>إغلاق</button></div><p>{[userDetail.user.stage,userDetail.user.education_type,userDetail.user.grade,userDetail.user.school_name].filter(Boolean).join(' · ')}</p><h3>الاختبارات والدرجات</h3><div className="mobile-list">{userDetail.attempts.length===0?<p>لا توجد محاولات.</p>:userDetail.attempts.map(a=><div className="admin-list-item" key={a.id}><div><b>{a.quiz}</b><span>{a.submitted_at?`${a.score??0}%${a.level_result?` · ${a.level_result}`:''}`:'محاولة لم تُسلّم بعد'}</span></div>{a.submitted_at&&<button className="btn" onClick={()=>{setTab('results');openResult(a.id)}}>عرض</button>}</div>)}</div></div>}</>}

        {tab==='quizzes'&&<><form className="card admin-panel" onSubmit={addQuiz}><span className="eyebrow">1. إنشاء</span><h2>اختبار جديد</h2><div className="form-grid"><div className="field"><label>اسم الاختبار</label><input className="input" name="title_ar" required/></div><div className="field"><label>Slug</label><input className="input" name="slug" pattern="[a-z0-9-]+" required/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={quizStage} onChange={e=>setQuizStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'اختبار عام'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type">{(types[quizStage]||['']).map(x=><option key={x} value={x}>{x||'الكل'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade">{(grades[quizStage]||['']).map(x=><option key={x} value={x}>{x||'كل الصفوف'}</option>)}</select></div><div className="field"><label>المدة بالدقائق</label><input className="input" type="number" name="duration_minutes" defaultValue="30" min="1" max="240"/></div><div className="field"><label>عدد المحاولات</label><input className="input" type="number" name="max_attempts" defaultValue="2" min="1" max="20"/></div><div className="field"><label>وصف قصير</label><input className="input" name="description_ar"/></div><label className="checkbox-row"><input type="checkbox" name="randomize_questions"/> ترتيب الأسئلة عشوائي</label></div><button className="btn btn-dark" disabled={actionBusy}>حفظ كمسودة</button></form><div className="card admin-panel"><span className="eyebrow">2. بنك الأسئلة</span><h2>إضافة وإدارة الأسئلة</h2><div className="field"><label>اختر الاختبار</label><select className="input" value={selectedQuiz} onChange={e=>loadQuizDetails(Number(e.target.value)||'')}><option value="">اختر اختبار</option>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title_ar} ({q.questions} سؤال في البنك)</option>)}</select></div>{selected&&<>{quizDetails?.is_placement&&<div className="notice success" style={{marginTop:14}}>اختبار تحديد المستوى عشوائي تلقائيًا: كل محاولة تعرض {quizDetails.questions_per_attempt} سؤالًا من بنك فيه {quizDetails.question_pool_count} سؤال. لو زوّدت أسئلة للبنك، الطالب يفضل ياخد 50 سؤال عشوائي فقط.</div>}<form onSubmit={addQuestion} style={{marginTop:16}}><div className="form-grid"><div className="field field-span"><label>السؤال</label><textarea className="input" name="prompt" required/></div><div className="field"><label>نوع السؤال</label><select className="input" value={qType} onChange={e=>setQType(e.target.value)}><option value="mcq">اختيار من متعدد</option><option value="true_false">صح / خطأ</option><option value="short">إجابة قصيرة</option><option value="essay">مقالي</option></select></div><div className="field"><label>الترتيب</label><input className="input" name="position" type="number" defaultValue={quizDetails?Math.max(0,...quizDetails.questions.map(q=>q.position))+1:selected.questions+1} min="1"/></div><div className="field"><label>الدرجة</label><input className="input" name="points" type="number" defaultValue="1" min="1" max="20"/></div><div className="field"><label>المستوى</label><select className="input" name="level"><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option></select></div>{(qType==='mcq'||qType==='true_false')&&<>{[1,2,3,4].map(i=><div className="field" key={i}><label>اختيار {i}</label><input className="input" name={`choice${i}`} required={i<=2}/></div>)}<div className="field"><label>رقم الإجابة الصحيحة</label><select className="input" name="correct"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div></>}{qType==='short'&&<div className="field"><label>الإجابة النموذجية</label><input className="input" name="expected_answer" required/></div>}<div className="field field-span"><label>شرح اختياري</label><textarea className="input" name="explanation"/></div></div><button className="btn btn-primary" disabled={actionBusy}>إضافة السؤال</button></form>{quizDetails&&<div style={{marginTop:24}}><div className="panel-head"><div><h3>الأسئلة الحالية</h3><p>{quizDetails.question_pool_count} سؤال في بنك الأسئلة</p></div></div><div className="mobile-list" style={{maxHeight:560,overflowY:'auto'}}>{quizDetails.questions.map(question=><div className="admin-list-item stacked" key={question.id}><div><b>#{question.position} · {question.level} · {question.prompt}</b><span>{question.question_type==='mcq'?'اختيار من متعدد':question.question_type==='true_false'?'صح / خطأ':question.question_type==='short'?'إجابة قصيرة':'مقالي'} · {question.points} درجة</span>{question.choices.length>0&&<p>{question.choices.map(c=>`${c.is_correct?'✓ ':''}${c.text}`).join(' — ')}</p>}</div><div className="row-actions"><button className="btn" onClick={()=>{setEditingQuestion(question);setEditQType(question.question_type)}}>تعديل</button><button className="btn btn-danger" onClick={()=>deleteQuestion(question)}>حذف</button></div></div>)}</div></div>}{editingQuestion&&<form className="card" style={{marginTop:20,padding:18}} onSubmit={saveQuestionEdit}><div className="panel-head"><div><span className="eyebrow">تعديل السؤال #{editingQuestion.position}</span><h3>عدّل البيانات ثم احفظ</h3></div><button type="button" className="btn" onClick={()=>setEditingQuestion(null)}>إلغاء</button></div><div className="form-grid"><div className="field field-span"><label>السؤال</label><textarea className="input" name="prompt" defaultValue={editingQuestion.prompt} required/></div><div className="field"><label>نوع السؤال</label><select className="input" name="question_type" value={editQType} onChange={e=>setEditQType(e.target.value)}><option value="mcq">اختيار من متعدد</option><option value="true_false">صح / خطأ</option><option value="short">إجابة قصيرة</option><option value="essay">مقالي</option></select></div><div className="field"><label>الترتيب</label><input className="input" name="position" type="number" defaultValue={editingQuestion.position} min="1"/></div><div className="field"><label>الدرجة</label><input className="input" name="points" type="number" defaultValue={editingQuestion.points} min="1" max="20"/></div><div className="field"><label>المستوى</label><select className="input" name="level" defaultValue={editingQuestion.level}><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option></select></div>{(editQType==='mcq'||editQType==='true_false')&&<>{[1,2,3,4].map(i=><div className="field" key={i}><label>اختيار {i}</label><input className="input" name={`edit_choice${i}`} defaultValue={editingQuestion.choices[i-1]?.text||''} required={i<=2}/></div>)}<div className="field"><label>رقم الإجابة الصحيحة</label><select className="input" name="edit_correct" defaultValue={String(Math.max(1,editingQuestion.choices.findIndex(c=>c.is_correct)+1))}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div></>}{editQType==='short'&&<div className="field"><label>الإجابة النموذجية</label><input className="input" name="expected_answer" defaultValue={editingQuestion.expected_answer||''} required/></div>}<div className="field field-span"><label>شرح اختياري</label><textarea className="input" name="explanation" defaultValue={editingQuestion.explanation}/></div></div><button className="btn btn-dark" disabled={actionBusy}>حفظ التعديل</button></form>}</>}</div><div className="card admin-panel"><h2>الاختبارات الحالية</h2><div className="mobile-list">{quizzes.map(q=><div className="admin-list-item" key={q.id}><div><b>{q.title_ar}{q.is_placement?' · تحديد مستوى':''}</b><span>{[q.stage,q.education_type,q.grade].filter(Boolean).join(' · ')||'عام'} · {q.questions} سؤال في البنك · {q.duration_minutes} دقيقة{q.is_placement?' · 50 سؤال عشوائي لكل محاولة':q.randomize_questions?' · عشوائي':''}</span></div><div className="row-actions"><button className="btn" onClick={()=>loadQuizDetails(q.id)}>إدارة الأسئلة</button><button className="btn btn-primary" onClick={()=>togglePublish(q)}>{q.published?'إلغاء النشر':'نشر'}</button><button className="btn btn-danger" onClick={()=>archiveQuiz(q)}>أرشفة</button></div></div>)}</div></div></>}

        {tab==='notifications'&&<><form className="card admin-panel" onSubmit={addNotification}><span className="eyebrow">الإشعارات</span><h2>إرسال إشعار للطلاب</h2><div className="form-grid"><div className="field"><label>العنوان</label><input className="input" name="title" required/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={noteStage} onChange={e=>setNoteStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'كل المراحل'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type">{(types[noteStage]||['']).map(x=><option key={x} value={x}>{x||'الكل'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade">{(grades[noteStage]||['']).map(x=><option key={x} value={x}>{x||'كل الصفوف'}</option>)}</select></div><div className="field field-span"><label>الرسالة</label><textarea className="input" rows={4} name="body" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>إرسال الإشعار</button></form><div className="card admin-panel"><h2>آخر الإشعارات</h2><div className="mobile-list">{adminNotes.map(n=><div className="admin-list-item stacked" key={n.id}><div><b>{n.title}</b><span>{[n.stage,n.education_type,n.grade].filter(Boolean).join(' · ')||'لكل الطلاب'}</span><p>{n.body}</p></div></div>)}</div></div></>}

        {tab==='assistant'&&<><form className="card admin-panel" onSubmit={addKnowledge}><span className="eyebrow">قاعدة معرفة المساعد</span><h2>أضف سؤال وإجابته المعتمدة</h2><p>المواعيد والعنوان وأرقام التواصل تُقرأ مباشرة من إعدادات الموقع؛ تعديلها ينعكس على الشات فورًا.</p><div className="form-grid"><div className="field"><label>القسم</label><input className="input" name="category" placeholder="مواعيد / أسعار / حجز" required/></div><div className="field"><label>كلمات مفتاحية</label><input className="input" name="keywords" placeholder="ميعاد مواعيد الساعة"/></div><div className="field field-span"><label>السؤال</label><input className="input" name="question" required/></div><div className="field field-span"><label>الإجابة</label><textarea className="input" rows={4} name="answer" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>إضافة للمساعد</button></form><div className="card admin-panel"><h2>المعلومات الحالية</h2><div className="mobile-list">{knowledge.map(k=><div className="admin-list-item stacked" key={k.id}><div><span className="eyebrow">{k.category}</span><b>{k.question}</b><p>{k.answer}</p><span>{k.active?'مفعلة':'معطلة'}</span></div><div className="row-actions"><button className="btn" onClick={()=>editKnowledge(k)}>تعديل الإجابة</button><button className="btn" onClick={()=>toggleKnowledge(k)}>{k.active?'تعطيل':'تفعيل'}</button><button className="btn btn-danger" onClick={()=>deleteKnowledge(k)}>حذف</button></div></div>)}</div></div></>}

        {tab==='reviews'&&<><div className="card admin-panel"><h2>التقييمات</h2><div className="mobile-list">{reviews.length===0?<p>لا توجد تقييمات حتى الآن.</p>:reviews.map(r=><div className="admin-list-item stacked" key={r.id}><div><b>{r.name} · {r.rating}/5</b><span>{r.stage} · {r.status}</span><p>{r.body}</p></div><div className="row-actions"><button className="btn btn-primary" onClick={()=>moderate(r.id,'approved')}>نشر</button><button className="btn btn-danger" onClick={()=>moderate(r.id,'rejected')}>رفض</button></div></div>)}</div></div><div className="card admin-panel"><h2>رسائل التواصل</h2><div className="mobile-list">{messages.length===0?<p>لا توجد رسائل.</p>:messages.map(m=><div className="admin-list-item stacked" key={m.id}><div><b>{m.name} · {m.phone}</b><span>{m.status==='new'?'جديدة':m.status==='followed_up'?'تمت المتابعة':'مغلقة'}</span><p>{m.message}</p></div><div className="row-actions"><a className="btn" href={whatsappUrl(m.phone)} target="_blank" rel="noreferrer">واتساب</a><button className="btn" onClick={()=>updateMessage(m.id,'followed_up')}>تمت المتابعة</button><button className="btn" onClick={()=>updateMessage(m.id,'closed')}>إغلاق</button></div></div>)}</div></div></>}

        {tab==='site'&&<><div className="card admin-panel"><div className="panel-head"><div><span className="eyebrow">حالة الموقع</span><h2>{settings.maintenance_mode==='true'?'الموقع في وضع الصيانة':'الموقع متاح للزوار'}</h2></div><button className={`btn ${settings.maintenance_mode==='true'?'btn-primary':'btn-danger'}`} onClick={toggleMaintenance}>{settings.maintenance_mode==='true'?'تشغيل الموقع':'وضع الصيانة'}</button></div></div><form className="card admin-panel" onSubmit={saveSettings}><h2>بيانات الموقع</h2><div className="form-grid"><div className="field"><label>رقم الهاتف الأساسي</label><input className="input" name="primary_phone" defaultValue={settings.primary_phone||''}/></div><div className="field"><label>رقم إضافي</label><input className="input" name="secondary_phone" defaultValue={settings.secondary_phone||''}/></div><div className="field"><label>واتساب</label><input className="input" name="whatsapp" defaultValue={settings.whatsapp||''}/></div><div className="field"><label>البريد</label><input className="input" type="email" name="contact_email" defaultValue={settings.contact_email||''}/></div><div className="field field-span"><label>مواعيد السنتر</label><input className="input" name="center_hours" defaultValue={settings.center_hours||''}/></div><div className="field field-span"><label>العنوان</label><textarea className="input" name="center_address" defaultValue={settings.center_address||''}/></div><div className="field field-span"><label>رسالة الصيانة</label><textarea className="input" name="maintenance_message" defaultValue={settings.maintenance_message||''}/></div></div><h3>المراحل المتاحة للتسجيل</h3><div className="row-actions"><label className="checkbox-row"><input type="checkbox" name="stage_prep_enabled" defaultChecked={settings.stage_prep_enabled==='true'}/> إعدادي</label><label className="checkbox-row"><input type="checkbox" name="stage_secondary_enabled" defaultChecked={settings.stage_secondary_enabled==='true'}/> ثانوي</label><label className="checkbox-row"><input type="checkbox" name="stage_adults_enabled" defaultChecked={settings.stage_adults_enabled==='true'}/> كورسات للكبار</label></div><button className="btn btn-dark" disabled={actionBusy}>حفظ الإعدادات</button></form></>}

        {tab==='pages'&&<><form className="card admin-panel" onSubmit={addPage}><h2>إنشاء صفحة جديدة</h2><div className="form-grid"><div className="field"><label>العنوان</label><input className="input" name="title" required/></div><div className="field"><label>Slug إنجليزي</label><input className="input" name="slug" pattern="[a-z0-9-]+" required/></div><div className="field field-span"><label>المحتوى</label><textarea className="input" rows={5} name="body" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>إنشاء الصفحة</button></form><div className="card admin-panel"><h2>الصفحات الحالية</h2><div className="mobile-list">{pages.map(p=><div className="admin-list-item" key={p.id}><div><b>{p.title}</b><span>{p.path} · {p.is_visible?'ظاهرة':'مخفية'}</span></div><div className="row-actions"><button className="btn" onClick={()=>togglePage(p)}>{p.is_visible?'إخفاء':'إظهار'}</button>{!p.is_system&&<button className="btn btn-danger" onClick={()=>archivePage(p)}>أرشفة</button>}</div></div>)}</div></div></>}

        {tab==='admins'&&<><div className="card admin-panel"><h2>الأدمنز</h2><div className="mobile-list">{admins.map(a=><div className="admin-list-item" key={a.id}><div><b>{a.name}</b><span>{a.email} · {a.role}</span></div><span className={`status-chip ${a.active?'ok':'off'}`}>{a.active?'نشط':'موقوف'}</span></div>)}</div></div>{meRole==='owner'&&<form className="card admin-panel" onSubmit={inviteAdmin}><h2>دعوة Admin جديد</h2><div className="field"><label>الإيميل</label><input className="input" type="email" name="email" required/></div><button className="btn btn-dark" style={{marginTop:12}} disabled={actionBusy}>إنشاء الدعوة</button>{inviteLink&&<div className="invite-box"><b>رابط الدعوة:</b><input className="input" readOnly value={inviteLink}/></div>}</form>}<form className="card admin-panel" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);if(f.get('new_password')!==f.get('confirm_password')){setError('كلمتا المرور الجديدتان غير متطابقتين.');return}if(!confirm('تأكيد تغيير كلمة مرور الإدارة؟ ستحتاج لتسجيل الدخول من جديد.'))return;await run(async()=>{await api('/auth/change-password',{method:'POST',body:JSON.stringify({current_password:f.get('current_password'),new_password:f.get('new_password')})});form.reset();router.replace('/admin/login')},'تم تغيير كلمة المرور.');}}><h2>تغيير كلمة المرور</h2><div className="form-grid"><div className="field"><label>كلمة المرور الحالية</label><input className="input" type="password" name="current_password" required/></div><div className="field"><label>كلمة المرور الجديدة</label><input className="input" type="password" name="new_password" required/></div><div className="field"><label>تأكيد الجديدة</label><input className="input" type="password" name="confirm_password" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>تغيير كلمة المرور</button></form></>}

        {tab==='audit'&&meRole==='owner'&&<div className="card admin-panel"><div className="panel-head"><div><span className="eyebrow">Owner only</span><h2>سجل النشاط</h2></div><button className="btn" onClick={()=>loadTab('audit')}>تحديث</button></div><div className="mobile-list">{auditItems.map(item=><div className="admin-list-item" key={item.id}><div><b>{item.action}</b><span>{item.entity}{item.entity_id?` #${item.entity_id}`:''} · Admin #{item.actor??'system'}</span></div><span>{new Date(item.created_at).toLocaleString('ar-EG')}</span></div>)}</div></div>}
      </section>
    </div>
  </main>;
}
