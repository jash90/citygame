'use client';

import { useState } from 'react';
import { Users, Server, Bot } from 'lucide-react';
import { UserManagementTab } from '@/features/settings/components/UserManagementTab';
import { SystemInfoTab } from '@/features/settings/components/SystemInfoTab';
import { AiModelTab } from '@/features/settings/components/AiModelTab';

const tabs = [
  { id: 'users', label: 'Użytkownicy', icon: <Users size={16} /> },
  { id: 'ai', label: 'Model AI', icon: <Bot size={16} /> },
  { id: 'system', label: 'System', icon: <Server size={16} /> },
] as const;

type TabId = (typeof tabs)[number]['id'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('users');

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Ustawienia</h2>
        <p className="text-gray-500 text-sm mt-1">Zarządzanie platformą</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#FF6B35] text-[#FF6B35]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'users' && <UserManagementTab />}
      {activeTab === 'ai' && <AiModelTab />}
      {activeTab === 'system' && <SystemInfoTab />}
    </div>
  );
}
