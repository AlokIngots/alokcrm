import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DragDropContext } from 'react-beautiful-dnd';
import Confetti from 'react-confetti';
import { pipelineApi as dealsApi } from '../../modules/pipeline/api/pipelineApi';
import { dealStatusApi } from './api/deal-status';
import { PIPELINE_STAGES } from '../../config/pipeline-stages';
import { parseDealValue, formatIndianCurrency } from './utils/formatters';
import PipelineHeader from './components/PipelineHeader';
import StageColumn from './components/StageColumn';
import ViewDealModal from './ViewDealModal';
import DealStatusModal from './DealStatusModal';
import EditDealModal from './EditDealModal';
import MoveConfirmationModal from './MoveConfirmationModal';
import ReassignDealModal from './ReassignDealModal';
import { activityLogApi } from './api/activity-log';

// Main Pipeline Component
const Pipeline = () => {
  const [deals, setDeals] = useState([]);
  const [dealStatuses, setDealStatuses] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [pendingDragResult, setPendingDragResult] = useState(null);
  const [statusModalData, setStatusModalData] = useState({
    deal: null,
    newStage: null,
    existingStatus: null,
    isEditing: false
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [showMoveConfirmation, setShowMoveConfirmation] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const notifyCrmDataUpdated = useCallback((source = 'pipeline') => {
    const timestamp = String(Date.now());
    localStorage.setItem('crm:data-updated-at', timestamp);
    window.dispatchEvent(
      new CustomEvent('crm:data-updated', {
        detail: { source, timestamp }
      })
    );
  }, []);

  // Filter deals based on search term
  const filteredDeals = useMemo(() => {
    if (!searchTerm.trim()) {
      return deals;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    
    return deals.filter(deal => {
      // Search across multiple fields
      const searchableFields = [
        deal.AccountName || '',
        deal.ServiceType || '',
        deal.ContactName || '',
        deal.ContactEmail || '',
        deal.ContactPhone || '',
        deal.SalespersonName || '',
        deal.KAMName || '', // Key Account Manager field
        deal.Division || '',
        deal.AccountIndustry || '',
        deal.AccountWebsite || '',
        deal.LeadSource || '',
        deal.Notes || '',
        // Include deal value as searchable (convert to string)
        deal.DealValue ? deal.DealValue.toString() : '',
        // Include formatted currency for deal value
        deal.DealValue ? formatIndianCurrency(deal.DealValue) : '',
        // Include stage name (formatted)
        deal.Stage ? deal.Stage.replace(/_/g, ' ').toLowerCase() : '',
        // Include expected closure date
        deal.ExpectedClosureDate ? new Date(deal.ExpectedClosureDate).toLocaleDateString() : ''
      ];

      // Check if any field contains the search term
      return searchableFields.some(field => 
        field.toLowerCase().includes(searchLower)
      );
    });
  }, [deals, searchTerm]);

  // Group deals by stage with memoization and safety checks (updated to use filtered deals)
  const dealsByStage = useMemo(() => {
    if (!PIPELINE_STAGES || typeof PIPELINE_STAGES !== 'object') {
      console.error('PIPELINE_STAGES is not properly imported');
      return {};
    }

    // Initialize all stages with empty arrays
    const grouped = {};
    try {
      Object.keys(PIPELINE_STAGES).forEach(stage => {
        grouped[stage] = [];
      });
    } catch (err) {
      console.error('Error initializing pipeline stages:', err);
      return {};
    }

    if (Array.isArray(filteredDeals)) {
      filteredDeals.forEach(deal => {
        if (!deal || !deal.Stage) return;
        
        // Backward compatibility for legacy records after removing Feasibility stage.
        const stage = (deal.Stage === 'NEGOTIATION' || deal.Stage === 'DEAL_ON_HOLD')
          ? 'OFFER_SUBMITTED'
          : deal.Stage;
        if (grouped[stage]) {
          grouped[stage].push(deal);
        } else {
          // Fallback to NEW if stage doesn't exist (safety net)
          console.warn(`Unknown stage: ${stage}, defaulting to NEW`);
          if (grouped.NEW) {
            grouped.NEW.push(deal);
          }
        }
      });

      // Sort deals within each stage
      Object.keys(grouped).forEach(stage => {
        grouped[stage].sort((a, b) => {
          // Primary sort: Expected closure date (earliest first)
          const dateA = new Date(a?.ExpectedClosureDate || '9999-12-31'); // Use far future date as fallback
          const dateB = new Date(b?.ExpectedClosureDate || '9999-12-31');
          if (dateA.getTime() !== dateB.getTime()) {
            return dateA - dateB; // Earliest date first
          }

          // Secondary sort: Deal value (descending - highest value first)
          const valueA = parseDealValue(a?.DealValue) || 0;
          const valueB = parseDealValue(b?.DealValue) || 0;
          if (valueB !== valueA) {
            return valueB - valueA;
          }

          // Tertiary sort: Company name (alphabetical)
          const companyA = (a?.AccountName || '').toLowerCase();
          const companyB = (b?.AccountName || '').toLowerCase();
          return companyA.localeCompare(companyB);
        });
      });
    }

    return grouped;
  }, [filteredDeals]);

  // Calculate stage statistics with proper numeric handling
  const stageStats = useMemo(() => {
    if (!dealsByStage || typeof dealsByStage !== 'object') {
      return {};
    }

    const stats = {};
    try {
      Object.entries(dealsByStage).forEach(([stage, stageDeals]) => {
        if (!Array.isArray(stageDeals)) {
          stats[stage] = { count: 0, totalValue: 0 };
          return;
        }

        const totalValue = stageDeals.reduce((sum, deal) => {
          return sum + parseDealValue(deal?.DealValue);
        }, 0);

        stats[stage] = {
          count: stageDeals.length,
          totalValue: totalValue
        };
      });
    } catch (err) {
      console.error('Error calculating stage stats:', err);
      return {};
    }

    return stats;
  }, [dealsByStage]);

  // Fetch deal statuses for relevant deals
  const fetchDealStatuses = useCallback(async (dealsToCheck) => {
    const statusPromises = dealsToCheck
      .filter(deal => deal.Stage === 'DEAL_ON_HOLD' || deal.Stage === 'DEAL_LOST')
      .map(async (deal) => {
        try {
          const status = await dealStatusApi.getDealStatusByDealId(deal.ID);
          return status ? { dealId: deal.ID, status } : null;
        } catch (error) {
          console.error(`Error fetching status for deal ${deal.ID}:`, error);
          return null;
        }
      });

    const statuses = await Promise.all(statusPromises);
    const statusMap = {};
    
    statuses.forEach(result => {
      if (result) {
        statusMap[result.dealId] = result.status;
      }
    });

    setDealStatuses(statusMap);
  }, []);

  // Fetch deals from API with error boundary
  const fetchDeals = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await dealsApi.getAllDeals();
      
      // Ensure we have an array and validate deal data
      // Filter to only show deals where DisplayDeal is true
      const validDeals = Array.isArray(data) ? data.filter(deal => deal && deal.ID && deal.DisplayDeal === true) : [];
      setDeals(validDeals);

      // Fetch deal statuses for deals that might have them
      await fetchDealStatuses(validDeals);
    } catch (err) {
      console.error('Error fetching deals:', err);
      setError(err.message || 'Failed to fetch deals');
    } finally {
      setIsLoading(false);
    }
  }, [fetchDealStatuses]);

  // Load deals on component mount
  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // Track window dimensions for confetti
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleViewDeal = useCallback((deal) => {
    setSelectedDeal(deal);
    setShowViewModal(true);
  }, []);

  const handleCloseModals = useCallback(() => {
    setShowViewModal(false);
    setShowStatusModal(false);
    setShowEditModal(false);
    setShowMoveConfirmation(false);
    setShowReassignModal(false);
    setSelectedDeal(null);
    setEditingDeal(null);
    setPendingMove(null);
    setPendingDragResult(null);
    setStatusModalData({
      deal: null,
      newStage: null,
      existingStatus: null,
      isEditing: false
    });
  }, []);

  // Handle clearing deals (setting DisplayDeal to false)
  const handleClearDeal = useCallback(async (deal) => {
    try {
      await dealsApi.toggleDealDisplay(deal.ID, false);
      
      // Remove the deal from the current view by filtering it out
      setDeals(prevDeals => prevDeals.filter(d => d.ID !== deal.ID));
      notifyCrmDataUpdated('pipeline-clear-deal');
      
      console.log('Deal cleared successfully');
    } catch (error) {
      console.error('Error clearing deal:', error);
      setError(`Failed to clear deal: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  }, [notifyCrmDataUpdated]);

  // Clear error handler
  const handleClearError = useCallback(() => {
    setError(null);
  }, []);

  // Handle deal status creation/update
  const handleDealStatusSubmit = useCallback(async (statusData) => {
    try {
      setIsUpdating(true);
      
      const dealId = statusModalData.deal.ID;
      const stage = statusModalData.newStage || statusModalData.deal.Stage;
      
      // Prepare the status payload
      const statusPayload = {
        DealID: dealId,
        Status: stage,
        Reason: statusData.reason,
        CustomReason: statusData.customReason || null,
        Notes: statusData.notes || null
      };

      if (statusModalData.isEditing && statusModalData.existingStatus) {
        await dealStatusApi.updateDealStatus(statusModalData.existingStatus.ID, statusPayload);
      } else {
        await dealStatusApi.createDealStatus(statusPayload);
      }
      
      // Log the status addition activity
      try {
        const stageTitle = PIPELINE_STAGES[stage]?.title || stage;
        const reasonText = statusData.customReason || statusData.reason;
        await activityLogApi.createActivityLog(
          dealId, 
          `added ${stageTitle.toLowerCase()} reason '${reasonText.replace('_', ' ')}'`
        );
      } catch (logError) {
        console.error('Error logging status activity:', logError);
      }
      
      // Update deal stage if we have a pending drag result
      if (pendingDragResult) {
        await completeDealStageUpdate(pendingDragResult, dealId, stage);
      }

      await fetchDeals();
      notifyCrmDataUpdated('pipeline-stage-update');
      handleCloseModals();
    } catch (error) {
      console.error('Error saving deal status:', error);
      setError(`Failed to save deal status: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  // NOTE: completeDealStageUpdate is intentionally omitted to avoid callback re-binding churn during DnD updates.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusModalData, pendingDragResult, fetchDeals, handleCloseModals, notifyCrmDataUpdated]);

  // Complete the deal stage update after status is saved
  const completeDealStageUpdate = useCallback(async (dragResult, dealId, newStage) => {
    try {
      const deal = deals.find(d => d.ID === dealId);
      const dealName = `${deal.AccountName} - ${deal.ServiceType}`;
      const oldStage = deal?.Stage;
      
      await dealsApi.updateDealStage(dealId, newStage, oldStage, dealName);
      notifyCrmDataUpdated('pipeline-stage-update');
      
      // Trigger confetti if deal was moved to DEAL_WON
      if (newStage === 'DEAL_WON') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (error) {
      console.error('Error updating deal stage:', error);
      setError(`Failed to move deal: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    }
  }, [deals, notifyCrmDataUpdated]);

  // Handle editing existing deal status
  const handleEditDealStatus = useCallback((deal) => {
    const existingStatus = dealStatuses[deal.ID];
    if (!existingStatus) return;

    setStatusModalData({
      deal,
      newStage: deal.Stage,
      existingStatus,
      isEditing: true
    });
    setShowStatusModal(true);
  }, [dealStatuses]);

  // Handle deal updated from admin edit
  const handleDealUpdated = useCallback(async (updatedDeal) => {
    try {
      // Update the deal in the local state
      setDeals(prevDeals => 
        prevDeals.map(deal => 
          deal.ID === updatedDeal.ID ? updatedDeal : deal
        )
      );
      
      // Update the selected deal if it's the one being viewed
      if (selectedDeal && selectedDeal.ID === updatedDeal.ID) {
        setSelectedDeal(updatedDeal);
      }
      
      // Refresh deal statuses in case they were affected
      await fetchDealStatuses([updatedDeal]);
    } catch (error) {
      console.error('Error handling deal update:', error);
      // Fallback: refresh all deals
      await fetchDeals();
    }
  }, [selectedDeal, fetchDealStatuses, fetchDeals]);

    // Optimized drag end handler with status modal logic
    const handleDragEnd = useCallback(async (result) => {
      const { destination, source, draggableId } = result;
  
      if (!destination) return;
      if (destination.droppableId === source.droppableId && destination.index === source.index) return;
  
      const dealId = parseInt(draggableId.replace('deal-', ''));
      const dealIndex = deals.findIndex(d => d.ID === dealId);
      
      if (dealIndex === -1) {
        console.error('Deal not found:', dealId);
        return;
      }
  
      const deal = deals[dealIndex];
      
      // Safety check: Only allow dragging if backend says it's draggable
      if (!deal.Draggable) {
        console.warn('Attempted to drag a non-draggable deal:', deal.ID);
        return;
      }
      
      const newStage = destination.droppableId;
      const oldStage = deal.Stage;
  
      // Handle reordering within the same stage - no stage change needed
      if (oldStage === newStage) {
        // For same-stage moves, we let dnd library handle visual reordering
        // The actual order will be restored on next render due to our sorting logic
        // This prevents the hanging issue while maintaining sort order
        return;
      }
  
      // Show confirmation modal for stage change
      setPendingMove({
        result,
        deal,
        newStage,
        oldStage,
        dealIndex
      });
      setShowMoveConfirmation(true);
    }, [deals]);

  // Add confirm move handler
  const handleConfirmMove = useCallback(async (moveMeta = {}) => {
    if (!pendingMove) return;

    const { result, deal, newStage, oldStage, dealIndex } = pendingMove;
    const dealId = deal.ID;

    setShowMoveConfirmation(false);
    setPendingMove(null);

    const existingStatus = dealStatuses[dealId];
    const isNewStageStatusRequired = newStage === 'DEAL_ON_HOLD' || newStage === 'DEAL_LOST';
    const isOldStageStatusRequired = oldStage === 'DEAL_ON_HOLD' || oldStage === 'DEAL_LOST';

    // Check if this stage requires a status (DEAL_ON_HOLD or DEAL_LOST)
    if (isNewStageStatusRequired) {
      // Check if deal already has a status 
      if (existingStatus) {
        // If moving between status stages, need to update
        if (isOldStageStatusRequired && existingStatus.Status !== newStage) {
          setPendingDragResult(result);
          setStatusModalData({
            deal,
            newStage,
            existingStatus,
            isEditing: true
          });
          setShowStatusModal(true);
          return;
        } else if (existingStatus.Status === newStage) {
          // Already has status for this exact stage, proceed with move
          await performOptimisticUpdate(dealIndex, deal, newStage, result, oldStage, moveMeta);
        } else {
          // Has status but for different stage, need new status
          setPendingDragResult(result);
          setStatusModalData({
            deal,
            newStage,
            existingStatus: null,
            isEditing: false
          });
          setShowStatusModal(true);
          return;
        }
      } else {
        // No existing status, need to collect status information
        setPendingDragResult(result);
        setStatusModalData({
          deal,
          newStage,
          existingStatus: null,
          isEditing: false
        });
        setShowStatusModal(true);
        return;
      }
    } else {
      // Moving to a stage that doesn't require status
      if (isOldStageStatusRequired && existingStatus) {
        // Delete the status when moving away from status stages
        try {
          await dealStatusApi.deleteDealStatus(existingStatus.ID);
          setDealStatuses(prev => {
            const updated = { ...prev };
            delete updated[dealId];
            return updated;
          });
        } catch (error) {
          console.error('Error deleting deal status:', error);
        }
      }
      
      await performOptimisticUpdate(dealIndex, deal, newStage, result, oldStage, moveMeta);
    }
  // NOTE: performOptimisticUpdate is intentionally omitted to keep move-confirm flow stable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMove, dealStatuses]);

  // Perform optimistic update and API call
  const performOptimisticUpdate = useCallback(async (dealIndex, deal, newStage, dragResult, oldStage, moveMeta = {}) => {
    const optimisticDeals = [
      ...deals.slice(0, dealIndex),
      { ...deal, Stage: newStage },
      ...deals.slice(dealIndex + 1)
    ];
    
    setDeals(optimisticDeals);
    setIsUpdating(true);

    try {
      const dealName = `${deal.AccountName} - ${deal.ServiceType}`;
      await dealsApi.updateDealStage(deal.ID, newStage, oldStage, dealName);
      notifyCrmDataUpdated('pipeline-stage-update');

      // If user directly moved Enquiry -> Offer, log feasibility confirmation note.
      if (
        oldStage === 'NEW' &&
        newStage === 'OFFER_SUBMITTED' &&
        moveMeta?.feasibilityReason
      ) {
        try {
          await activityLogApi.createActivityLog(
            deal.ID,
            `confirmed feasibility before direct move to Offer: ${moveMeta.feasibilityReason}`
          );
        } catch (logError) {
          console.error('Error logging feasibility confirmation:', logError);
        }
      }
      
      // Trigger confetti if deal was moved to DEAL_WON
      if (newStage === 'DEAL_WON') {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5000);
      }
    } catch (error) {
      console.error('Error updating deal stage:', error);
      setDeals(deals); // Revert optimistic update
      setError(`Failed to move deal: ${error.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsUpdating(false);
    }
  }, [deals, notifyCrmDataUpdated]);

  // Add handle edit deal function
  const handleEditDeal = useCallback((deal) => {
    setEditingDeal(deal);
    setShowEditModal(true);
  }, []);

  // Add handle deal update function
  const handleDealUpdate = useCallback(async (dealId, updateData) => {
    try {
      setIsUpdating(true);
      const deal = deals.find(d => d.ID === dealId);
      const dealName = deal ? `${deal.AccountName} - ${deal.ServiceType}` : '';
      await dealsApi.updateDeal(dealId, updateData, dealName, deal);
      await fetchDeals();
      notifyCrmDataUpdated('pipeline-deal-edit');
    } catch (error) {
      console.error('Error updating deal:', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [deals, fetchDeals, notifyCrmDataUpdated]);

  // Handle temperature change
  const handleTemperatureChange = useCallback(async (dealId, temperature) => {
    try {
      setIsUpdating(true);
      await dealsApi.updateDealTemperature(dealId, temperature);
      
      // Optimistically update the local state
      setDeals(prevDeals => 
        prevDeals.map(deal => 
          deal.ID === dealId ? { ...deal, Temperature: temperature } : deal
        )
      );
    } catch (error) {
      console.error('Error updating deal temperature:', error);
      setError(`Failed to update deal temperature: ${error.message}`);
      setTimeout(() => setError(null), 5000);
      
      // Revert optimistic update by refetching
      await fetchDeals();
      throw error;
    } finally {
      setIsUpdating(false);
    }
  }, [fetchDeals]);

  // Handle reassign deals
  const handleReassignDeals = useCallback(() => {
    setShowReassignModal(true);
  }, []);

  // Handle successful reassignment
  const handleReassignSuccess = useCallback(async (result) => {
    try {
      // Refresh deals to show updated salesperson assignments
      await fetchDeals();
      notifyCrmDataUpdated('pipeline-reassign');
      
      // Show success message
      console.log(`Successfully reassigned ${result.total_reassigned} deals to ${result.new_salesperson.name}`);
    } catch (error) {
      console.error('Error refreshing deals after reassignment:', error);
    }
  }, [fetchDeals, notifyCrmDataUpdated]);

  // Add search handler
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
  }, []);

  // Clear search handler
  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  // Safety check for PIPELINE_STAGES before rendering
  if (!PIPELINE_STAGES || typeof PIPELINE_STAGES !== 'object') {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <div className="bg-white border-b border-gray-200 p-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sales Pipeline</h1>
              <p className="text-gray-600 mt-1">Configuration Error</p>
            </div>
          </div>
        </div>
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-red-800 font-medium">Configuration Error</h3>
                <p className="text-red-600 text-sm mt-1">Pipeline stages configuration is missing or invalid.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !deals.length) {
    return (
      <div className="min-h-screen flex flex-col">
        <PipelineHeader 
          isLoading={isLoading}
          isUpdating={isUpdating}
          error={null}
          onRefresh={fetchDeals}
          onClearError={handleClearError}
          onReassignDeals={handleReassignDeals}
          searchTerm={searchTerm}
          onSearchChange={handleSearchChange}
          onClearSearch={handleClearSearch}
          totalDeals={deals.length}
          filteredDeals={filteredDeals.length}
        />
        
        <div className="flex-1 p-6 flex items-center justify-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="text-red-800 font-medium">Error Loading Pipeline</h3>
                <p className="text-red-600 text-sm mt-1">{error}</p>
              </div>
            </div>
            <button 
              onClick={fetchDeals}
              className="mt-3 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ensure we have valid stages to render
  const stageEntries = PIPELINE_STAGES ? Object.values(PIPELINE_STAGES) : [];

  return (
    <>
      <div className="pipeline-container h-full bg-gray-50">
        {/* Fixed Header */}
        <div className="pipeline-header">
          <PipelineHeader 
            isLoading={isLoading}
            isUpdating={isUpdating}
            error={deals.length > 0 ? error : null}
            onRefresh={fetchDeals}
            onClearError={handleClearError}
            onReassignDeals={handleReassignDeals}
            searchTerm={searchTerm}
            onSearchChange={handleSearchChange}
            onClearSearch={handleClearSearch}
            totalDeals={deals.length}
            filteredDeals={filteredDeals.length}
          />
        </div>

        {/* Scrollable Pipeline Content */}
        <div className="pipeline-content">
          {isLoading ? (
            <div className="h-full flex justify-center items-center">
              <div className="flex items-center">
                <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"></circle>
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" className="opacity-75"></path>
                </svg>
                <span className="text-gray-600">Loading pipeline...</span>
              </div>
            </div>
          ) : (
            <div className="pipeline-scroll-area">
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-4 p-6" style={{ minWidth: 'max-content', minHeight: '100%' }}>
                  {stageEntries.map((stage) => {
                    const stageDeals = dealsByStage[stage.id] || [];
                    const stats = stageStats[stage.id] || { count: 0, totalValue: 0 };

                    return (
                      <StageColumn
                        key={stage.id}
                        stage={stage}
                        deals={stageDeals}
                        totalValue={stats.totalValue}
                        count={stats.count}
                        onCardClick={handleViewDeal}
                        dealStatuses={dealStatuses}
                        onEditDealStatus={handleEditDealStatus}
                        onClearDeal={handleClearDeal}
                        onEditDeal={handleEditDeal}
                        onTemperatureChange={handleTemperatureChange}
                      />
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ViewDealModal
        deal={selectedDeal}
        isOpen={showViewModal}
        onClose={handleCloseModals}
        dealStatus={selectedDeal ? dealStatuses[selectedDeal.ID] : null}
        onEditDealStatus={handleEditDealStatus}
        onTemperatureChange={handleTemperatureChange}
        onDealUpdated={handleDealUpdated}
      />

      <DealStatusModal
        isOpen={showStatusModal}
        onClose={handleCloseModals}
        onSubmit={handleDealStatusSubmit}
        deal={statusModalData.deal}
        newStage={statusModalData.newStage}
        existingStatus={statusModalData.existingStatus}
        isEditing={statusModalData.isEditing}
      />

      <EditDealModal
        isOpen={showEditModal}
        onClose={handleCloseModals}
        deal={editingDeal}
        onUpdate={handleDealUpdate}
      />

      <MoveConfirmationModal
        isOpen={showMoveConfirmation}
        onConfirm={handleConfirmMove}
        onCancel={handleCloseModals}
        deal={pendingMove?.deal}
        newStage={pendingMove?.newStage}
        oldStage={pendingMove?.oldStage}
      />

      <ReassignDealModal
        isOpen={showReassignModal}
        onClose={handleCloseModals}
        onReassignSuccess={handleReassignSuccess}
      />

      {/* Confetti for Deal Won */}
      {showConfetti && (
        <Confetti
          width={windowDimensions.width}
          height={windowDimensions.height}
          recycle={false}
          numberOfPieces={200}
          gravity={0.3}
        />
      )}
    </>
  );
};

export default Pipeline;
