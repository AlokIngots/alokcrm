import React, { useState } from 'react';
import SalesActivityReport from './SalesActivityReport';
import TargetVsActualsReport from './TargetVsActualsReport';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('sales-activity');

  const tabs = [
    {
      id: 'sales-activity',
      name: 'Sales Activity Report',
      component: SalesActivityReport
    },
    {
      id: 'target-vs-actuals',
      name: 'Target vs Actuals Report',
      component: TargetVsActualsReport
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {ActiveComponent && <ActiveComponent />}
      </div>
    </div>
  );
};

export default Reports; 