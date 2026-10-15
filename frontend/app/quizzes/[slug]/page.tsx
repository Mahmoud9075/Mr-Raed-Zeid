import Header from '@/components/Header';
import QuizRunner from './QuizRunner';
export default async function QuizPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params; return <><Header/><main className="quiz-page"><div className="quiz-shell"><QuizRunner slug={slug}/></div></main></>}
