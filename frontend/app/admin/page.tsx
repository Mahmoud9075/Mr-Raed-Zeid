'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Stats = {
  users:number; students:number; quizzes:number; attempts:number; submitted_attempts:number;
  average_score:number|null; manual_pending:number; pending_reviews:number; new_messages:number; admins:number;
  students_by_stage?:{stage:string;count:number}[];
  recent_students?:{id:number;name:string;stage?:string;grade?:string;created_at:string}[];
  student_alerts?:{user_id:number;name:string;average_score:number;type:string}[];
};
type Settings = Record<string,string>;
type PageItem = {id:number;slug:string;title:string;path:string;is_visible:boolean;sort_order:number;is_system:boolean;content_json:string};
type Quiz = {id:number;slug:string;title_ar:string;description_ar?:string;stage?:string;education_type?:string;grade?:string;published:boolean;questions:number;max_attempts:number;duration_minutes:number;passing_score:number;starts_at?:string|null;ends_at?:string|null;show_result_immediately?:boolean;is_placement:boolean;randomize_questions:boolean};
type AdminChoice = {id:number;text:string;position:number;is_correct:boolean};
type AdminQuestion = {id:number;prompt:string;explanation:string;level:string;question_type:'mcq'|'true_false'|'short'|'essay';expected_answer?:string|null;position:number;points:number;is_active:boolean;choices:AdminChoice[]};
type QuizDetails = {id:number;slug:string;title_ar:string;title_en?:string;description_ar?:string;description_en?:string;stage?:string;education_type?:string;grade?:string;duration_minutes:number;passing_score:number;max_attempts:number;starts_at?:string|null;ends_at?:string|null;is_published:boolean;show_result_immediately:boolean;is_placement:boolean;randomize_questions:boolean;question_pool_count:number;questions_per_attempt:number;questions:AdminQuestion[]};
type User = {id:number;name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;role:string;active:boolean;profile_image?:string};
type UserDetails = {user:{id:number;name:string;first_name:string;last_name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;school_name?:string;active:boolean;is_verified:boolean;created_at?:string};attempts:{id:number;quiz:string;score:number|null;level_result?:string;needs_manual_review:boolean;submitted_at?:string}[]};
type AdminUser = {id:number;name:string;email:string;role:string;active:boolean};
type Review = {id:number;name:string;stage:string;rating:number;body:string;status:string};
type Message = {id:number;name:string;phone:string;message:string;status:string};
type Knowledge = {id:number;category:string;question:string;answer:string;keywords:string;active:boolean};
type AdminNote = {id:number;title:string;body:string;stage?:string;education_type?:string;grade?:string;user_id?:number;active:boolean};
type ResultItem = {id:number;student_id:number;student_name:string;email:string;phone:string;guardian_phone?:string;stage?:string;education_type?:string;grade?:string;quiz_id:number;quiz:string;score:number|null;level_result?:string;needs_manual_review:boolean;submitted_at?:string};
type ResultPage = {items:ResultItem[];total:number;page:number;page_size:number};
type ResultDetail = ResultItem & {answers:{answer_id:number;question_id:number;question:string;question_type:string;points:number;choice?:string;text_answer?:string;is_correct:boolean|null;awarded_points:number|null}[]};
type AuditItem = {id:number;actor:number|null;actor_name?:string;actor_email?:string|null;action:string;entity:string;entity_id?:string;metadata:string;created_at:string};
type MonthItem = {id:number;title:string;stage?:string;education_type?:string;grade?:string;sort_order:number;is_visible:boolean;quiz_count:number;starts_at?:string;ends_at?:string};
type PathConfig = {quiz_id:number;quiz:string;month_id?:number|null;week_label?:string;sort_order:number;requires_previous:boolean;unlock_after_quiz_id?:number|null;min_previous_score:number;show_when_locked:boolean};
type AnalyticsData = {total:number;online_now:number;by_page:{path:string;count:number}[];last_7_days:{date:string;count:number}[];students_by_grade:{grade:string;count:number}[]};
type PresenceItem = {user_id:number;name:string;email:string;role:string;path:string;last_seen:string;online:boolean};
type AuthorizedAdmin = {id:number;email:string;role:string;active:boolean;user_id?:number|null;account_active?:boolean|null;permissions?:string[]};
type SystemStatus = {backend:string;database:string;gemini_configured:boolean;gemini_model:string;email_configured:boolean;environment:string};
type TrashData = {quizzes:{id:number;title:string;archived_at?:string}[];pages:{id:number;title:string;archived_at?:string}[];students:{id:number;title:string;email:string;archived_at?:string}[]};
type AssistantQuestion = {question:string;source:string;count:number};
type QuestionAnalytics = {question_id:number;question:string;quiz:string;answers:number;correct:number;accuracy:number|null};
type SearchResults = {users:{id:number;title:string;subtitle:string}[];quizzes:{id:number;title:string;subtitle:string}[];pages:{id:number;title:string;subtitle:string}[]};
type ActiveSession = {user_id:number;name:string;email:string;active_sessions:number;latest_expiry:string};

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

function dateTimeInput(value?:string|null){
  if(!value)return ''; const d=new Date(value); if(Number.isNaN(d.getTime()))return '';
  const local=new Date(d.getTime()-d.getTimezoneOffset()*60000); return local.toISOString().slice(0,16);
}

function auditDetails(value:string){
  try{const data=JSON.parse(value||'{}');if(data.before||data.after)return `قبل: ${JSON.stringify(data.before||{})} · بعد: ${JSON.stringify(data.after||{})}`;return Object.keys(data).length?JSON.stringify(data):''}catch{return value||''}
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
  const [resultMonth,setResultMonth] = useState('');
  const [manualOnly,setManualOnly] = useState(false);
  const [months,setMonths] = useState<MonthItem[]>([]);
  const [pathConfigs,setPathConfigs] = useState<PathConfig[]>([]);
  const [analytics,setAnalytics] = useState<AnalyticsData|null>(null);
  const [presence,setPresence] = useState<PresenceItem[]>([]);
  const [authorizedAdmins,setAuthorizedAdmins] = useState<AuthorizedAdmin[]>([]);
  const [systemStatus,setSystemStatus] = useState<SystemStatus|null>(null);
  const [trash,setTrash] = useState<TrashData>({quizzes:[],pages:[],students:[]});
  const [assistantQuestions,setAssistantQuestions] = useState<AssistantQuestion[]>([]);
  const [sessions,setSessions] = useState<ActiveSession[]>([]);
  const [monthStage,setMonthStage] = useState('');
  const [myPermissions,setMyPermissions] = useState<string[]>([]);
  const [questionAnalytics,setQuestionAnalytics] = useState<QuestionAnalytics[]>([]);
  const [globalSearch,setGlobalSearch] = useState('');
  const [studentEditStage,setStudentEditStage] = useState('');
  const [searchResults,setSearchResults] = useState<SearchResults|null>(null);
  const [permissionTarget,setPermissionTarget] = useState<AuthorizedAdmin|null>(null);
  const [permissionDraft,setPermissionDraft] = useState<string[]>([]);

  async function loadCore() {
    setLoading(true); setError('');
    try {
      const me = await api<{role:string}>('/auth/me');
      if (!['admin','owner'].includes(me.role)) { router.replace('/student'); return; }
      setMeRole(me.role);
      const permissionData = await api<{role:string;permissions:string[]}>('/admin/permissions/me');
      const perms = permissionData.permissions || [];
      setMyPermissions(perms);
      const can = (permission:string) => me.role === 'owner' || perms.includes(permission);
      const [sData,stData,pData,qData,aData] = await Promise.all([
        can('dashboard') ? api<Stats>('/admin/dashboard') : Promise.resolve(null),
        can('settings') ? api<Settings>('/admin/site-settings') : Promise.resolve({} as Settings),
        can('content') ? api<PageItem[]>('/admin/pages') : Promise.resolve([] as PageItem[]),
        can('quizzes') ? api<Quiz[]>('/admin/quizzes') : Promise.resolve([] as Quiz[]),
        can('admins') ? api<AdminUser[]>('/admin/admins') : Promise.resolve([] as AdminUser[])
      ]);
      setStats(sData); setSettings(stData); setPages(pData); setQuizzes(qData); setAdmins(aData);
      if (me.role !== 'owner' && !can('dashboard') && tab === 'overview') {
        const first = [['users','students'],['results','results'],['reviews','reviews'],['months','months'],['quizzes','quizzes'],['pages','content'],['assistant','assistant'],['notifications','notifications'],['site','settings'],['analytics','analytics'],['admins','admins']].find(([,permission])=>can(permission));
        if (first) setTab(first[0]);
      }
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
        if (resultMonth) params.set('month_id', resultMonth);
        if (manualOnly) params.set('manual_only','true');
        params.set('page_size','100');
        setResults(await api<ResultPage>(`/admin/results?${params}`));
        if (!months.length && (meRole === 'owner' || myPermissions.includes('months'))) {
          try { setMonths(await api<MonthItem[]>('/admin/months')); } catch {}
        }
      } else if (target === 'notifications') {
        setAdminNotes(await api<AdminNote[]>('/admin/notifications'));
      } else if (target === 'assistant') {
        setKnowledge(await api<Knowledge[]>('/admin/knowledge'));
      } else if (target === 'reviews') {
        const [r,m] = await Promise.all([api<Review[]>('/admin/reviews'),api<Message[]>('/admin/messages')]);
        setReviews(r); setMessages(m);
      } else if (target === 'months') {
        const [m,p] = await Promise.all([api<MonthItem[]>('/admin/months'),api<PathConfig[]>('/admin/quiz-path')]);
        setMonths(m); setPathConfigs(p);
      } else if (target === 'analytics') {
        const [a,p,q,qa] = await Promise.all([api<AnalyticsData>('/admin/analytics'),api<PresenceItem[]>('/admin/presence'),api<AssistantQuestion[]>('/admin/assistant/questions'),api<QuestionAnalytics[]>('/admin/question-analytics')]);
        setAnalytics(a); setPresence(p); setAssistantQuestions(q); setQuestionAnalytics(qa);
      } else if (target === 'security' && meRole === 'owner') {
        const [a,s] = await Promise.all([api<AuthorizedAdmin[]>('/admin/authorized-admins'),api<ActiveSession[]>('/admin/sessions')]);
        setAuthorizedAdmins(a); setSessions(s);
      } else if (target === 'system') {
        const [st,tr] = await Promise.all([api<SystemStatus>('/admin/system-status'),api<TrashData>('/admin/trash')]);
        setSystemStatus(st); setTrash(tr);
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
    const payload={slug:f.get('slug'),title_ar:f.get('title_ar'),title_en:'',description_ar:f.get('description_ar'),stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,duration_minutes:Number(f.get('duration_minutes')||30),passing_score:Number(f.get('passing_score')||60),max_attempts:Number(f.get('max_attempts')||2),randomize_questions:!!f.get('randomize_questions'),show_result_immediately:!!f.get('show_result_immediately'),starts_at:f.get('starts_at')||null,ends_at:f.get('ends_at')||null,is_published:false,is_placement:false};
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
    await run(async()=>{const detail=await api<UserDetails>(`/admin/users/${userId}`);setUserDetail(detail);setStudentEditStage(detail.user.stage||'')});
  }

  async function saveStudent(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!userDetail)return; const f=new FormData(e.currentTarget);
    await run(async()=>{await api(`/admin/users/${userDetail.user.id}`,{method:'PUT',body:JSON.stringify({first_name:f.get('first_name'),last_name:f.get('last_name'),email:f.get('email'),phone:f.get('phone'),guardian_phone:f.get('guardian_phone')||null,stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,school_name:f.get('school_name')||null,is_verified:!!f.get('is_verified')})});await openUser(userDetail.user.id);await loadTab('users')},'تم تحديث بيانات الطالب.');
  }

  async function inviteAdmin(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f=new FormData(e.currentTarget);
    await run(async()=>{ const r=await api<{token:string}>('/admin/admins/invite',{method:'POST',body:JSON.stringify({email:f.get('email'),role:'admin'})}); setInviteLink(`${location.origin}/admin/accept?token=${encodeURIComponent(r.token)}`); await loadCore(); },'تم إنشاء دعوة الأدمن. انسخ الرابط وأرسله للشخص المطلوب.');
  }

  async function moderate(id:number,status:string) {
    if(!confirm('تأكيد الإجراء على التقييم؟'))return;
    await run(async()=>{ await api(`/admin/reviews/${id}?status=${status}`,{method:'PATCH'}); await loadTab('reviews'); });
  }

  async function deleteReview(id:number) {
    if(!confirm('حذف التقييم نهائيًا؟'))return;
    await run(async()=>{await api(`/admin/reviews/${id}`,{method:'DELETE'});await loadTab('reviews')},'تم حذف التقييم.');
  }

  async function updateMessage(id:number,status:'new'|'followed_up'|'closed') {
    await run(async()=>{ await api(`/admin/messages/${id}`,{method:'PATCH',body:JSON.stringify({status})}); await loadTab('reviews'); },'تم تحديث حالة الرسالة.');
  }

  async function addNotification(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    await run(async()=>{ await api('/admin/notifications',{method:'POST',body:JSON.stringify({title:f.get('title'),body:f.get('body'),stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,user_id:null})}); form.reset(); setNoteStage(''); await loadTab('notifications'); },'تم إرسال الإشعار.');
  }

  async function toggleNotification(n:AdminNote){
    await run(async()=>{await api(`/admin/notifications/${n.id}/active?active=${!n.active}`,{method:'PATCH'});await loadTab('notifications')},n.active?'تم إخفاء الإشعار عن الطلاب.':'تم تفعيل الإشعار.');
  }

  async function deleteNotification(n:AdminNote){
    if(!confirm(`حذف إشعار: ${n.title}؟`))return;
    await run(async()=>{await api(`/admin/notifications/${n.id}`,{method:'DELETE'});await loadTab('notifications')},'تم حذف الإشعار.');
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

  async function createMonth(e:FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form=e.currentTarget; const f=new FormData(form);
    const starts=String(f.get('starts_at')||'').trim(); const ends=String(f.get('ends_at')||'').trim();
    await run(async()=>{await api('/admin/months',{method:'POST',body:JSON.stringify({title:f.get('title'),stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,sort_order:Number(f.get('sort_order')||0),is_visible:true,starts_at:starts||null,ends_at:ends||null})});form.reset();setMonthStage('');await loadTab('months')},'تمت إضافة الشهر.');
  }

  async function toggleMonth(m:MonthItem){
    await run(async()=>{await api(`/admin/months/${m.id}`,{method:'PUT',body:JSON.stringify({title:m.title,stage:m.stage||null,education_type:m.education_type||null,grade:m.grade||null,sort_order:m.sort_order,is_visible:!m.is_visible,starts_at:m.starts_at||null,ends_at:m.ends_at||null})});await loadTab('months')},m.is_visible?'تم إخفاء الشهر من الطلاب.':'تم إظهار الشهر للطلاب.');
  }

  async function editMonth(m:MonthItem){
    const title=prompt('اسم الشهر / الوحدة:',m.title); if(title===null||!title.trim())return;
    const orderRaw=prompt('الترتيب:',String(m.sort_order)); if(orderRaw===null)return; const sort_order=Number(orderRaw); if(!Number.isFinite(sort_order)){setError('الترتيب لازم يكون رقم.');return;}
    const startsRaw=prompt('بداية الظهور (YYYY-MM-DD HH:MM) أو سيبها فاضية:',m.starts_at?dateTimeInput(m.starts_at).replace('T',' '):''); if(startsRaw===null)return;
    const endsRaw=prompt('نهاية الظهور (YYYY-MM-DD HH:MM) أو سيبها فاضية:',m.ends_at?dateTimeInput(m.ends_at).replace('T',' '):''); if(endsRaw===null)return;
    const normalize=(v:string)=>v.trim()?v.trim().replace(' ','T'):null;
    await run(async()=>{await api(`/admin/months/${m.id}`,{method:'PUT',body:JSON.stringify({title:title.trim(),stage:m.stage||null,education_type:m.education_type||null,grade:m.grade||null,sort_order,is_visible:m.is_visible,starts_at:normalize(startsRaw),ends_at:normalize(endsRaw)})});await loadTab('months')},'تم تحديث الشهر وترتيبه.');
  }

  async function removeMonth(m:MonthItem){
    if(!confirm(`حذف ${m.title} من المسار؟ الاختبارات نفسها لن تُحذف.`))return;
    await run(async()=>{await api(`/admin/months/${m.id}`,{method:'DELETE'});await loadTab('months')},'تم حذف الشهر من المسار.');
  }

  async function savePathConfig(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const f=new FormData(e.currentTarget);const quizId=Number(f.get('quiz_id'));if(!quizId)return;
    await run(async()=>{await api(`/admin/quiz-path/${quizId}`,{method:'PUT',body:JSON.stringify({month_id:Number(f.get('month_id'))||null,week_label:f.get('week_label')||null,sort_order:Number(f.get('sort_order')||0),requires_previous:!!f.get('requires_previous'),unlock_after_quiz_id:Number(f.get('unlock_after_quiz_id'))||null,min_previous_score:Number(f.get('min_previous_score')||60),show_when_locked:true})});await loadTab('months')},'تم ربط الاختبار بالمسار.');
  }

  async function addAuthorizedAdmin(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);
    await run(async()=>{await api('/admin/authorized-admins',{method:'POST',body:JSON.stringify({email:f.get('email'),role:f.get('role')||'admin'})});form.reset();await loadTab('security')},'تم اعتماد الإيميل للإدارة.');
  }

  async function disableAuthorizedAdmin(a:AuthorizedAdmin){
    if(!confirm(`إيقاف صلاحية ${a.email}؟`))return;
    await run(async()=>{await api(`/admin/authorized-admins/${a.id}`,{method:'DELETE'});await loadTab('security')},'تم إيقاف الإيميل.');
  }

  async function setupPin(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const form=e.currentTarget;const f=new FormData(form);if(f.get('pin')!==f.get('confirm_pin')){setError('رقما الـ PIN غير متطابقين.');return;}
    await run(async()=>{await api('/auth/admin-pin/setup',{method:'POST',body:JSON.stringify({pin:f.get('pin')})});form.reset()},'تم حفظ PIN الإدارة بصورة مشفرة.');
  }

  async function revokeSessions(userId:number){
    if(!confirm('تسجيل خروج هذا الحساب من كل الجلسات الحالية؟'))return;
    await run(async()=>{await api(`/admin/sessions/${userId}/revoke`,{method:'POST'});await loadTab('security')},'تم إلغاء الجلسات.');
  }

  async function archiveStudent(userId:number){
    if(!confirm('نقل الطالب للمحذوفات؟ النتائج والاختبارات القديمة هتفضل محفوظة وتقدر ترجعه لاحقًا.'))return;
    await run(async()=>{await api(`/admin/users/${userId}/archive`,{method:'POST'});setUserDetail(null);await loadTab('users');await loadCore()},'تم نقل الطالب للمحذوفات بدون حذف نتائجه.');
  }

  async function restoreTrash(kind:'quizzes'|'pages'|'students',id:number){
    await run(async()=>{await api(`/admin/trash/${kind}/${id}/restore`,{method:'POST'});await loadCore();await loadTab('system')},'تمت الاستعادة.');
  }

  async function editPageContent(p:PageItem){
    let body='';try{body=JSON.parse(p.content_json||'{}').body||''}catch{}
    const next=prompt(`تعديل محتوى صفحة: ${p.title}`,body);if(next===null)return;
    await run(async()=>{await api(`/admin/pages/${p.id}/content`,{method:'PUT',body:JSON.stringify({content_json:JSON.stringify({body:next})})});await loadCore()},'تم حفظ المحتوى وإنشاء نسخة سابقة تلقائيًا.');
  }

  async function editPageOrder(p:PageItem){
    const raw=prompt(`ترتيب صفحة ${p.title}:`,String(p.sort_order)); if(raw===null)return; const sort_order=Number(raw);
    if(!Number.isFinite(sort_order)){setError('الترتيب لازم يكون رقم.');return;}
    await run(async()=>{await api(`/admin/pages/${p.id}/content`,{method:'PUT',body:JSON.stringify({sort_order})});await loadCore()},'تم تحديث ترتيب الصفحة.');
  }

  async function rollbackPage(p:PageItem){
    await run(async()=>{const revs=await api<{id:number;title:string;created_at:string}[]>(`/admin/pages/${p.id}/revisions`);if(!revs.length)throw new Error('مفيش نسخة سابقة للصفحة دي.');if(!confirm('الرجوع لآخر نسخة محفوظة؟'))return;await api(`/admin/pages/${p.id}/rollback/${revs[0].id}`,{method:'POST'});await loadCore()},'تم الرجوع لآخر نسخة.');
  }

  async function restoreBackup(file?:File){
    if(!file)return;if(!confirm('استعادة النسخة الاحتياطية؟ الإعدادات والمحتوى والطلاب والنتائج الموجودة في النسخة هتتم مزامنتها بدون استرجاع كلمات السر أو الـTokens.'))return;
    const fd=new FormData();fd.append('file',file);
    await run(async()=>{await api('/admin/backup/restore',{method:'POST',body:fd});await loadCore()},'تمت استعادة النسخة الآمنة.');
  }

  async function importStudents(file?:File){
    if(!file)return;const fd=new FormData();fd.append('file',file);
    await run(async()=>{const r=await api<{created:number;skipped_rows:number[];temporary_passwords:{email:string;password:string}[]}>('/admin/imports/users.xlsx',{method:'POST',body:fd});let text=`تمت إضافة ${r.created} طالب.`;if(r.skipped_rows.length)text+=` تم تخطي الصفوف: ${r.skipped_rows.join(', ')}`;if(r.temporary_passwords.length)text+=' بعض الحسابات تم إنشاء كلمة مؤقتة لها؛ أعد الاستيراد بكلمات محددة لو محتاج تحتفظ بها.';setNotice(text);await loadCore()},undefined);
  }

  async function saveQuizSettings(e:FormEvent<HTMLFormElement>){
    e.preventDefault(); if(!selectedQuiz||!quizDetails)return; const f=new FormData(e.currentTarget);
    const starts=String(f.get('starts_at')||'').trim(); const ends=String(f.get('ends_at')||'').trim();
    await run(async()=>{await api(`/admin/quizzes/${selectedQuiz}/details`,{method:'PUT',body:JSON.stringify({title_ar:f.get('title_ar'),description_ar:f.get('description_ar')||'',stage:f.get('stage')||null,education_type:f.get('education_type')||null,grade:f.get('grade')||null,duration_minutes:Number(f.get('duration_minutes')||30),passing_score:Number(f.get('passing_score')||60),max_attempts:Number(f.get('max_attempts')||2),randomize_questions:!!f.get('randomize_questions'),show_result_immediately:!!f.get('show_result_immediately'),starts_at:starts||null,ends_at:ends||null})});await loadCore();await loadQuizDetails(selectedQuiz)},'تم حفظ إعدادات الاختبار.');
  }

  async function runGlobalSearch(e?:FormEvent<HTMLFormElement>){
    e?.preventDefault(); const q=globalSearch.trim(); if(q.length<2){setSearchResults(null);return;}
    await run(async()=>setSearchResults(await api<SearchResults>(`/admin/search?q=${encodeURIComponent(q)}`)));
  }

  const permissionOptions = [
    ['dashboard','الرئيسية'],['students','الطلاب'],['results','النتائج'],['reviews','التقييمات والرسائل'],
    ['months','الشهور والمسار'],['quizzes','الاختبارات'],['content','محتوى الموقع'],['assistant','المساعد الذكي'],
    ['settings','الإعدادات والصيانة'],['analytics','الزيارات والإحصائيات'],['notifications','الإشعارات'],['admins','إدارة الأدمنز']
  ] as const;

  function openAdminPermissions(admin:AuthorizedAdmin){
    if(!admin.user_id||admin.role==='owner')return;
    setPermissionTarget(admin); setPermissionDraft(admin.permissions?.length?admin.permissions:permissionOptions.map(x=>x[0]));
  }

  async function saveAdminPermissions(){
    if(!permissionTarget?.user_id)return;
    await run(async()=>{await api(`/admin/admins/${permissionTarget.user_id}/permissions`,{method:'PUT',body:JSON.stringify({permissions:permissionDraft})});setPermissionTarget(null);await loadTab('security')},'تم تحديث صلاحيات الأدمن.');
  }

  const selected = useMemo(()=>quizzes.find(q=>q.id===selectedQuiz),[quizzes,selectedQuiz]);
  const tabPermission:Record<string,string>={overview:'dashboard',users:'students',results:'results',reviews:'reviews',months:'months',quizzes:'quizzes',pages:'content',assistant:'assistant',notifications:'notifications',site:'settings',analytics:'analytics',admins:'admins'};
  const baseTabs = [
    ['overview','الرئيسية'],['users','الطلاب'],['results','النتائج'],['reviews','التقييمات والرسائل'],
    ['months','الشهور والمسار'],['quizzes','الاختبارات والأسئلة'],['pages','محتوى الموقع'],['assistant','المساعد الذكي'],
    ['notifications','الإشعارات'],['site','الإعدادات والصيانة'],['analytics','الزيارات والإحصائيات'],['admins','الأدمنز']
  ];
  const tabs = [
    ...baseTabs.filter(([id])=>meRole==='owner'||myPermissions.includes(tabPermission[id])),
    ...(meRole==='owner'?[['security','الأمان والصلاحيات'],['system','النظام والنسخ'],['audit','سجل التعديلات']]:[])
  ];

  if (loading || !meRole) return <main className="admin-login-screen"><section className="admin-login-card admin-loading-card"><div className="admin-login-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/></div><span className="admin-login-kicker">Secure Administration</span><h1>جاري التحقق</h1><p>بنراجع صلاحية حساب الإدارة...</p></section></main>;

  return <main className="section admin-page">
    <div className="admin-console-head"><a href="/admin" className="admin-console-brand"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/><span><b>لوحة إدارة مستر رائد</b><small>Secure Control Center</small></span></a><form className="admin-global-search" onSubmit={runGlobalSearch}><input className="input" value={globalSearch} onChange={e=>setGlobalSearch(e.target.value)} placeholder="بحث شامل: طالب، اختبار، صفحة..."/><button className="btn">بحث</button></form><button className="btn" onClick={()=>api('/auth/logout',{method:'POST',body:JSON.stringify({})}).finally(()=>router.replace('/admin/login'))}>تسجيل الخروج</button></div>
    <div className="container admin-shell">
      <aside className="card admin-nav"><div><span className="eyebrow">Admin</span><h3>لوحة التحكم</h3></div>{tabs.map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}</aside>
      <section className="admin-content">
        {error&&<div className="notice error">{error}<button className="notice-close" onClick={()=>setError('')}>×</button></div>}
        {notice&&<div className="notice success">{notice}<button onClick={()=>setNotice('')}>×</button></div>}
        {searchResults&&<div className="card admin-panel admin-search-results"><div className="panel-head"><h2>نتائج البحث الشامل</h2><button className="btn" onClick={()=>setSearchResults(null)}>إغلاق</button></div><div className="admin-grid">{searchResults.users.map(x=><button className="action-card" key={`u${x.id}`} onClick={()=>{setSearchResults(null);setTab('users');openUser(x.id)}}><b>{x.title}</b><span>{x.subtitle} · طالب/مستخدم</span></button>)}{searchResults.quizzes.map(x=><button className="action-card" key={`q${x.id}`} onClick={()=>{setSearchResults(null);setTab('quizzes');loadQuizDetails(x.id)}}><b>{x.title}</b><span>{x.subtitle} · اختبار</span></button>)}{searchResults.pages.map(x=><button className="action-card" key={`p${x.id}`} onClick={()=>{setSearchResults(null);setTab('pages')}}><b>{x.title}</b><span>{x.subtitle} · صفحة</span></button>)}</div></div>}

        {tab==='overview'&&<><div className="admin-title"><div><span className="eyebrow">نظرة عامة</span><h1 className="section-title">كل حاجة مهمة في مكان واحد</h1></div><button className="btn" onClick={()=>loadCore()}>تحديث البيانات</button></div><div className="admin-grid"><div className="card stat"><span>الطلاب</span><b>{stats?.students??0}</b></div><div className="card stat"><span>النتائج المسجلة</span><b>{stats?.submitted_attempts??0}</b></div><div className="card stat"><span>متوسط الدرجات</span><b>{stats?.average_score==null?'—':`${stats.average_score}%`}</b></div><div className="card stat"><span>في انتظار التصحيح</span><b>{stats?.manual_pending??0}</b></div><div className="card stat"><span>الاختبارات</span><b>{stats?.quizzes??0}</b></div><div className="card stat"><span>رسائل جديدة</span><b>{stats?.new_messages??0}</b></div><div className="card stat"><span>تقييمات منتظرة</span><b>{stats?.pending_reviews??0}</b></div><div className="card stat"><span>الأدمنز</span><b>{stats?.admins??0}</b></div></div><div className="card admin-panel"><h2>اختصارات سريعة</h2><div className="admin-grid"><button className="action-card" onClick={()=>setTab('results')}><b>النتائج والتقارير</b><span>درجات · Excel · طباعة · تصحيح مقالي</span></button><button className="action-card" onClick={()=>setTab('months')}><b>الشهور والمسار</b><span>ترتيب الاختبارات وفتحها تدريجيًا</span></button><button className="action-card" onClick={()=>setTab('users')}><b>الطلاب</b><span>بحث وملف كامل لكل طالب</span></button><button className="action-card" onClick={()=>setTab('analytics')}><b>الزيارات والمتابعة</b><span>متصل الآن · صفحات · أسئلة المساعد</span></button></div></div><div className="two-col-dashboard"><div className="card admin-panel"><h2>تنبيهات الطلاب</h2>{!stats?.student_alerts?.length?<p>مفيش تنبيهات أداء حاليًا.</p>:<div className="mobile-list">{stats.student_alerts.map(x=><div className="admin-list-item" key={x.user_id}><div><b>{x.name}</b><span>متوسط منخفض يحتاج متابعة</span></div><span className="status-chip off">{x.average_score}%</span></div>)}</div>}</div><div className="card admin-panel"><h2>آخر التسجيلات</h2>{!stats?.recent_students?.length?<p>مفيش تسجيلات جديدة.</p>:<div className="mobile-list">{stats.recent_students.map(x=><div className="admin-list-item" key={x.id}><div><b>{x.name}</b><span>{[x.stage,x.grade].filter(Boolean).join(' · ')||'بدون مرحلة'}</span></div><small>{new Date(x.created_at).toLocaleDateString('ar-EG')}</small></div>)}</div>}</div></div></>}

        {tab==='results'&&<><div className="admin-title"><div><span className="eyebrow">Results Center</span><h1 className="section-title">النتائج والتقارير</h1><p className="section-subtitle">بحث، تصحيح المقالي، Excel وطباعة PDF من المتصفح.</p></div><div className="row-actions"><a className="btn btn-primary" href={`/api/v1/admin/results-export.xlsx?${new URLSearchParams({...(resultSearch.trim()?{search:resultSearch.trim()}:{}),...(resultQuiz?{quiz_id:resultQuiz}:{}),...(resultStage?{stage:resultStage}:{}),...(resultMonth?{month_id:resultMonth}:{}),...(manualOnly?{manual_only:'true'}:{})}).toString()}`}>تحميل Excel</a><a className="btn" href="/admin/results/print" target="_blank">طباعة / PDF</a></div></div><form className="card admin-panel" onSubmit={e=>{e.preventDefault();loadTab('results')}}><div className="form-grid"><div className="field"><label>بحث بالطالب / الهاتف / الاختبار</label><input className="input" value={resultSearch} onChange={e=>setResultSearch(e.target.value)}/></div><div className="field"><label>الاختبار</label><select className="input" value={resultQuiz} onChange={e=>setResultQuiz(e.target.value)}><option value="">كل الاختبارات</option>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title_ar}</option>)}</select></div><div className="field"><label>المرحلة</label><select className="input" value={resultStage} onChange={e=>setResultStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'كل المراحل'}</option>)}</select></div><div className="field"><label>الشهر</label><select className="input" value={resultMonth} onChange={e=>setResultMonth(e.target.value)}><option value="">كل الشهور</option>{months.map(m=><option key={m.id} value={m.id}>{m.title}{m.stage?` · ${m.stage}`:''}</option>)}</select></div><label className="checkbox-row"><input type="checkbox" checked={manualOnly} onChange={e=>setManualOnly(e.target.checked)}/> في انتظار التصحيح فقط</label></div><button className="btn btn-dark" disabled={actionBusy}>تطبيق الفلاتر</button></form><div className="card admin-panel"><div className="panel-head"><h2>النتائج ({results.total})</h2></div><div className="mobile-list">{results.items.length===0?<p>لا توجد نتائج مطابقة.</p>:results.items.map(r=><div className="admin-list-item" key={r.id}><div><b>{r.student_name} — {r.score??0}%</b><span>{r.quiz} · {[r.stage,r.education_type,r.grade].filter(Boolean).join(' · ')||'بدون تصنيف'}{r.level_result?` · مستوى ${r.level_result}`:''}</span>{r.needs_manual_review&&<span className="status-chip off">يحتاج تصحيح مقالي</span>}</div><div className="row-actions"><button className="btn" onClick={()=>openResult(r.id)}>عرض وتصحيح</button></div></div>)}</div></div>{resultDetail&&<div className="card admin-panel result-detail-panel"><div className="panel-head"><div><span className="eyebrow">تفاصيل النتيجة</span><h2>{resultDetail.student_name} — {resultDetail.score??0}%</h2><p>{resultDetail.quiz}</p></div><button className="btn" onClick={()=>setResultDetail(null)}>إغلاق</button></div><div className="mobile-list">{resultDetail.answers.map(a=><div className="admin-list-item stacked" key={a.answer_id}><div><b>{a.question}</b><span>الدرجة: {a.awarded_points??'بانتظار التصحيح'} / {a.points}</span><p>{a.choice||a.text_answer||'بدون إجابة'}</p></div>{a.question_type==='essay'&&a.text_answer&&<button className="btn btn-primary" onClick={()=>gradeEssay(a.answer_id,a.points)}>تصحيح</button>}</div>)}</div></div>}</>}

        {tab==='users'&&<>
          <form className="card admin-panel" onSubmit={e=>{e.preventDefault();loadTab('users')}}>
            <div className="panel-head"><div><h2>حسابات الطلاب</h2><p>ابحث بالاسم أو الهاتف أو البريد.</p></div><div className="row-actions"><input className="input" value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="بحث..."/><button className="btn btn-dark">بحث</button></div></div>
          </form>
          <div className="card admin-panel"><div className="mobile-list">{users.filter(u=>u.role==='student').map(u=><div className="admin-list-item" key={u.id}><div><b>{u.name}</b><span>{u.phone} · {[u.stage,u.education_type,u.grade].filter(Boolean).join(' · ')||'بدون مرحلة'}</span></div><div className="row-actions"><button className="btn" onClick={()=>openUser(u.id)}>ملف الطالب</button><button className={`btn ${u.active?'btn-danger':'btn-primary'}`} onClick={()=>toggleUser(u)}>{u.active?'إيقاف':'تفعيل'}</button></div></div>)}</div></div>
          {userDetail&&<div className="card admin-panel student-admin-profile">
            <div className="panel-head"><div><span className="eyebrow">ملف الطالب</span><h2>{userDetail.user.name}</h2><p>{userDetail.user.created_at?`عضو منذ ${new Date(userDetail.user.created_at).toLocaleDateString('ar-EG')}`:''}</p></div><div className="row-actions"><button className="btn" onClick={()=>setUserDetail(null)}>إغلاق</button><button className="btn btn-danger" onClick={()=>archiveStudent(userDetail.user.id)}>نقل للمحذوفات</button></div></div>
            <form onSubmit={saveStudent} key={userDetail.user.id}>
              <div className="form-grid"><div className="field"><label>الاسم الأول</label><input className="input" name="first_name" defaultValue={userDetail.user.first_name} required/></div><div className="field"><label>الاسم الأخير</label><input className="input" name="last_name" defaultValue={userDetail.user.last_name} required/></div><div className="field"><label>الإيميل</label><input className="input" type="email" name="email" defaultValue={userDetail.user.email} required/></div><div className="field"><label>رقم الطالب</label><input className="input" name="phone" defaultValue={userDetail.user.phone} required/></div><div className="field"><label>ولي الأمر</label><input className="input" name="guardian_phone" defaultValue={userDetail.user.guardian_phone||''}/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={studentEditStage} onChange={e=>setStudentEditStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'غير محدد'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type" defaultValue={userDetail.user.education_type||''}>{(types[studentEditStage]||['']).map(x=><option key={x} value={x}>{x||'غير محدد'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade" defaultValue={userDetail.user.grade||''}>{(grades[studentEditStage]||['']).map(x=><option key={x} value={x}>{x||'غير محدد'}</option>)}</select></div><div className="field field-span"><label>المدرسة</label><input className="input" name="school_name" defaultValue={userDetail.user.school_name||''}/></div><label className="checkbox-row"><input type="checkbox" name="is_verified" defaultChecked={userDetail.user.is_verified}/> الحساب متحقق</label></div>
              <button className="btn btn-dark" disabled={actionBusy}>حفظ بيانات الطالب</button>
            </form>
            <h3>الاختبارات والدرجات</h3><div className="mobile-list">{userDetail.attempts.length===0?<p>لا توجد محاولات.</p>:userDetail.attempts.map(a=><div className="admin-list-item" key={a.id}><div><b>{a.quiz}</b><span>{a.submitted_at?`${a.score??0}%${a.level_result?` · ${a.level_result}`:''}`:'محاولة لم تُسلّم بعد'}</span></div>{a.submitted_at&&<button className="btn" onClick={()=>{setTab('results');openResult(a.id)}}>عرض</button>}</div>)}</div>
          </div>}
        </>}

        {tab==='quizzes'&&<><form className="card admin-panel" onSubmit={addQuiz}><span className="eyebrow">1. إنشاء</span><h2>اختبار جديد</h2><div className="form-grid"><div className="field"><label>اسم الاختبار</label><input className="input" name="title_ar" required/></div><div className="field"><label>Slug</label><input className="input" name="slug" pattern="[a-z0-9-]+" required/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={quizStage} onChange={e=>setQuizStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'اختبار عام'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type">{(types[quizStage]||['']).map(x=><option key={x} value={x}>{x||'الكل'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade">{(grades[quizStage]||['']).map(x=><option key={x} value={x}>{x||'كل الصفوف'}</option>)}</select></div><div className="field"><label>المدة بالدقائق</label><input className="input" type="number" name="duration_minutes" defaultValue="30" min="1" max="240"/></div><div className="field"><label>نسبة النجاح %</label><input className="input" type="number" name="passing_score" defaultValue="60" min="0" max="100"/></div><div className="field"><label>عدد المحاولات</label><input className="input" type="number" name="max_attempts" defaultValue="2" min="1" max="20"/></div><div className="field"><label>يفتح في</label><input className="input" type="datetime-local" name="starts_at"/></div><div className="field"><label>يقفل في</label><input className="input" type="datetime-local" name="ends_at"/></div><div className="field"><label>وصف قصير</label><input className="input" name="description_ar"/></div><label className="checkbox-row"><input type="checkbox" name="randomize_questions"/> ترتيب الأسئلة عشوائي</label><label className="checkbox-row"><input type="checkbox" name="show_result_immediately" defaultChecked/> إظهار النتيجة فورًا بعد التسليم</label></div><button className="btn btn-dark" disabled={actionBusy}>حفظ كمسودة</button></form><div className="card admin-panel"><span className="eyebrow">2. بنك الأسئلة</span><h2>إضافة وإدارة الأسئلة</h2><div className="field"><label>اختر الاختبار</label><select className="input" value={selectedQuiz} onChange={e=>loadQuizDetails(Number(e.target.value)||'')}><option value="">اختر اختبار</option>{quizzes.map(q=><option key={q.id} value={q.id}>{q.title_ar} ({q.questions} سؤال في البنك)</option>)}</select></div>{selected&&<>{quizDetails&&<form className="quiz-settings-inline" key={`settings-${selectedQuiz}`} onSubmit={saveQuizSettings}><h3>إعدادات الاختبار</h3><div className="form-grid"><div className="field"><label>الاسم</label><input className="input" name="title_ar" defaultValue={quizDetails.title_ar} required/></div><div className="field"><label>المدة بالدقائق</label><input className="input" type="number" min="1" max="240" name="duration_minutes" defaultValue={quizDetails.duration_minutes}/></div><div className="field"><label>نسبة النجاح %</label><input className="input" type="number" min="0" max="100" name="passing_score" defaultValue={quizDetails.passing_score}/></div><div className="field"><label>عدد المحاولات</label><input className="input" type="number" min="1" max="20" name="max_attempts" defaultValue={quizDetails.max_attempts}/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" defaultValue={quizDetails.stage||''}>{stages.map(x=><option key={x} value={x}>{x||'اختبار عام'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type" defaultValue={quizDetails.education_type||''}>{(types[quizDetails.stage||'']||['']).map(x=><option key={x} value={x}>{x||'الكل'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade" defaultValue={quizDetails.grade||''}>{(grades[quizDetails.stage||'']||['']).map(x=><option key={x} value={x}>{x||'كل الصفوف'}</option>)}</select></div><div className="field"><label>يفتح في</label><input className="input" type="datetime-local" name="starts_at" defaultValue={dateTimeInput(quizDetails.starts_at)}/></div><div className="field"><label>يقفل في</label><input className="input" type="datetime-local" name="ends_at" defaultValue={dateTimeInput(quizDetails.ends_at)}/></div><div className="field field-span"><label>الوصف</label><textarea className="input" name="description_ar" rows={2} defaultValue={quizDetails.description_ar||''}/></div><label className="checkbox-row"><input type="checkbox" name="randomize_questions" defaultChecked={quizDetails.randomize_questions}/> عشوائية الأسئلة</label><label className="checkbox-row"><input type="checkbox" name="show_result_immediately" defaultChecked={quizDetails.show_result_immediately}/> إظهار النتيجة فورًا</label></div><button className="btn btn-dark" disabled={actionBusy}>حفظ إعدادات الاختبار</button></form>}{quizDetails?.is_placement&&<div className="notice success" style={{marginTop:14}}>اختبار تحديد المستوى عشوائي تلقائيًا: كل محاولة تعرض {quizDetails.questions_per_attempt} سؤالًا من بنك فيه {quizDetails.question_pool_count} سؤال. لو زوّدت أسئلة للبنك، الطالب يفضل ياخد 50 سؤال عشوائي فقط.</div>}<form onSubmit={addQuestion} style={{marginTop:16}}><div className="form-grid"><div className="field field-span"><label>السؤال</label><textarea className="input" name="prompt" required/></div><div className="field"><label>نوع السؤال</label><select className="input" value={qType} onChange={e=>setQType(e.target.value)}><option value="mcq">اختيار من متعدد</option><option value="true_false">صح / خطأ</option><option value="short">إجابة قصيرة</option><option value="essay">مقالي</option></select></div><div className="field"><label>الترتيب</label><input className="input" name="position" type="number" defaultValue={quizDetails?Math.max(0,...quizDetails.questions.map(q=>q.position))+1:selected.questions+1} min="1"/></div><div className="field"><label>الدرجة</label><input className="input" name="points" type="number" defaultValue="1" min="1" max="20"/></div><div className="field"><label>المستوى</label><select className="input" name="level"><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option></select></div>{(qType==='mcq'||qType==='true_false')&&<>{[1,2,3,4].map(i=><div className="field" key={i}><label>اختيار {i}</label><input className="input" name={`choice${i}`} required={i<=2}/></div>)}<div className="field"><label>رقم الإجابة الصحيحة</label><select className="input" name="correct"><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div></>}{qType==='short'&&<div className="field"><label>الإجابة النموذجية</label><input className="input" name="expected_answer" required/></div>}<div className="field field-span"><label>شرح اختياري</label><textarea className="input" name="explanation"/></div></div><button className="btn btn-primary" disabled={actionBusy}>إضافة السؤال</button></form>{quizDetails&&<div style={{marginTop:24}}><div className="panel-head"><div><h3>الأسئلة الحالية</h3><p>{quizDetails.question_pool_count} سؤال في بنك الأسئلة</p></div></div><div className="mobile-list" style={{maxHeight:560,overflowY:'auto'}}>{quizDetails.questions.map(question=><div className="admin-list-item stacked" key={question.id}><div><b>#{question.position} · {question.level} · {question.prompt}</b><span>{question.question_type==='mcq'?'اختيار من متعدد':question.question_type==='true_false'?'صح / خطأ':question.question_type==='short'?'إجابة قصيرة':'مقالي'} · {question.points} درجة</span>{question.choices.length>0&&<p>{question.choices.map(c=>`${c.is_correct?'✓ ':''}${c.text}`).join(' — ')}</p>}</div><div className="row-actions"><button className="btn" onClick={()=>{setEditingQuestion(question);setEditQType(question.question_type)}}>تعديل</button><button className="btn btn-danger" onClick={()=>deleteQuestion(question)}>حذف</button></div></div>)}</div></div>}{editingQuestion&&<form className="card" style={{marginTop:20,padding:18}} onSubmit={saveQuestionEdit}><div className="panel-head"><div><span className="eyebrow">تعديل السؤال #{editingQuestion.position}</span><h3>عدّل البيانات ثم احفظ</h3></div><button type="button" className="btn" onClick={()=>setEditingQuestion(null)}>إلغاء</button></div><div className="form-grid"><div className="field field-span"><label>السؤال</label><textarea className="input" name="prompt" defaultValue={editingQuestion.prompt} required/></div><div className="field"><label>نوع السؤال</label><select className="input" name="question_type" value={editQType} onChange={e=>setEditQType(e.target.value)}><option value="mcq">اختيار من متعدد</option><option value="true_false">صح / خطأ</option><option value="short">إجابة قصيرة</option><option value="essay">مقالي</option></select></div><div className="field"><label>الترتيب</label><input className="input" name="position" type="number" defaultValue={editingQuestion.position} min="1"/></div><div className="field"><label>الدرجة</label><input className="input" name="points" type="number" defaultValue={editingQuestion.points} min="1" max="20"/></div><div className="field"><label>المستوى</label><select className="input" name="level" defaultValue={editingQuestion.level}><option>A1</option><option>A2</option><option>B1</option><option>B2</option><option>C1</option></select></div>{(editQType==='mcq'||editQType==='true_false')&&<>{[1,2,3,4].map(i=><div className="field" key={i}><label>اختيار {i}</label><input className="input" name={`edit_choice${i}`} defaultValue={editingQuestion.choices[i-1]?.text||''} required={i<=2}/></div>)}<div className="field"><label>رقم الإجابة الصحيحة</label><select className="input" name="edit_correct" defaultValue={String(Math.max(1,editingQuestion.choices.findIndex(c=>c.is_correct)+1))}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></div></>}{editQType==='short'&&<div className="field"><label>الإجابة النموذجية</label><input className="input" name="expected_answer" defaultValue={editingQuestion.expected_answer||''} required/></div>}<div className="field field-span"><label>شرح اختياري</label><textarea className="input" name="explanation" defaultValue={editingQuestion.explanation}/></div></div><button className="btn btn-dark" disabled={actionBusy}>حفظ التعديل</button></form>}</>}</div><div className="card admin-panel"><h2>الاختبارات الحالية</h2><div className="mobile-list">{quizzes.map(q=><div className="admin-list-item" key={q.id}><div><b>{q.title_ar}{q.is_placement?' · تحديد مستوى':''}</b><span>{[q.stage,q.education_type,q.grade].filter(Boolean).join(' · ')||'عام'} · {q.questions} سؤال في البنك · {q.duration_minutes} دقيقة{q.is_placement?' · 50 سؤال عشوائي لكل محاولة':q.randomize_questions?' · عشوائي':''}</span></div><div className="row-actions"><button className="btn" onClick={()=>loadQuizDetails(q.id)}>إدارة الأسئلة</button><button className="btn btn-primary" onClick={()=>togglePublish(q)}>{q.published?'إلغاء النشر':'نشر'}</button><button className="btn btn-danger" onClick={()=>archiveQuiz(q)}>أرشفة</button></div></div>)}</div></div></>}

        {tab==='notifications'&&<><form className="card admin-panel" onSubmit={addNotification}><span className="eyebrow">الإشعارات</span><h2>إرسال إشعار للطلاب</h2><div className="form-grid"><div className="field"><label>العنوان</label><input className="input" name="title" required/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={noteStage} onChange={e=>setNoteStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'كل المراحل'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type">{(types[noteStage]||['']).map(x=><option key={x} value={x}>{x||'الكل'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade">{(grades[noteStage]||['']).map(x=><option key={x} value={x}>{x||'كل الصفوف'}</option>)}</select></div><div className="field field-span"><label>الرسالة</label><textarea className="input" rows={4} name="body" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>إرسال الإشعار</button></form><div className="card admin-panel"><h2>آخر الإشعارات</h2><div className="mobile-list">{adminNotes.map(n=><div className="admin-list-item stacked" key={n.id}><div><b>{n.title}</b><span>{[n.stage,n.education_type,n.grade].filter(Boolean).join(' · ')||'لكل الطلاب'} · {n.active?'نشط':'مخفي'}</span><p>{n.body}</p></div><div className="row-actions"><button className="btn" onClick={()=>toggleNotification(n)}>{n.active?'إخفاء':'تفعيل'}</button><button className="btn btn-danger" onClick={()=>deleteNotification(n)}>حذف</button></div></div>)}</div></div></>}

        {tab==='assistant'&&<><form className="card admin-panel" onSubmit={addKnowledge}><span className="eyebrow">قاعدة معرفة المساعد</span><h2>أضف سؤال وإجابته المعتمدة</h2><p>المواعيد والعنوان وأرقام التواصل تُقرأ مباشرة من إعدادات الموقع؛ تعديلها ينعكس على الشات فورًا.</p><div className="form-grid"><div className="field"><label>القسم</label><input className="input" name="category" placeholder="مواعيد / أسعار / حجز" required/></div><div className="field"><label>كلمات مفتاحية</label><input className="input" name="keywords" placeholder="ميعاد مواعيد الساعة"/></div><div className="field field-span"><label>السؤال</label><input className="input" name="question" required/></div><div className="field field-span"><label>الإجابة</label><textarea className="input" rows={4} name="answer" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>إضافة للمساعد</button></form><div className="card admin-panel"><h2>المعلومات الحالية</h2><div className="mobile-list">{knowledge.map(k=><div className="admin-list-item stacked" key={k.id}><div><span className="eyebrow">{k.category}</span><b>{k.question}</b><p>{k.answer}</p><span>{k.active?'مفعلة':'معطلة'}</span></div><div className="row-actions"><button className="btn" onClick={()=>editKnowledge(k)}>تعديل الإجابة</button><button className="btn" onClick={()=>toggleKnowledge(k)}>{k.active?'تعطيل':'تفعيل'}</button><button className="btn btn-danger" onClick={()=>deleteKnowledge(k)}>حذف</button></div></div>)}</div></div></>}

        {tab==='reviews'&&<><div className="card admin-panel"><h2>التقييمات</h2><div className="mobile-list">{reviews.length===0?<p>لا توجد تقييمات حتى الآن.</p>:reviews.map(r=><div className="admin-list-item stacked" key={r.id}><div><b>{r.name} · {r.rating}/5</b><span>{r.stage} · {r.status}</span><p>{r.body}</p></div><div className="row-actions"><button className="btn btn-primary" onClick={()=>moderate(r.id,'approved')}>نشر</button><button className="btn" onClick={()=>moderate(r.id,'pending')}>إرجاع للمراجعة</button><button className="btn btn-danger" onClick={()=>moderate(r.id,'hidden')}>إخفاء</button><button className="btn btn-danger" onClick={()=>deleteReview(r.id)}>حذف</button></div></div>)}</div></div><div className="card admin-panel"><h2>رسائل التواصل</h2><div className="mobile-list">{messages.length===0?<p>لا توجد رسائل.</p>:messages.map(m=><div className="admin-list-item stacked" key={m.id}><div><b>{m.name} · {m.phone}</b><span>{m.status==='new'?'جديدة':m.status==='followed_up'?'تمت المتابعة':'مغلقة'}</span><p>{m.message}</p></div><div className="row-actions"><a className="btn" href={whatsappUrl(m.phone)} target="_blank" rel="noreferrer">واتساب</a><button className="btn" onClick={()=>updateMessage(m.id,'followed_up')}>تمت المتابعة</button><button className="btn" onClick={()=>updateMessage(m.id,'closed')}>إغلاق</button></div></div>)}</div></div></>}

        {tab==='site'&&<><div className="card admin-panel"><div className="panel-head"><div><span className="eyebrow">حالة الموقع</span><h2>{settings.maintenance_mode==='true'?'الموقع في وضع الصيانة':'الموقع متاح للزوار'}</h2></div><button className={`btn ${settings.maintenance_mode==='true'?'btn-primary':'btn-danger'}`} onClick={toggleMaintenance}>{settings.maintenance_mode==='true'?'تشغيل الموقع':'وضع الصيانة'}</button></div></div><form className="card admin-panel" onSubmit={saveSettings}><h2>بيانات الموقع</h2><div className="form-grid"><div className="field"><label>رقم الهاتف الأساسي</label><input className="input" name="primary_phone" defaultValue={settings.primary_phone||''}/></div><div className="field"><label>رقم إضافي</label><input className="input" name="secondary_phone" defaultValue={settings.secondary_phone||''}/></div><div className="field"><label>واتساب</label><input className="input" name="whatsapp" defaultValue={settings.whatsapp||''}/></div><div className="field"><label>البريد</label><input className="input" type="email" name="contact_email" defaultValue={settings.contact_email||''}/></div><div className="field field-span"><label>مواعيد السنتر</label><input className="input" name="center_hours" defaultValue={settings.center_hours||''}/></div><div className="field field-span"><label>العنوان</label><textarea className="input" name="center_address" defaultValue={settings.center_address||''}/></div><div className="field field-span"><label>رسالة الصيانة</label><textarea className="input" name="maintenance_message" defaultValue={settings.maintenance_message||''}/></div></div><h3>المراحل المتاحة للتسجيل</h3><div className="row-actions"><label className="checkbox-row"><input type="checkbox" name="stage_prep_enabled" defaultChecked={settings.stage_prep_enabled==='true'}/> إعدادي</label><label className="checkbox-row"><input type="checkbox" name="stage_secondary_enabled" defaultChecked={settings.stage_secondary_enabled==='true'}/> ثانوي</label><label className="checkbox-row"><input type="checkbox" name="stage_adults_enabled" defaultChecked={settings.stage_adults_enabled==='true'}/> كورسات للكبار</label></div><button className="btn btn-dark" disabled={actionBusy}>حفظ الإعدادات</button></form></>}

        {tab==='pages'&&<><form className="card admin-panel" onSubmit={addPage}><h2>إنشاء صفحة جديدة</h2><div className="form-grid"><div className="field"><label>العنوان</label><input className="input" name="title" required/></div><div className="field"><label>Slug إنجليزي</label><input className="input" name="slug" pattern="[a-z0-9-]+" required/></div><div className="field field-span"><label>المحتوى</label><textarea className="input" rows={5} name="body" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>إنشاء الصفحة</button></form><div className="card admin-panel"><h2>الصفحات الحالية</h2><div className="mobile-list">{pages.map(p=><div className="admin-list-item" key={p.id}><div><b>{p.title}</b><span>{p.path} · ترتيب {p.sort_order} · {p.is_visible?'ظاهرة':'مخفية'}</span></div><div className="row-actions"><button className="btn" onClick={()=>editPageContent(p)}>تعديل المحتوى</button><button className="btn" onClick={()=>editPageOrder(p)}>الترتيب</button><button className="btn" onClick={()=>rollbackPage(p)}>رجوع لنسخة</button><button className="btn" onClick={()=>togglePage(p)}>{p.is_visible?'إخفاء':'إظهار'}</button>{!p.is_system&&<button className="btn btn-danger" onClick={()=>archivePage(p)}>أرشفة</button>}</div></div>)}</div></div></>}

        {tab==='admins'&&<><div className="card admin-panel"><h2>الأدمنز</h2><div className="mobile-list">{admins.map(a=><div className="admin-list-item" key={a.id}><div><b>{a.name}</b><span>{a.email} · {a.role}</span></div><span className={`status-chip ${a.active?'ok':'off'}`}>{a.active?'نشط':'موقوف'}</span></div>)}</div></div>{meRole==='owner'&&<form className="card admin-panel" onSubmit={inviteAdmin}><h2>دعوة Admin جديد</h2><div className="field"><label>الإيميل</label><input className="input" type="email" name="email" required/></div><button className="btn btn-dark" style={{marginTop:12}} disabled={actionBusy}>إنشاء الدعوة</button>{inviteLink&&<div className="invite-box"><b>رابط الدعوة:</b><input className="input" readOnly value={inviteLink}/></div>}</form>}<form className="card admin-panel" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const f=new FormData(form);if(f.get('new_password')!==f.get('confirm_password')){setError('كلمتا المرور الجديدتان غير متطابقتين.');return}if(!confirm('تأكيد تغيير كلمة مرور الإدارة؟ ستحتاج لتسجيل الدخول من جديد.'))return;await run(async()=>{await api('/auth/change-password',{method:'POST',body:JSON.stringify({current_password:f.get('current_password'),new_password:f.get('new_password')})});form.reset();router.replace('/admin/login')},'تم تغيير كلمة المرور.');}}><h2>تغيير كلمة المرور</h2><div className="form-grid"><div className="field"><label>كلمة المرور الحالية</label><input className="input" type="password" name="current_password" required/></div><div className="field"><label>كلمة المرور الجديدة</label><input className="input" type="password" name="new_password" required/></div><div className="field"><label>تأكيد الجديدة</label><input className="input" type="password" name="confirm_password" required/></div></div><button className="btn btn-dark" disabled={actionBusy}>تغيير كلمة المرور</button></form></>}


        {tab==='months'&&<><form className="card admin-panel" onSubmit={createMonth}><span className="eyebrow">المسار الدراسي</span><h2>إضافة شهر / وحدة</h2><div className="form-grid"><div className="field"><label>اسم الشهر أو الوحدة</label><input className="input" name="title" placeholder="أكتوبر 2026" required/></div><div className="field"><label>الترتيب</label><input className="input" type="number" name="sort_order" defaultValue="10"/></div><div className="field"><label>المرحلة</label><select className="input" name="stage" value={monthStage} onChange={e=>setMonthStage(e.target.value)}>{stages.map(x=><option key={x} value={x}>{x||'كل المراحل'}</option>)}</select></div><div className="field"><label>نوع التعليم</label><select className="input" name="education_type">{(types[monthStage]||['']).map(x=><option key={x} value={x}>{x||'الكل'}</option>)}</select></div><div className="field"><label>الصف</label><select className="input" name="grade">{(grades[monthStage]||['']).map(x=><option key={x} value={x}>{x||'كل الصفوف'}</option>)}</select></div><div className="field"><label>يبدأ من (اختياري)</label><input className="input" type="datetime-local" name="starts_at"/></div><div className="field"><label>ينتهي في (اختياري)</label><input className="input" type="datetime-local" name="ends_at"/></div></div><button className="btn btn-dark" disabled={actionBusy}>إضافة الشهر</button></form><form className="card admin-panel" onSubmit={savePathConfig}><span className="eyebrow">ربط الاختبارات</span><h2>ضع اختبار داخل المسار</h2><div className="form-grid"><div className="field"><label>الاختبار</label><select className="input" name="quiz_id" required><option value="">اختر اختبار</option>{quizzes.filter(q=>!q.is_placement).map(q=><option value={q.id} key={q.id}>{q.title_ar}</option>)}</select></div><div className="field"><label>الشهر</label><select className="input" name="month_id" required><option value="">اختر شهر</option>{months.map(m=><option value={m.id} key={m.id}>{m.title}</option>)}</select></div><div className="field"><label>عنوان الأسبوع</label><input className="input" name="week_label" placeholder="الأسبوع الأول"/></div><div className="field"><label>الترتيب</label><input className="input" type="number" name="sort_order" defaultValue="10"/></div><div className="field"><label>أقل نسبة لفتح التالي</label><input className="input" type="number" min="0" max="100" name="min_previous_score" defaultValue="60"/></div><div className="field"><label>اختبار شرط محدد (اختياري)</label><select className="input" name="unlock_after_quiz_id"><option value="">استخدم الترتيب العادي</option>{quizzes.filter(q=>!q.is_placement).map(q=><option value={q.id} key={`pre-${q.id}`}>{q.title_ar}</option>)}</select></div><label className="checkbox-row"><input type="checkbox" name="requires_previous"/> لا يفتح إلا بعد نجاح الاختبار السابق في نفس الشهر</label></div><button className="btn btn-dark" disabled={actionBusy}>حفظ في المسار</button></form><div className="card admin-panel"><div className="panel-head"><div><h2>الشهور الحالية</h2><p>الطالب هيشوف فقط الشهور والاختبارات المناسبة لمرحلته وصفه.</p></div><button className="btn" onClick={()=>loadTab('months')}>تحديث</button></div><div className="mobile-list">{months.length===0?<p>مفيش شهور مضافة لسه.</p>:months.map(m=><div className="admin-list-item stacked" key={m.id}><div><b>{m.title}</b><span>{[m.stage,m.education_type,m.grade].filter(Boolean).join(' · ')||'لكل الطلاب'} · ترتيب {m.sort_order} · {m.quiz_count} اختبار · {m.is_visible?'ظاهر':'مخفي'}</span>{(m.starts_at||m.ends_at)&&<small>{m.starts_at?`من ${new Date(m.starts_at).toLocaleString('ar-EG')}`:''}{m.ends_at?` · حتى ${new Date(m.ends_at).toLocaleString('ar-EG')}`:''}</small>}{pathConfigs.filter(p=>p.month_id===m.id).map(p=><small key={p.quiz_id}>{p.sort_order}. {p.quiz}{p.requires_previous?' 🔒':''}</small>)}</div><div className="row-actions"><button className="btn" onClick={()=>editMonth(m)}>تعديل/ترتيب</button><button className="btn" onClick={()=>toggleMonth(m)}>{m.is_visible?'إخفاء':'إظهار'}</button><button className="btn btn-danger" onClick={()=>removeMonth(m)}>حذف من المسار</button></div></div>)}</div></div></>}

        {tab==='analytics'&&<><div className="admin-title"><div><span className="eyebrow">Analytics</span><h1 className="section-title">الزيارات والمتابعة</h1></div><button className="btn" onClick={()=>loadTab('analytics')}>تحديث</button></div><div className="admin-grid"><div className="card stat"><span>إجمالي الزيارات</span><b>{analytics?.total??0}</b></div><div className="card stat"><span>متصلون الآن</span><b>{analytics?.online_now??0}</b></div><div className="card stat"><span>صفحات عليها زيارات</span><b>{analytics?.by_page.length??0}</b></div><div className="card stat"><span>أسئلة للمساعد</span><b>{assistantQuestions.reduce((a,b)=>a+b.count,0)}</b></div></div><div className="two-col-dashboard"><div className="card admin-panel"><h2>الزيارات حسب الصفحة</h2><div className="mobile-list">{(analytics?.by_page||[]).slice(0,20).map(x=><div className="admin-list-item" key={x.path}><b dir="ltr">{x.path}</b><span>{x.count} زيارة</span></div>)}</div></div><div className="card admin-panel"><h2>الموجودون / آخر ظهور</h2><div className="mobile-list">{presence.slice(0,30).map(x=><div className="admin-list-item" key={x.user_id}><div><b>{x.name}</b><span>{x.online?'🟢 متصل الآن':'آخر ظهور '+new Date(x.last_seen).toLocaleString('ar-EG')}</span></div><small dir="ltr">{x.path}</small></div>)}</div></div></div><div className="card admin-panel"><h2>أصعب أسئلة الاختبارات</h2><p>مرتبة حسب أقل نسبة إجابات صحيحة.</p><div className="mobile-list">{questionAnalytics.slice(0,20).map(x=><div className="admin-list-item" key={x.question_id}><div><b>{x.question}</b><span>{x.quiz} · {x.answers} إجابة</span></div><b>{x.accuracy==null?'—':`${x.accuracy}%`}</b></div>)}</div></div><div className="card admin-panel"><h2>أكثر أسئلة الطلاب للمساعد</h2><div className="mobile-list">{assistantQuestions.slice(0,20).map((x,i)=><div className="admin-list-item" key={i}><div><b>{x.question}</b><span>{x.source}</span></div><b>{x.count}</b></div>)}</div></div></>}

        {tab==='security'&&meRole==='owner'&&<><div className="admin-title"><div><span className="eyebrow">Owner Security</span><h1 className="section-title">الأمان والصلاحيات</h1></div><button className="btn" onClick={()=>loadTab('security')}>تحديث</button></div><form className="card admin-panel" onSubmit={addAuthorizedAdmin}><h2>إضافة إيميل أدمن معتمد</h2><p>الأدمن يقدر يطلب كود 6 أرقام على الإيميل ويدخل من صفحة الإدارة.</p><div className="form-grid"><div className="field"><label>الإيميل</label><input className="input" type="email" name="email" required/></div><div className="field"><label>الصلاحية</label><select className="input" name="role"><option value="admin">Admin</option><option value="owner">Owner</option></select></div></div><button className="btn btn-dark">اعتماد الإيميل</button></form><div className="card admin-panel"><h2>الإيميلات المعتمدة</h2><div className="mobile-list">{authorizedAdmins.map(a=><div className="admin-list-item" key={a.id}><div><b dir="ltr">{a.email}</b><span>{a.role} · {a.active?'مسموح':'موقوف'} · {a.user_id?'الحساب جاهز':'هيتعمل عند أول دخول بالكود'}</span></div><div className="row-actions">{a.user_id&&a.role!=='owner'&&<button className="btn" onClick={()=>openAdminPermissions(a)}>الصلاحيات</button>}{a.active&&<button className="btn btn-danger" onClick={()=>disableAuthorizedAdmin(a)}>إيقاف</button>}</div></div>)}</div></div>{permissionTarget&&<div className="card admin-panel permission-editor"><div className="panel-head"><div><h2>صلاحيات {permissionTarget.email}</h2><p>اختار الأقسام اللي الأدمن يقدر يدخلها ويعدّل فيها.</p></div><button className="btn" onClick={()=>setPermissionTarget(null)}>إغلاق</button></div><div className="permission-grid">{permissionOptions.map(([key,label])=><label className="checkbox-row" key={key}><input type="checkbox" checked={permissionDraft.includes(key)} onChange={e=>setPermissionDraft(current=>e.target.checked?[...new Set([...current,key])]:current.filter(x=>x!==key))}/>{label}</label>)}</div><div className="row-actions"><button className="btn btn-dark" onClick={saveAdminPermissions} disabled={actionBusy}>حفظ الصلاحيات</button><button className="btn" onClick={()=>setPermissionDraft(permissionOptions.map(x=>x[0]))}>تحديد الكل</button><button className="btn" onClick={()=>setPermissionDraft([])}>إلغاء الكل</button></div></div>}<form className="card admin-panel" onSubmit={setupPin}><h2>PIN الدخول الخاص بحسابك</h2><p>6 أرقام فقط، ويتخزن بصورة مشفرة. متبعتوش في الشات.</p><div className="form-grid"><div className="field"><label>PIN جديد</label><input className="input" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} name="pin" required/></div><div className="field"><label>تأكيد PIN</label><input className="input" type="password" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} name="confirm_pin" required/></div></div><button className="btn btn-dark">حفظ PIN</button></form><div className="card admin-panel"><h2>الجلسات المفتوحة</h2><div className="mobile-list">{sessions.map(s=><div className="admin-list-item" key={s.user_id}><div><b>{s.name}</b><span dir="ltr">{s.email} · {s.active_sessions} جلسة</span></div><button className="btn btn-danger" onClick={()=>revokeSessions(s.user_id)}>تسجيل خروج من كل الأجهزة</button></div>)}</div></div></>}

        {tab==='system'&&meRole==='owner'&&<><div className="admin-title"><div><span className="eyebrow">System Center</span><h1 className="section-title">حالة النظام والنسخ</h1></div><button className="btn" onClick={()=>loadTab('system')}>تحديث</button></div><div className="admin-grid"><div className="card stat"><span>Backend</span><b>{systemStatus?.backend==='ok'?'✅':'—'}</b></div><div className="card stat"><span>Database</span><b>{systemStatus?.database==='ok'?'✅':'—'}</b></div><div className="card stat"><span>Gemini</span><b>{systemStatus?.gemini_configured?'✅':'⚠️'}</b></div><div className="card stat"><span>Email OTP</span><b>{systemStatus?.email_configured?'✅':'⚠️'}</b></div></div><div className="card admin-panel"><h2>Backup آمن</h2><p>النسخة تشمل الإعدادات والصفحات والاختبارات والطلاب والنتائج ومعرفة المساعد، ولا تحتوي كلمات السر أو Tokens أو API keys. احتفظ بالملف في مكان آمن لأنه يحتوي بيانات الطلاب.</p><div className="row-actions"><a className="btn btn-primary" href="/api/v1/admin/backup/export.json">تحميل Backup</a><label className="btn">استعادة Backup<input type="file" accept="application/json" hidden onChange={e=>restoreBackup(e.target.files?.[0])}/></label></div></div><div className="card admin-panel"><h2>Excel الطلاب</h2><div className="row-actions"><a className="btn btn-primary" href="/api/v1/admin/exports/users.xlsx">تصدير الطلاب</a><a className="btn" href="/api/v1/admin/imports/users-template.xlsx">تحميل قالب الاستيراد</a><label className="btn">استيراد طلاب<input type="file" accept=".xlsx" hidden onChange={e=>importStudents(e.target.files?.[0])}/></label></div></div><div className="card admin-panel"><h2>المحذوفات / الأرشيف</h2><div className="mobile-list">{trash.quizzes.map(x=><div className="admin-list-item" key={`q${x.id}`}><div><b>{x.title}</b><span>اختبار مؤرشف</span></div><button className="btn" onClick={()=>restoreTrash('quizzes',x.id)}>استعادة</button></div>)}{trash.pages.map(x=><div className="admin-list-item" key={`p${x.id}`}><div><b>{x.title}</b><span>صفحة مؤرشفة</span></div><button className="btn" onClick={()=>restoreTrash('pages',x.id)}>استعادة</button></div>)}{trash.students.map(x=><div className="admin-list-item" key={`s${x.id}`}><div><b>{x.title}</b><span>{x.email} · طالب في المحذوفات ونتائجه محفوظة</span></div><button className="btn" onClick={()=>restoreTrash('students',x.id)}>استعادة</button></div>)}{!trash.quizzes.length&&!trash.pages.length&&!trash.students.length&&<p>مفيش عناصر مؤرشفة.</p>}</div></div></>}

        {tab==='audit'&&meRole==='owner'&&<div className="card admin-panel"><div className="panel-head"><div><span className="eyebrow">Owner only</span><h2>سجل النشاط</h2><p>مين عدّل إيه وإمتى، مع تفاصيل قبل/بعد لما تكون متاحة.</p></div><button className="btn" onClick={()=>loadTab('audit')}>تحديث</button></div><div className="mobile-list">{auditItems.map(item=><div className="admin-list-item stacked" key={item.id}><div><b>{item.action}</b><span>{item.entity}{item.entity_id?` #${item.entity_id}`:''} · {item.actor_name||`Admin #${item.actor??'system'}`}{item.actor_email?` · ${item.actor_email}`:''}</span>{auditDetails(item.metadata)&&<small className="audit-details">{auditDetails(item.metadata)}</small>}</div><span>{new Date(item.created_at).toLocaleString('ar-EG')}</span></div>)}</div></div>}
      </section>
    </div>
  </main>;
}
