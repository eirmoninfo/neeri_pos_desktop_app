interface SimplePageProps {
  title: string;
  description: string;
}

export default function SimplePage({ title, description }: SimplePageProps) {
  return (
    <div className="panel p-6">
      <h2 className="panel-title">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
    </div>
  );
}
