import React, { useState } from 'react';
import { Sword, LayoutDashboard, AlertTriangle } from 'lucide-react';
import ActivitiesTab from './ActivitiesTab';
import MistakesTab from './MistakesTab';

const API_BASE_URL = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState<'activities' | 'mistakes'>('activities');

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      {/* Header */}
      <nav className="bg-white shadow-sm mb-8">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <Sword className="text-indigo-600 h-8 w-8" />
              <h1 className="text-2xl font-bold text-gray-900">Chess Activity Tracker</h1>
            </div>
            
            {/* Navigation Tabs */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('activities')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'activities' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                <span>Activities</span>
              </button>
              <button
                onClick={() => setActiveTab('mistakes')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'mistakes' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
                <span>Game Mistakes</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4">
        {activeTab === 'activities' ? <ActivitiesTab /> : <MistakesTab />}
      </main>
    </div>
  );
}

export default App;