import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

type View = 'day' | 'month' | 'year';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export default function DatePicker({ value, onChange, placeholder = 'YYYY-MM-DD' }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>('day');
  const [yearRangeStart, setYearRangeStart] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const today = new Date();

  const parseDate = (v: string): Date | null => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(v + 'T00:00:00');
    return isNaN(d.getTime()) ? null : d;
  };

  const parsed = parseDate(value);
  const [calYear, setCalYear] = useState(parsed?.getFullYear() ?? today.getFullYear());
  const [calMonth, setCalMonth] = useState(parsed?.getMonth() ?? today.getMonth());

  useEffect(() => {
    const d = parseDate(value);
    if (d) { setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    if (!open) { setView('day'); return; }
    const yr = parsed?.getFullYear() ?? today.getFullYear();
    setYearRangeStart(Math.floor(yr / 12) * 12);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstDay = new Date(calYear, calMonth, 1).getDay();

  const selectDay = (day: number) => {
    const mm = String(calMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    onChange(`${calYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const selectMonth = (m: number) => {
    setCalMonth(m);
    setView('day');
  };

  const selectYear = (y: number) => {
    setCalYear(y);
    setView('month');
  };

  const selectedDay = parsed && parsed.getFullYear() === calYear && parsed.getMonth() === calMonth
    ? parsed.getDate() : null;

  const isToday = (day: number) =>
    today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day;

  const displayLabel = value || placeholder;

  return (
    <div className="relative w-full" ref={ref}>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          maxLength={10}
          className="input text-sm pr-7 w-full"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => { if (value) { onChange(''); } else { setOpen(o => !o); } }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
        >
          {value ? <X size={12} /> : <Calendar size={13} />}
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-[200] bg-bg-card border border-border rounded-xl shadow-2xl p-3 w-60">

          {/* ── Day View ── */}
          {view === 'day' && (
            <>
              <div className="flex items-center justify-between mb-2">
                <button type="button" onClick={() => { if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); } else setCalMonth(m => m - 1); }}
                  className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setView('month')}
                  className="text-xs font-semibold text-text-primary hover:text-accent-blue-light transition-colors px-1 py-0.5 rounded hover:bg-bg-hover"
                >
                  {MONTHS_FULL[calMonth]} {calYear}
                </button>
                <button type="button" onClick={() => { if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); } else setCalMonth(m => m + 1); }}
                  className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-1">
                {DAY_HEADERS.map(d => (
                  <div key={d} className="text-center text-[10px] font-medium text-text-muted py-0.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const sel = selectedDay === day;
                  const tod = isToday(day);
                  return (
                    <button key={day} type="button" onClick={() => selectDay(day)}
                      className={`h-7 w-full text-xs rounded transition-colors ${
                        sel ? 'bg-accent-blue text-white font-medium'
                          : tod ? 'text-accent-blue-light font-semibold hover:bg-bg-hover'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Month View ── */}
          {view === 'month' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setCalYear(y => y - 1)}
                  className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <button type="button" onClick={() => { setYearRangeStart(Math.floor(calYear / 12) * 12); setView('year'); }}
                  className="text-xs font-semibold text-text-primary hover:text-accent-blue-light transition-colors px-1 py-0.5 rounded hover:bg-bg-hover">
                  {calYear}
                </button>
                <button type="button" onClick={() => setCalYear(y => y + 1)}
                  className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, i) => {
                  const isSel = parsed && parsed.getFullYear() === calYear && parsed.getMonth() === i;
                  const isCurMonth = today.getFullYear() === calYear && today.getMonth() === i;
                  return (
                    <button key={m} type="button" onClick={() => selectMonth(i)}
                      className={`py-1.5 text-xs rounded transition-colors ${
                        isSel ? 'bg-accent-blue text-white font-medium'
                          : isCurMonth ? 'text-accent-blue-light font-semibold hover:bg-bg-hover'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Year View ── */}
          {view === 'year' && (
            <>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => setYearRangeStart(y => y - 12)}
                  className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-text-primary">
                  {yearRangeStart} – {yearRangeStart + 11}
                </span>
                <button type="button" onClick={() => setYearRangeStart(y => y + 12)}
                  className="p-1 rounded hover:bg-bg-hover text-text-secondary transition-colors">
                  <ChevronRight size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map(y => {
                  const isSel = parsed && parsed.getFullYear() === y;
                  const isCurYear = today.getFullYear() === y;
                  return (
                    <button key={y} type="button" onClick={() => selectYear(y)}
                      className={`py-1.5 text-xs rounded transition-colors ${
                        isSel ? 'bg-accent-blue text-white font-medium'
                          : isCurYear ? 'text-accent-blue-light font-semibold hover:bg-bg-hover'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}>
                      {y}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
