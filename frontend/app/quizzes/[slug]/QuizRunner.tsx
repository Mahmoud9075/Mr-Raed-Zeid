'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

type Choice = { id:number; text:string; position:number };
type Question = { id:number; prompt:string; level:string; position:number; question_type:'mcq'|'true_false'|'short'|'essay'; choices:Choice[] };
type SavedAnswer = { question_id:number; choice_id?:number|null; text_answer?:string|null };
type Start = { attempt_id:number; quiz:{title_ar:string;duration_minutes:number;question_count:number}; questions:Question[]; remaining_seconds:number; resumed:boolean; saved_answers:SavedAnswer[] };
type Result = { score:number; correct_answers:number; total_questions:number; level_result?:string; needs_manual_review:boolean };
type Answer = { choice_id?:number; text_answer?:string };

function formatTime(total: number) {
  const safe = Math.max(0, total);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function mapSaved(items: SavedAnswer[]) {
  const result: Record<number, Answer> = {};
  for (const item of items || []) {
    result[item.question_id] = {
      ...(item.choice_id ? { choice_id: item.choice_id } : {}),
      ...(item.text_answer ? { text_answer: item.text_answer } : {})
    };
  }
  return result;
}

export default function QuizRunner({slug}:{slug:string}) {
  const [data,setData] = useState<Start|null>(null);
  const [index,setIndex] = useState(0);
  const [answers,setAnswers] = useState<Record<number,Answer>>({});
  const [error,setError] = useState('');
  const [saveState,setSaveState] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [result,setResult] = useState<Result|null>(null);
  const [busy,setBusy] = useState(false);
  const [remaining,setRemaining] = useState<number|null>(null);
  const autosaveReady = useRef(false);
  const timeoutSubmitted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError('');
    api<Start>(`/quizzes/${slug}/start`,{method:'POST'})
      .then((start) => {
        if (cancelled) return;
        setData(start);
        setAnswers(mapSaved(start.saved_answers));
        setRemaining(start.remaining_seconds);
        autosaveReady.current = true;
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'تعذر بدء الاختبار'))
      .finally(() => !cancelled && setBusy(false));
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (remaining === null || remaining <= 0 || result) return;
    const timer = window.setTimeout(() => setRemaining((value) => value === null ? null : Math.max(0,value-1)), 1000);
    return () => window.clearTimeout(timer);
  }, [remaining,result]);

  const expired = remaining === 0;

  useEffect(() => {
    if (!data || !autosaveReady.current || result || expired) return;
    const entries = Object.entries(answers);
    if (!entries.length) return;
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      try {
        const payload = {
          answers: entries.map(([question_id,a]) => ({
            question_id:Number(question_id),
            choice_id:a.choice_id ?? null,
            text_answer:a.text_answer ?? null
          }))
        };
        const response = await api<{saved:boolean;remaining_seconds:number}>(`/quizzes/attempts/${data.attempt_id}/answers`, {
          method:'PUT',
          body:JSON.stringify(payload)
        });
        if (typeof response.remaining_seconds === 'number') {
          setRemaining((current) => current === null ? response.remaining_seconds : Math.min(current,response.remaining_seconds));
        }
        setSaveState('saved');
      } catch (e) {
        setSaveState('error');
        const message = e instanceof Error ? e.message : '';
        if (message.includes('انتهى وقت الاختبار')) setRemaining(0);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [answers,data,result,expired]);

  const q = data?.questions[index];
  const percent = useMemo(() => data ? Math.round(((index+1)/data.questions.length)*100) : 0, [data,index]);

  function answered(question?:Question) {
    if (!question) return false;
    const answer = answers[question.id];
    if (!answer) return false;
    return question.question_type === 'mcq' || question.question_type === 'true_false'
      ? !!answer.choice_id
      : !!answer.text_answer?.trim();
  }

  function payloadFromAnswers() {
    return {
      answers:(Object.entries(answers) as [string,Answer][]).map(([question_id,a]) => ({
        question_id:Number(question_id),
        choice_id:a.choice_id ?? null,
        text_answer:a.text_answer ?? null
      }))
    };
  }

  async function finish(forceExpired = false) {
    if (!data || busy || result) return;
    setBusy(true);
    setError('');
    try {
      const r = await api<Result>(`/quizzes/attempts/${data.attempt_id}/submit`, {
        method:'POST',
        body:JSON.stringify(forceExpired ? {answers:[]} : payloadFromAnswers())
      });
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر التسليم');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (expired && data && !result && !timeoutSubmitted.current) {
      timeoutSubmitted.current = true;
      finish(true);
    }
  // finish is intentionally triggered only when the timer reaches zero.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired,data,result]);

  if (error.includes('تسجيل الدخول') || error.includes('جلسة')) {
    return <div className="card" style={{padding:28,textAlign:'center'}}><h2>سجّل دخولك أولًا</h2><p>لازم تدخل بحساب الطالب قبل بدء الاختبار حتى نحفظ نتيجتك.</p><Link className="btn btn-dark" href="/login">تسجيل الدخول</Link></div>;
  }
  if (error && !data) return <div className="notice error">{error}</div>;
  if (!data || busy && !q) return <div className="card loading-card">جاري تجهيز الاختبار...</div>;
  if (result) return <div className="card question-card result-card"><span className="eyebrow">تم التسليم والحفظ</span><h1 className="section-title">نتيجتك {result.score}%</h1><p>إجابات صحيحة تلقائيًا: {result.correct_answers} من {result.total_questions}</p>{result.level_result&&<h2>المستوى المبدئي: {result.level_result}</h2>}{result.needs_manual_review&&<p className="notice">فيه سؤال مقالي محتاج مراجعة من المستر، فالدرجة الحالية مبدئية.</p>}<div className="result-actions"><Link className="btn btn-dark" href="/student">لوحة الطالب</Link><Link className="btn" href="/quizzes">الاختبارات</Link></div></div>;

  return <>
    <div className="card quiz-head">
      <div className="quiz-head-row"><div><b>{data.quiz.title_ar}</b>{data.resumed&&<small style={{display:'block',marginTop:4}}>تم استكمال محاولتك السابقة تلقائيًا</small>}</div><div className="quiz-head-stats"><span>{index+1} / {data.questions.length}</span>{remaining!==null&&<span className={`quiz-timer ${remaining<=300?'ending':''}`}>⏱ {formatTime(remaining)}</span>}</div></div>
      <div className="progress" style={{marginTop:12}}><i style={{width:`${percent}%`}}/></div>
      <div style={{fontSize:12,marginTop:8,opacity:.72}}>{saveState==='saving'?'جاري حفظ إجاباتك...':saveState==='saved'?'✓ تم حفظ إجاباتك تلقائيًا':saveState==='error'?'تعذر الحفظ المؤقت — تأكد من الاتصال':'إجاباتك تُحفظ تلقائيًا'}</div>
    </div>
    {expired&&<div className="notice error quiz-timeout">انتهى الوقت، وجاري تسليم آخر إجابات محفوظة تلقائيًا.</div>}
    {error&&<div className="notice error">{error}</div>}
    <div className={`card question-card ${expired?'disabled-quiz':''}`}>
      <small>المستوى: {q?.level}</small><h2>{q?.prompt}</h2>
      {q&&(q.question_type==='mcq'||q.question_type==='true_false')?<div className="choices">{q.choices.map(c=><button type="button" disabled={expired||busy} key={c.id} className={`choice ${answers[q.id]?.choice_id===c.id?'selected':''}`} onClick={()=>setAnswers(a=>({...a,[q.id]:{choice_id:c.id}}))}><span>{answers[q.id]?.choice_id===c.id?'●':'○'}</span><span>{c.text}</span></button>)}</div>:<div className="field" style={{margin:'22px 0'}}><label>{q?.question_type==='essay'?'اكتب إجابتك بالتفصيل':'اكتب إجابتك'}</label><textarea disabled={expired||busy} className="input" rows={q?.question_type==='essay'?7:3} value={q?answers[q.id]?.text_answer||'':''} onChange={e=>q&&setAnswers(a=>({...a,[q.id]:{text_answer:e.target.value}}))}/></div>}
      <div className="quiz-controls"><button className="btn" disabled={index===0||expired||busy} onClick={()=>setIndex(i=>i-1)}>السابق</button>{index<data.questions.length-1?<button className="btn btn-primary" disabled={expired||busy||!answered(q)} onClick={()=>setIndex(i=>i+1)}>التالي</button>:<button className="btn btn-dark" disabled={expired||busy||!data.questions.every(answered)} onClick={()=>finish(false)}>{busy?'جاري التسليم...':'إنهاء الاختبار'}</button>}</div>
      {index===data.questions.length-1&&!data.questions.every(answered)&&!expired?<p className="quiz-warning">جاوب كل الأسئلة قبل التسليم النهائي.</p>:null}
    </div>
  </>;
}
