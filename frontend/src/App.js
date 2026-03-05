import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AccessControlProvider } from './contexts/AccessControlContext';
import Login from './pages/login/Login';
import Sidebar from './components/sidebar/Sidebar';
import Users from './pages/users/Users';
import Accounts from './pages/accounts/Accounts';
import Contacts from './pages/contacts/Contacts';
import Pipeline from './pages/sales-pipeline/Pipeline';
import Inbox from './pages/inbox/Inbox';
import Leaderboard from './pages/leaderboard/Leaderboard';
import Reports from './pages/reports/Reports';
import Dashboard from './pages/dashboard/Dashboard';
import Targets from './pages/targets/Targets';
import SetTargets from './pages/targets/SetTargets';
import SetActuals from './pages/actuals/SetActuals';
import ActivityLog from './pages/activity-log/ActivityLog';
import Enquiries from './pages/enquiries/Enquiries';
import Products from './pages/products/Products';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route path="/*" element={
          // <ProtectedRoute>
            <AccessControlProvider>
              <div className="App min-h-screen flex bg-gray-50">
                <Sidebar />
                <main className="main-content flex-1 bg-gray-50 overflow-y-auto">
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/users" element={<Users />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/leaderboard" element={<Leaderboard />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/inbox" element={<Inbox />} />
                    <Route path="/enquiries" element={<Enquiries />} />
                    <Route path="/scrumboard/kanban" element={<div className="p-6"><h1>Project Kanban</h1></div>} />
                    <Route path="/sales-pipeline" element={<Pipeline />} />
                    <Route path="/accounts" element={<Accounts />} />
                    <Route path="/contacts" element={<Contacts />} />
                    <Route path="/products" element={<Products />} />
                    <Route path="/targets" element={<Targets />} />
                    <Route path="/targets/set" element={<SetTargets />} />
                    <Route path="/actuals" element={<div className="p-6"><h1>View Actuals</h1></div>} />
                    <Route path="/actuals/set" element={<SetActuals />} />
                    <Route path="/activity-log" element={<ActivityLog />} />
                    <Route path="/quotes" element={<div className="p-6"><h1>Quotes</h1></div>} />
                    <Route path="/admin/audit" element={<div className="p-6"><h1>Audit Log</h1></div>} />
                  </Routes>
                </main>
              </div>
            </AccessControlProvider>
          // </ProtectedRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
