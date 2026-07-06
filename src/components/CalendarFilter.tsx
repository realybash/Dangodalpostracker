import React from 'react';
import { Calendar } from 'lucide-react';

interface CalendarFilterProps {
  activeTimeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  selectedDate: Date;
  onTimeframeChange: (timeframe: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly') => void;
  onDateChange: (date: Date) => void;
}

export const CalendarFilter: React.FC<CalendarFilterProps> = ({ 
  activeTimeframe, 
  selectedDate, 
  onTimeframeChange, 
  onDateChange 
}) => {
  return (
    <div className="flex flex-col gap-3 p-4 bg-white border border-neutral-200 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-emerald-600" /> Filter Selection
        </label>
        <input 
          type="date"
          value={selectedDate.toISOString().split('T')[0]}
          onChange={(e) => onDateChange(new Date(e.target.value))}
          className="text-xs p-1.5 rounded-lg border border-neutral-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
      </div>
      
      <div className="grid grid-cols-4 gap-2">
        {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTimeframe === tf 
                ? 'bg-emerald-600 text-white shadow-md' 
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
    </div>
  );
};
