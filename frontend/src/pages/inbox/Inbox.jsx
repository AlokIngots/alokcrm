import React, { useState, useEffect, useCallback } from 'react';
import { inboxApi } from './api/inbox';
import { permissionsApi } from '../../api/permissions';
import { formatIndianCurrency } from '../accounts/utils/accountUtils';
import StatsCard from './components/StatsCard';
import ApprovalCard from './components/ApprovalCard';
import DealDetailsModal from './DealDetailsModal';
import DuplicateDealsModal from './DuplicateDealsModal';

const Inbox = () => {
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_approved: 0,
    total_rejected: 0
  });
  const [permissions, setPermissions] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [selectedDuplicateDeal, setSelectedDuplicateDeal] = useState(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchPermissions(),
      fetchPendingApprovals(),
      fetchStats()
    ]);
  }, []);

  // Fetch data on component mount
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchPermissions = async () => {
    try {
      const data = await permissionsApi.getUserPermissions();
      setPermissions(data.permissions);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      setPermissions({});
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await inboxApi.getPendingApprovals();
      setPendingApprovals(data);
    } catch (error) {
      console.error('Error fetching pending approvals:', error);
      setError(error.message);
      setPendingApprovals([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setIsStatsLoading(true);
      const data = await inboxApi.getApprovalStats();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handleApproveDeal = async (dealId) => {
    try {
      await inboxApi.approveDeal(dealId);
      
      // Remove the approved deal from the list
      setPendingApprovals(prev => prev.map(item => {
        if (item.type === 'DUPLICATE') {
          // Remove the specific new deal from the new_deals array
          const updatedNewDeals = item.new_deals?.filter(deal => deal.ID !== dealId) || [];
          // If no more new deals, remove the entire duplicate group
          if (updatedNewDeals.length === 0) {
            return null;
          }
          return { ...item, new_deals: updatedNewDeals };
        }
        // For KAM_APPROVAL deals, remove entirely if it matches
        return item.ID !== dealId ? item : null;
      }).filter(Boolean));
      
      // Update stats
      await fetchStats();
      
      // Show success message (you can implement a toast notification here)
      console.log('Deal approved successfully');
    } catch (error) {
      console.error('Error approving deal:', error);
      // Show error message (you can implement a toast notification here)
      alert('Error approving deal: ' + error.message);
    }
  };

  const handleRejectDeal = async (dealId) => {
    try {
      await inboxApi.rejectDeal(dealId);
      
      // Remove the rejected deal from the list
      setPendingApprovals(prev => prev.map(item => {
        if (item.type === 'DUPLICATE') {
          // Remove the specific new deal from the new_deals array
          const updatedNewDeals = item.new_deals?.filter(deal => deal.ID !== dealId) || [];
          // If no more new deals, remove the entire duplicate group
          if (updatedNewDeals.length === 0) {
            return null;
          }
          return { ...item, new_deals: updatedNewDeals };
        }
        // For KAM_APPROVAL deals, remove entirely if it matches
        return item.ID !== dealId ? item : null;
      }).filter(Boolean));
      
      // Update stats
      await fetchStats();
      
      // Show success message (you can implement a toast notification here)
      console.log('Deal rejected successfully');
    } catch (error) {
      console.error('Error rejecting deal:', error);
      // Show error message (you can implement a toast notification here)
      alert('Error rejecting deal: ' + error.message);
    }
  };

  const handleViewDetails = (deal) => {
    setSelectedDeal(deal);
    setIsDetailsModalOpen(true);
  };

  const handleViewDuplicateDetails = (duplicateItem, selectedNewDeal) => {
    // Create a modified duplicate item with just the selected new deal
    const modifiedDuplicateItem = {
      ...duplicateItem,
      new_deal: selectedNewDeal,
      new_deals: undefined // Remove the array to match the modal's expected structure
    };
    setSelectedDuplicateDeal(modifiedDuplicateItem);
    setIsDuplicateModalOpen(true);
  };

  const closeDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedDeal(null);
  };

  const closeDuplicateModal = () => {
    setIsDuplicateModalOpen(false);
    setSelectedDuplicateDeal(null);
  };

  // Separate deals by type
  const duplicateDeals = pendingApprovals.filter(item => item.type === 'DUPLICATE');
  const kamApprovalDeals = pendingApprovals.filter(item => item.type === 'KAM_APPROVAL');
  const duplicateEnquiries = pendingApprovals.filter(item => item.type === 'ENQUIRY_DUPLICATE');

  // Flatten duplicate deals to show individual new deals
  const flattenedDuplicateDeals = duplicateDeals.reduce((acc, duplicateGroup) => {
    if (duplicateGroup.new_deals) {
      duplicateGroup.new_deals.forEach(newDeal => {
        acc.push({
          ...duplicateGroup,
          new_deal: newDeal,
          new_deals: undefined // Remove array for modal compatibility
        });
      });
    }
    return acc;
  }, []);

  // Check if user can approve duplicate deals
  const canApproveDuplicates = permissions?.duplicate_deals?.approve || false;

  const statsCards = [
    {
      title: "Total Pending",
      value: stats.total_pending,
      description: "Deals waiting for approval",
      icon: "⏳",
      color: "orange"
    },
    {
      title: "Total Approved",
      value: stats.total_approved,
      description: "Deals approved by you",
      icon: "✅",
      color: "green"
    },
    {
      title: "Total Rejected",
      value: stats.total_rejected,
      description: "Deals rejected by you",
      icon: "❌",
      color: "red"
    }
  ];

  if (error) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-800">Error loading inbox: {error}</p>
            </div>
            <button 
              onClick={fetchData}
              className="mt-3 px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Approval Inbox</h1>
          <p className="text-gray-600 mt-1">Review and approve pending deal requests</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {statsCards.map((card, index) => (
            <StatsCard
              key={index}
              title={card.title}
              value={isStatsLoading ? '...' : card.value}
              description={card.description}
              icon={card.icon}
              color={card.color}
            />
          ))}
        </div>

        {/* Duplicate Deals Section */}
        {canApproveDuplicates && flattenedDuplicateDeals.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  Duplicate Deals ({flattenedDuplicateDeals.length})
                </h2>
                <button
                  onClick={fetchPendingApprovals}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>

            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
                  <span className="ml-3 text-gray-600">Loading duplicate deals...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {flattenedDuplicateDeals.map((duplicateItem, index) => (
                    <div
                      key={index}
                      className="bg-orange-50 border border-orange-300 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all hover:border-orange-400"
                      onClick={() => handleViewDuplicateDetails(duplicateItem, duplicateItem.new_deal)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {duplicateItem.new_deal?.AccountName}
                        </h4>
                        <span className="text-xs text-orange-600 bg-orange-200 px-2 py-1 rounded">
                          DUPLICATE
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 font-medium">
                          {duplicateItem.new_deal?.ServiceType}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Salesperson:</span>
                          <span className="text-xs font-medium text-gray-900">
                            {duplicateItem.new_deal?.SalespersonName}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Value:</span>
                          <span className="text-xs font-medium text-green-600">
                            {formatIndianCurrency(duplicateItem.new_deal?.DealValue)}
                          </span>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Contact:</span>
                          <span className="text-xs text-gray-900">
                            {duplicateItem.new_deal?.ContactName}
                          </span>
                        </div>
                        
                        {duplicateItem.new_deal?.LeadGeneratorName && (
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">Lead Gen:</span>
                            <span className="text-xs text-gray-900">
                              {duplicateItem.new_deal?.LeadGeneratorName}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <button className="text-xs text-orange-600 hover:text-orange-800 font-medium">
                          Click to compare →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Duplicate Enquiries Section */}
        {duplicateEnquiries.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <svg className="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Duplicate Enquiries ({duplicateEnquiries.length})
                </h2>
                <button
                  onClick={fetchPendingApprovals}
                  disabled={isLoading}
                  className="px-3 py-1 text-sm bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                >
                  {isLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <span className="ml-3 text-gray-600">Loading duplicate enquiries...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {duplicateEnquiries.map((group, index) => (
                    <div key={index} className="bg-purple-50 border border-purple-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">
                          {group.duplicate_info?.account_name || 'Unknown Account'}
                        </h4>
                        <span className="text-xs text-purple-600 bg-purple-200 px-2 py-1 rounded">
                          {group.duplicate_count} matches
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-gray-700">
                        <p><span className="font-medium">Business:</span> {group.duplicate_info?.business_type || '-'}</p>
                        <p><span className="font-medium">Grade:</span> {group.duplicate_info?.match_signature?.grade || '-'}</p>
                        <p><span className="font-medium">Shape/Dia:</span> {group.duplicate_info?.match_signature?.shape || '-'} / {group.duplicate_info?.match_signature?.dia || '-'}</p>
                      </div>
                      <div className="mt-3 pt-2 border-t border-purple-200">
                        <p className="text-xs text-gray-500 mb-2">Recent enquiries:</p>
                        <div className="space-y-1">
                          {(group.enquiries || []).slice(0, 3).map((enq) => (
                            <div key={enq.id} className="text-xs text-gray-700">
                              #{enq.id} - {enq.owner_name || enq.owner_ecode || 'Unknown'} ({enq.status || '-'})
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* KAM Approval Deals Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                KAM Approvals ({kamApprovalDeals.length})
              </h2>
              <button
                onClick={fetchPendingApprovals}
                disabled={isLoading}
                className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
              >
                {isLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading KAM approvals...</span>
              </div>
            ) : kamApprovalDeals.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🎉</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
                <p className="text-gray-600">No KAM approvals pending at this time.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {kamApprovalDeals.map((deal) => (
                  <ApprovalCard
                    key={deal.ID}
                    deal={deal}
                    onApprove={handleApproveDeal}
                    onReject={handleRejectDeal}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Deal Details Modal */}
        <DealDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={closeDetailsModal}
          deal={selectedDeal}
        />

        {/* Duplicate Deals Modal */}
        <DuplicateDealsModal
          isOpen={isDuplicateModalOpen}
          onClose={closeDuplicateModal}
          duplicateData={selectedDuplicateDeal}
          onApprove={handleApproveDeal}
          onReject={handleRejectDeal}
        />
      </div>
    </div>
  );
};

export default Inbox;
