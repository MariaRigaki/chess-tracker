import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts';
import { 
  PlusCircle, AlertTriangle, Trash2, Link as LinkIcon, Download
} from 'lucide-react';
import { format } from 'date-fns';

const API_BASE_URL = 'http://localhost:8000';

interface Mistake {
  id: number;
  date: string;
  game_type: string;
  time_control: string;
  opponent_name: string;
  opponent_rating: number;
  result: string;
  move_number: number;
  mistake_category: string;
  cause: string;
  fix: string;
  training: string;
  url: string;
  annotations: string;
}

interface MistakeStats {
  mistake_distribution: { mistake_category: string; count: number }[];
  result_distribution: { result: string; count: number }[];
}

const MISTAKE_CATEGORIES = [
  "Step 1 (Opponent's move)",
  "Step 2 (Tactic)",
  "Step 3 (Strategic)",
  "Step 4 (Opponent's response)"
];

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1', '#a4de6c'];

export default function MistakesTab() {
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<MistakeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Form State
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    game_type: 'Rapid',
    time_control: '10+5',
    opponent_name: '',
    opponent_rating: '',
    result: 'Loss',
    move_number: '',
    mistake_category: MISTAKE_CATEGORIES[0],
    cause: "Didn't see it",
    fix: '',
    training: '',
    url: '',
    annotations: 'FALSE'
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const offset = (currentPage - 1) * pageSize;
      
      const [mistakesRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/mistakes`, {
          params: { limit: pageSize, offset }
        }),
        axios.get(`${API_BASE_URL}/mistakes/stats`)
      ]);
      
      setMistakes(mistakesRes.data.mistakes);
      setTotalCount(mistakesRes.data.total_count);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Error fetching mistakes:', err);
      setError('Failed to load mistakes.');
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE_URL}/mistakes`, {
        ...formData,
        opponent_rating: formData.opponent_rating ? parseInt(formData.opponent_rating) : null,
        move_number: formData.move_number ? parseInt(formData.move_number) : null
      });
      // Reset non-default fields
      setFormData(prev => ({
        ...prev,
        opponent_name: '',
        opponent_rating: '',
        move_number: '',
        mistake_category: MISTAKE_CATEGORIES[0],
        cause: "Didn't see it",
        fix: '',
        training: '',
        url: ''
      }));
      fetchData();
    } catch (err) {
      console.error('Error adding mistake:', err);
      alert('Failed to add mistake');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this mistake?')) return;
    try {
      await axios.delete(`${API_BASE_URL}/mistakes/${id}`);
      fetchData();
    } catch (err) {
      console.error('Error deleting mistake:', err);
    }
  };

  if (loading && !stats) return <div className="h-64 flex items-center justify-center">Loading...</div>;
  if (error && !stats) return <div className="h-64 flex items-center justify-center text-red-600">{error}</div>;

  return (
    <div className="space-y-8">
      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-6">Mistake Categories</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                layout="vertical"
                data={stats?.mistake_distribution || []}
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="mistake_category" type="category" width={120} tick={{fontSize: 12}} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {stats?.mistake_distribution ? stats.mistake_distribution.map((entry, index) => {
                    const catIndex = MISTAKE_CATEGORIES.indexOf(entry.mistake_category);
                    return <Cell key={`cell-${index}`} fill={COLORS[catIndex >= 0 ? catIndex : index % COLORS.length]} />;
                  }) : null}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-6">Game Results</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats?.result_distribution || []}
                  dataKey="count"
                  nameKey="result"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label
                >
                  {stats?.result_distribution ? stats.result_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.result === 'Win' ? '#4ade80' : entry.result === 'Loss' ? '#f87171' : '#94a3b8'} />
                  )) : null}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Main Content: Form & List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Form */}
        <section className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 h-fit">
          <div className="flex items-center space-x-2 mb-6">
            <AlertTriangle className="text-amber-500" />
            <h2 className="text-lg font-semibold">Log Game Mistake</h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700">Date</label>
                <input type="date" name="date" value={formData.date} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" required />
              </div>
              <div>
                <label className="block font-medium text-gray-700">Result</label>
                <select name="result" value={formData.result} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                  <option>Win</option>
                  <option>Loss</option>
                  <option>Draw</option>
                </select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700">Game Type</label>
                <input type="text" name="game_type" value={formData.game_type} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block font-medium text-gray-700">Time Control</label>
                <input type="text" name="time_control" value={formData.time_control} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-gray-700">Opponent</label>
                <input type="text" name="opponent_name" value={formData.opponent_name} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
              </div>
              <div>
                <label className="block font-medium text-gray-700">Rating</label>
                <input type="number" name="opponent_rating" value={formData.opponent_rating} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
              </div>
            </div>

            <div>
              <label className="block font-medium text-gray-700">Mistake Category</label>
              <select 
                name="mistake_category" 
                value={formData.mistake_category} 
                onChange={handleInputChange} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                {MISTAKE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700">Cause</label>
              <select 
                name="cause" 
                value={formData.cause} 
                onChange={handleInputChange} 
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
              >
                <option value="Didn't see it">Didn't see it</option>
                <option value="Got it wrong">Got it wrong</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-gray-700">Fix / Lesson</label>
              <textarea name="fix" value={formData.fix} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" rows={2} />
            </div>

            <div>
              <label className="block font-medium text-gray-700">Game URL</label>
              <input type="url" name="url" value={formData.url} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm" />
            </div>

            <button type="submit" className="w-full bg-amber-600 text-white py-2 px-4 rounded-md hover:bg-amber-700 transition-colors">
              Save Mistake
            </button>
          </form>
        </section>

        {/* List */}
        <section className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-semibold">Recent Mistakes</h2>
            <div className="flex items-center space-x-3">
               <a 
                href={`${API_BASE_URL}/export/mistakes`}
                download
                className="flex items-center space-x-2 bg-white border border-gray-300 px-3 py-1.5 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Download className="h-3 w-3" />
                <span>Export CSV</span>
              </a>
               <div className="flex items-center space-x-2 border-l pl-3">
                 <button 
                  disabled={currentPage===1} 
                  onClick={() => setCurrentPage(p=>p-1)} 
                  className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                 >
                   Prev
                 </button>
                 <span className="text-xs text-gray-500">
                   Page {currentPage} of {Math.ceil(totalCount / pageSize) || 1}
                 </span>
                 <button 
                  disabled={currentPage >= Math.ceil(totalCount / pageSize)} 
                  onClick={() => setCurrentPage(p=>p+1)} 
                  className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
                 >
                   Next
                 </button>
               </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Mistake</th>
                  <th className="px-4 py-3">Cause</th>
                  <th className="px-4 py-3">Fix</th>
                  <th className="px-4 py-3">Link</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {mistakes.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">{m.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${m.result==='Win'?'bg-green-100 text-green-800':m.result==='Loss'?'bg-red-100 text-red-800':'bg-gray-100 text-gray-800'}`}>
                        {m.result}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{m.mistake_category}</td>
                    <td className="px-4 py-3 text-gray-500">{m.cause}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={m.fix}>{m.fix}</td>
                    <td className="px-4 py-3">
                      {m.url && (
                        <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                          <LinkIcon className="h-4 w-4" />
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(m.id)} className="text-red-400 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
