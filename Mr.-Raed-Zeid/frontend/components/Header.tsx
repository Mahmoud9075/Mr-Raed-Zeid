'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {api} from '@/lib/api';

type Nav={slug:string;title:string;path:string};
const fallback:Nav[]=[
 {slug:'home',title:'الرئيسية',path:'/'},{slug:'about',title:'عن المستر',path:'/#about'},
 {slug:'quizzes',title:'الكويزات',path:'/quizzes'},{slug:'moments',title:'الأجواء',path:'/#moments'},
 {slug:'students',title:'طلابنا',path:'/#students'},{slug:'honors',title:'الإنجازات',path:'/#honors'},
 {slug:'reviews',title:'شارك رأيك',path:'/#reviews'},{slug:'contact',title:'تواصل',path:'/#contact'}
];
export default function Header(){
 const [open,setOpen]=useState(false); const [links,setLinks]=useState<Nav[]>(fallback);
 useEffect(()=>{api<Nav[]>('/navigation').then(x=>x.length&&setLinks(x)).catch(()=>{})},[]);
 return <header className="site-header"><nav className="nav-shell">
  <Link className="brand" href="/"><img src="/media/logo.png" alt="Mr. Raed Zeid" /></Link>
  <div className="nav-links">{links.map(x=><Link key={x.slug} href={x.path}>{x.title}</Link>)}</div>
  <div className="nav-actions"><Link className="btn btn-dark hide-mobile" href="/login">بوابة الطالب</Link><Link className="btn hide-mobile" href="/en">EN</Link><button className="btn menu-button" onClick={()=>setOpen(!open)} aria-expanded={open}>☰</button></div>
  <div className={`mobile-menu ${open?'open':''}`}><Link href="/login" onClick={()=>setOpen(false)}>بوابة الطالب</Link><Link href="/en" onClick={()=>setOpen(false)}>English</Link>{links.map(x=><Link key={x.slug} href={x.path} onClick={()=>setOpen(false)}>{x.title}</Link>)}</div>
 </nav></header>
}
