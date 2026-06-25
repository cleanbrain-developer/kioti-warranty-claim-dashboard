import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { BarChart2, List, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

const tabs = [
  { path: '/', label: 'Insights', icon: BarChart2 },
  { path: '/claims', label: 'Claims', icon: List },
  { path: '/aging', label: 'Aging', icon: Clock },
];

export default function Navigation() {
  const navigate = useNavigate();

  return (
    <div className="bg-bg-card border-b border-border">
      <div className="max-w-screen-2xl mx-auto px-6 flex items-center gap-1">
        {/* Back / Forward history */}
        <div className="flex items-center gap-0.5 mr-2">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
            title="Go back"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => navigate(1)}
            className="p-1.5 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-all"
            title="Go forward"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="w-px h-5 bg-border mr-2" />

        {tabs.map(({ path, label, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-150',
                isActive
                  ? 'text-text-primary border-accent-blue-light'
                  : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border',
              )
            }
          >
            <Icon size={15} />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
