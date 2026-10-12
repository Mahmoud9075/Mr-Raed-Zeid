import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api } from "@/lib/api";
import { notFound } from "next/navigation";

type CustomPageData = {
  title: string;
  content_json: string;
};

export default async function CustomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const result = await api(`/pages/${slug}`).catch(() => null);

  if (!result) {
    notFound();
  }

  const page = result as CustomPageData;
  let body = "";

  try {
    const parsed = JSON.parse(page.content_json || "{}");
    body = parsed.body || "";
  } catch {
    body = page.content_json || "";
  }

  return (
    <>
      <Header />
      <main className="section">
        <div className="container">
          <article className="card custom-page">
            <h1 className="section-title">{page.title}</h1>
            <div className="custom-body">
              {body.split("\n").map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
