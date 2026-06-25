import React from 'react';
import { NavLink } from 'react-router-dom';
import { BarChart2, List, Clock, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const tabs = [
  { path: '/', label: 'Insights', icon: BarChart2 },
  { path: '/claims', label: 'Claims', icon: List },
  { path: '/aging', label: 'Aging', icon: Clock },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function Navigation() {
  return (
    <div className="bg-bg-card border-b border-border">
      <div className="max-w-screen-2xl mx-auto px-6 flex items-center gap-1">
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
