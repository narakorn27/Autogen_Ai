import type { ReactNode } from "react";

type PageHeaderProps = {
  icon?: ReactNode;
  title: string;
  highlight?: string;
  description: string;
  action?: ReactNode;
};

export default function PageHeader({ icon, title, highlight, description, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-4 border-b border-crimson-900/30 pb-4 md:flex-row md:items-end">
      <div>
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-widest text-white">
          {icon}
          <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{title}</span>
          {highlight ? <span className="font-black text-crimson-600">{highlight}</span> : null}
        </h1>
        <p className="mt-2 text-sm tracking-wide text-gray-400">{description}</p>
      </div>
      {action}
    </div>
  );
}
