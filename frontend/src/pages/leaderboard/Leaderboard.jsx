import React, { useEffect, useMemo, useState } from 'react';
import { FaAward, FaMedal, FaTrophy } from 'react-icons/fa';
import { leaderboardApi } from './api/leaderboard';
import { userManager } from '../login/api/auth';
import { dashboardApi } from '../../modules/dashboard/api/dashboardApi';

const divisions = ['Local', 'Export'];

const rankIcon = (rank) => {
  if (rank === 1) return <FaTrophy className="text-yellow-500" />;
  if (rank === 2) return <FaMedal className="text-gray-400" />;
  if (rank === 3) return <FaAward className="text-amber-600" />;
  return <span className="text-xs font-semibold text-gray-500">{rank}</span>;
};

const rowStyle = (rank, isCurrentUser) => {
  if (isCurrentUser) return 'border border-blue-200 bg-blue-50';
  if (rank === 1) return 'border border-yellow-200 bg-yellow-50';
  if (rank === 2) return 'border border-gray-200 bg-gray-50';
  if (rank === 3) return 'border border-amber-200 bg-amber-50';
  return 'border border-gray-200 bg-white';
};

const Leaderboard = () => {
  const [financialYears, setFinancialYears] = useState([]);
  const [selectedFY, setSelectedFY] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('Local');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    setCurrentUser(userManager.getUser());
  }, []);

  useEffect(() => {
    const loadFinancialYears = async () => {
      try {
        const years = await dashboardApi.getFinancialYears();
        const validYears = Array.isArray(years) ? years : [];
        setFinancialYears(validYears);
        if (validYears.length > 0) {
          setSelectedFY((prev) => prev || validYears[0]);
        }
      } catch (e) {
        setError(e.message || 'Failed to load financial years');
        setFinancialYears([]);
      }
    };
    loadFinancialYears();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        if (!selectedFY) {
          setRows([]);
          return;
        }
        const data = await leaderboardApi.getLeaderboard(selectedDivision, selectedFY);
        const ranked = (Array.isArray(data) ? data : []).map((item, idx) => ({
          ...item,
          rank: idx + 1
        }));
        setRows(ranked);
      } catch (e) {
        setError(e.message || 'Failed to load leaderboard');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [selectedDivision, selectedFY]);

  const currentUserRow = useMemo(
    () => rows.find((r) => r.ECode === currentUser?.ECode),
    [rows, currentUser]
  );

  return (
    <div className="p-6 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Sales Leaderboard</h1>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Financial Year</label>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              disabled={financialYears.length === 0}
              className="border border-gray-300 rounded px-3 py-2 text-sm bg-white"
            >
              {financialYears.length === 0 && <option value="">No FY</option>}
              {financialYears.map((fy) => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">Division</label>
            <div className="flex gap-2">
              {divisions.map((d) => (
                <button
                  key={d}
                  onClick={() => setSelectedDivision(d)}
                  className={`px-3 py-1.5 text-sm rounded border ${
                    selectedDivision === d
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-3">
        Top performers - {selectedDivision} Division - FY {selectedFY}
        {currentUserRow ? ` - Your rank #${currentUserRow.rank}` : ''}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-white border border-gray-200 rounded-lg h-16" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-8 text-sm text-center text-gray-500">
          No leaderboard data available.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((entry) => {
            const isCurrentUser = entry.ECode === currentUser?.ECode;
            return (
              <div key={entry.ECode} className={`rounded-lg px-4 py-3 ${rowStyle(entry.rank, isCurrentUser)}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-5 text-center">{rankIcon(entry.rank)}</div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {entry.name} {isCurrentUser ? <span className="text-xs text-blue-600">(You)</span> : null}
                      </div>
                      <div className="text-xs text-gray-500">
                        ECode: {entry.ECode} | Rank #{entry.rank}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-sm font-semibold text-gray-900">₹{entry.sales.toLocaleString('en-IN')}</div>
                      <div className="text-[10px] text-gray-500">Sales (in lakhs)</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">{entry.deals_won}</div>
                      <div className="text-[10px] text-gray-500">Deals Won</div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
