import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { 
  PlusCircle, History, LayoutDashboard, Sword, Trash2, Download
} from 'lucide-react';
import { format } from 'date-fns';

const API_BASE_URL = 'http://localhost:8000';

interface Activity {
  id: number;
  date: string;
  week: number;
  category: string;
  minutes: number;
  details: string;
}

interface Stats {
  category_distribution: { category: string; total_minutes: number }[];
  weekly_progress: any[];
  current_week_total_hours: number;
  current_week_start: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];

const CATEGORIES = [
  "Tactics/Calculation", 
  "Opening prep.", 
  "Games & Analysis", 
  "Lesson", 
  "Visualization", 
  "Trainer", 
  "Endgame", 
  "Middlegame / Strategy", 
  "Books/Other"
];

export default function ActivitiesTab() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Form state
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [minutes, setMinutes] = useState(30);
  const [details, setDetails] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (currentPage - 1) * pageSize;
      
      const [activitiesRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/activities`, {
          params: {
            limit: pageSize,
            offset,
            category: filterCategory || undefined,
            start_date: filterStartDate || undefined,
            end_date: filterEndDate || undefined
          }
        }),
        axios.get(`${API_BASE_URL}/stats/summary`)
      ]);
      
      setActivities(activitiesRes.data.activities);
      setTotalCount(activitiesRes.data.total_count);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterCategory, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const selectedDate = new Date(date);
      const startOfYear = new Date(selectedDate.getFullYear(), 0, 1);
      const weekNum = Math.ceil((((selectedDate.getTime() - startOfYear.getTime()) / 86400000) + startOfYear.getDay() + 1) / 7);
      
      await axios.post(`${API_BASE_URL}/activities`, {
        date,
        week: weekNum,
        category,
        minutes,
        details
      });
      
      setDetails('');
      fetchData();
    } catch (err) {
      console.error('Error creating activity:', err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this activity?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/activities/${id}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting activity:', err);
    }
  };

  if (loading && !stats) return <div className="flex items-center justify-center h-64">Loading...</div>;
  if (error && !stats) return <div className="flex items-center justify-center h-64 text-red-600">{error}</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column: Form & Key Stats */}
      <div className="space-y-8">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center space-x-2 mb-6">
            <PlusCircle className="text-indigo-500" />
            <h2 className="text-lg font-semibold">Log Activity</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input 
                type="date" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Minutes</label>
              <input 
                type="number" 
                value={minutes}
                onChange={(e) => setMinutes(parseInt(e.target.value))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Details</label>
              <textarea 
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="e.g., Lichess puzzles, KID prep..."
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>
            <button 
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>Save Entry</span>
            </button>
          </form>
        </section>

        <section className="bg-indigo-600 text-white p-6 rounded-xl shadow-lg">
          <h3 className="text-indigo-100 text-sm font-medium uppercase tracking-wider">Total Effort</h3>
          <div className="mt-2 flex items-baseline">
            <span className="text-4xl font-bold">{stats?.current_week_total_hours}</span>
            <span className="ml-2 text-indigo-200">hours this week</span>
          </div>
        </section>
      </div>

      {/* Center/Right Column: Charts & History */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-6 flex items-center">
              <LayoutDashboard className="mr-2 h-5 w-5 text-gray-400" />
              Category Split
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical" 
                  data={stats?.category_distribution ? [...stats.category_distribution].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)) : []}
                  margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis 
                    dataKey="category" 
                    type="category" 
                    width={100} 
                    tick={{fontSize: 12}}
                  />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    formatter={(value: number) => {
                       const total = stats?.category_distribution.reduce((acc, curr) => acc + curr.total_minutes, 0) || 1;
                       const percentage = ((value / total) * 100).toFixed(1);
                       const hours = (value / 60).toFixed(1);
                       return [`${percentage}% (${hours}h)`, 'Time'];
                    }}
                  />
                  <Bar dataKey="total_minutes" radius={[0, 4, 4, 0]}>
                    {stats?.category_distribution ? [...stats.category_distribution].sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category)).map((entry, index) => {
                      const catIndex = CATEGORIES.indexOf(entry.category);
                      return <Cell key={`cell-${index}`} fill={COLORS[catIndex % COLORS.length]} />;
                    }) : null}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-6 flex items-center">
              <History className="mr-2 h-5 w-5 text-gray-400" />
              Weekly Trend
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats?.weekly_progress || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis 
                    dataKey="week_start" 
                    tickFormatter={(value) => {
                      try {
                        return format(new Date(value), 'MMM d');
                      } catch {
                        return value;
                      }
                    }}
                  />
                  <YAxis label={{ value: 'Mins', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    labelFormatter={(value) => `Week of ${value}`}
                    itemSorter={(item) => (item.value as number) * -1}
                  />
                  {CATEGORIES.map((cat, index) => (
                    <Bar 
                      key={cat} 
                      dataKey={cat} 
                      stackId="a" 
                      fill={COLORS[index % COLORS.length]} 
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* History Table */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <h2 className="text-lg font-semibold">Activity History</h2>
              
              <div className="flex flex-wrap items-center gap-4">
                <a 
                  href={`${API_BASE_URL}/export`}
                  download
                  className="flex items-center space-x-2 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-3 w-3" />
                  <span>Export CSV</span>
                </a>
  
                {/* Filters */}
                <div className="flex flex-wrap gap-2">
                  <select 
                    value={filterCategory}
                    onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                    className="text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    <option value="">All Categories</option>
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                  <input 
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => { setFilterStartDate(e.target.value); setCurrentPage(1); }}
                    className="text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  <span className="text-gray-400 self-center">to</span>
                  <input 
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => { setFilterEndDate(e.target.value); setCurrentPage(1); }}
                    className="text-xs rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                  {(filterCategory || filterStartDate || filterEndDate) && (
                    <button 
                      onClick={() => { setFilterCategory(''); setFilterStartDate(''); setFilterEndDate(''); setCurrentPage(1); }}
                      className="text-xs text-indigo-600 hover:text-indigo-800"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-sm">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Mins</th>
                  <th className="px-6 py-3 font-medium">Details</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activities.map((activity) => {
                  const catIndex = CATEGORIES.indexOf(activity.category);
                  const catColor = COLORS[catIndex % COLORS.length];
                  return (
                    <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">{activity.date}</td>
                      <td className="px-6 py-4">
                        <span 
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: `${catColor}20`, color: catColor }}
                        >
                          {activity.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{activity.minutes}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 truncate max-w-xs">{activity.details}</td>
                      <td className="px-6 py-4 text-sm text-right">
                        <button 
                          onClick={() => handleDelete(activity.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              Showing {activities.length} of {totalCount} entries
            </div>
            <div className="flex space-x-2">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <div className="text-xs self-center px-2">
                Page {currentPage} of {Math.ceil(totalCount / pageSize) || 1}
              </div>
              <button 
                disabled={currentPage >= Math.ceil(totalCount / pageSize)}
                onClick={() => setCurrentPage(p => p + 1)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}