'use client';
import {useEffect,useState} from 'react';
import {usePathname} from 'next/navigation';
import {api} from '@/lib/api';

export default function SiteGate({children}:{children:React.ReactNode}){
 const path=usePathname(); const [settings,setSettings]=useState<Record<string,string>|null>(null);
 useEffect(()=>{api<Record<string,string>>('/site-settings').then(setSettings).catch(()=>setSettings({}))},[]);
 const bypass=path.startsWith('/admin');
 if(!settings) return <>{children}</>;
 if(settings.maintenance_mode==='true'&&!bypass){return <main className="maintenance-screen"><div className="card maintenance-card"><img src="/media/logo.webp" alt="Mr. Raed Zeid"/><span className="eyebrow">صيانة مؤقتة</span><h1>هنرجعلك قريب</h1><p>{settings.maintenance_message||'الموقع تحت الصيانة مؤقتًا.'}</p></div></main>}
 return <>{children}</>;
}
