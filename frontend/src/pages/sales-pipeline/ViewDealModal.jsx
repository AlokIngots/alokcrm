import React, { useState, useEffect, useCallback } from 'react';
import { formatIndianCurrency, formatDate } from './utils/formatters';
import { getDivisionConfig } from '../../config/divisions';
import { getStageById } from '../../config/pipeline-stages';
import { getReasonLabel } from '../../config/deal-status-reasons-master';
import { activityLogApi } from './api/activity-log';
import { notesApi } from './api/notes';
import { permissionsApi } from '../../api/permissions';
import { pipelineApi as dealsApi } from '../../modules/pipeline/api/pipelineApi';
import DealTemperature from './components/DealTemperature';
import EditDealAdminModal from './EditDealAdminModal';
import EditActivityLogDatesModal from './EditActivityLogDatesModal';

const ViewDealModal = ({ deal, isOpen, onClose, dealStatus, onEditDealStatus, onTemperatureChange, onDealUpdated }) => {
  const [activityLogs, setActivityLogs] = useState([]);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'activity', or 'notes'
  const [isEditDealModalOpen, setIsEditDealModalOpen] = useState(false);
  const [isEditActivityDatesModalOpen, setIsEditActivityDatesModalOpen] = useState(false);
  const [isDownloadingOffer, setIsDownloadingOffer] = useState(false);
  const [userPermissions, setUserPermissions] = useState(null);
  
  // Notes state
  const [note, setNote] = useState('');
  const [originalNote, setOriginalNote] = useState('');
  const [isLoadingNote, setIsLoadingNote] = useState(false);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteExists, setNoteExists] = useState(false);

  // Get user permissions when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchUserPermissions();
    }
  }, [isOpen]);

  const fetchUserPermissions = async () => {
    try {
      const permissions = await permissionsApi.getUserPermissions();
      setUserPermissions(permissions.permissions);
    } catch (error) {
      console.error('Error fetching user permissions:', error);
      setUserPermissions(null);
    }
  };

  const fetchActivityLogs = useCallback(async () => {
    if (!deal?.ID) return;
    
    try {
      setIsLoadingActivity(true);
      const logs = await activityLogApi.getActivityLogs({ dealId: deal.ID });
      setActivityLogs(logs);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      setActivityLogs([]);
    } finally {
      setIsLoadingActivity(false);
    }
  }, [deal?.ID]);

  const fetchNote = useCallback(async () => {
    if (!deal?.ID) return;
    
    try {
      setIsLoadingNote(true);
      const noteData = await notesApi.getNote(deal.ID);
      if (noteData) {
        setNote(noteData.Notes || '');
        setOriginalNote(noteData.Notes || '');
        setNoteExists(true);
      } else {
        setNote('');
        setOriginalNote('');
        setNoteExists(false);
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      setNote('');
      setOriginalNote('');
      setNoteExists(false);
    } finally {
      setIsLoadingNote(false);
    }
  }, [deal?.ID]);

  // Fetch activity logs when modal opens and deal changes
  useEffect(() => {
    if (isOpen && deal?.ID) {
      fetchActivityLogs();
      fetchNote();
    }
  }, [isOpen, deal?.ID, fetchActivityLogs, fetchNote]);

  const handleSaveNote = async () => {
    if (!deal?.ID) return;
    
    try {
      setIsSavingNote(true);
      let result;
      
      if (noteExists) {
        result = await notesApi.updateNote(deal.ID, note.trim());
      } else {
        result = await notesApi.createNote(deal.ID, note.trim());
        setNoteExists(true);
      }
      
      setOriginalNote(note.trim());
      console.log('Note saved successfully:', result);
    } catch (error) {
      console.error('Error saving note:', error);
      // You could add a toast notification here for better UX
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleCancelNote = () => {
    setNote(originalNote);
  };

  const hasNoteChanges = note.trim() !== originalNote.trim();

  const formatActivityTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAvatarColor = (name) => {
    if (!name) return 'bg-gray-500';
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 
      'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const parseDealNotes = (notes) => {
    if (!notes) {
      return {
        saleType: null,
        offerNo: null,
        productLines: [],
        orderProgress: null,
        commercial: null
      };
    }

    const lines = notes.split('\n').map((line) => line.trim()).filter(Boolean);
    const fullText = lines.join('\n');
    const productLines = [];
    let inProducts = false;
    let inItems = false;

    const extractValueFromLine = (line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return null;
      return line.slice(idx + 1).trim() || null;
    };

    const extractValue = (lineRegex, textRegex) => {
      const lineMatch = lines.find((line) => lineRegex.test(line));
      if (lineMatch) return extractValueFromLine(lineMatch);
      const textMatch = fullText.match(textRegex);
      return textMatch?.[1]?.trim() || null;
    };

    const sectionHeaderRegex = /^(sale type|offer no|offer number|order progress|commercial|payment terms|payment|delivery|product lines|items)\s*:/i;

    for (const line of lines) {
      if (/^product lines\s*:?/i.test(line)) {
        inProducts = true;
        inItems = false;
        continue;
      }
      if (/^items\s*:?/i.test(line)) {
        inItems = true;
        inProducts = false;
        continue;
      }

      if (inProducts || inItems) {
        if (sectionHeaderRegex.test(line)) {
          inProducts = false;
          inItems = false;
          continue;
        }
        productLines.push(line.replace(/^\d+\.\s*/, '').trim());
      }
    }

    const delivery = extractValue(/^delivery\s*:/i, /delivery\s*:\s*([^;\n]+)/i);
    const payment = extractValue(/^(payment terms|payment)\s*:/i, /payment(?:\s*terms)?\s*:\s*([^;\n]+)/i);
    const commercialLine = extractValue(/^commercial\s*:/i, /commercial\s*:\s*([^;\n]+)/i);
    const commercial = commercialLine || [delivery ? `Delivery: ${delivery}` : null, payment ? `Payment: ${payment}` : null]
      .filter(Boolean)
      .join(' | ') || null;

    return {
      saleType: extractValue(/^sale type\s*:/i, /sale type\s*:\s*([^;\n]+)/i),
      offerNo: extractValue(/^offer (no|number)\s*:/i, /offer\s*(?:no|number)\s*:\s*([^;\n]+)/i),
      productLines: [...new Set(productLines.filter(Boolean))],
      orderProgress: extractValue(/^order progress\s*:/i, /order progress\s*:\s*([^;\n]+)/i),
      commercial
    };
  };

  if (!isOpen || !deal) return null;

  const divisionConfig = getDivisionConfig(deal.Division);
  const hasStatus = dealStatus && (deal.Stage === 'DEAL_ON_HOLD' || deal.Stage === 'DEAL_LOST');
  const currentStage = getStageById(deal.Stage);
  const structuredNotes = parseDealNotes(deal.Notes);

  const handleEditStatus = () => {
    if (onEditDealStatus && hasStatus) {
      onEditDealStatus(deal);
    }
  };

  const handleEditDeal = () => {
    setIsEditDealModalOpen(true);
  };

  const handleEditActivityDates = () => {
    setIsEditActivityDatesModalOpen(true);
  };

  const handleDealUpdated = (updatedDeal) => {
    if (onDealUpdated) {
      onDealUpdated(updatedDeal);
    }
    // Refresh activity logs in case they were affected
    fetchActivityLogs();
  };

  const handleActivityDatesUpdated = (result) => {
    console.log('Activity dates updated:', result);
    // Refresh activity logs to show updated dates
    fetchActivityLogs();
  };

  const handleDownloadOfferLetter = async () => {
    if (!deal?.ID) return;
    try {
      setIsDownloadingOffer(true);
      const { blob, filename } = await dealsApi.downloadOfferLetter(deal.ID);
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download offer letter:', error);
      alert(error.message || 'Failed to download offer letter');
    } finally {
      setIsDownloadingOffer(false);
    }
  };

  // Check if user has deals edit permission and deal is not won/lost
  const hasDealsEditPermission = userPermissions?.deals?.edit === true;
  const canEditDeal = hasDealsEditPermission && deal?.Stage !== 'DEAL_WON' && deal?.Stage !== 'DEAL_LOST';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Deal Details</h2>
          <div className="flex items-center space-x-3">
            {canEditDeal && (
              <button
                onClick={handleEditDeal}
                className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors flex items-center"
                title="Edit deal details"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Deal
              </button>
            )}
            {deal?.Stage === 'OFFER_SUBMITTED' && (
              <button
                onClick={handleDownloadOfferLetter}
                disabled={isDownloadingOffer}
                className="px-3 py-1 text-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-md transition-colors flex items-center disabled:opacity-60"
                title="Download offer letter"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
                </svg>
                {isDownloadingOffer ? 'Downloading...' : 'Download Offer Letter'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('details')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Deal Details
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'activity'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Activity Log
              {activityLogs.length > 0 && (
                <span className="ml-2 bg-blue-100 text-blue-600 text-xs rounded-full px-2 py-1">
                  {activityLogs.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('notes')}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === 'notes'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Notes
             
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="rounded-xl border border-gray-200 bg-gradient-to-r from-gray-50 to-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Account</p>
                    <h3 className="text-xl font-semibold text-gray-900">{deal.AccountName}</h3>
                    <p className="text-sm text-gray-600 mt-1">{deal.ServiceType}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium ${divisionConfig.badgeColor}`}>
                        {divisionConfig.label}
                      </span>
                      {structuredNotes.saleType && (
                        <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          {structuredNotes.saleType}
                        </span>
                      )}
                      <span className="inline-flex px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {currentStage?.title || deal.Stage}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Deal Value</p>
                    <p className="text-3xl font-bold text-green-600">{formatIndianCurrency(deal.DealValue)}</p>
                    {structuredNotes.offerNo && (
                      <p className="text-xs text-gray-500 mt-2">Offer No: {structuredNotes.offerNo}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Deal Status Information */}
              {hasStatus && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                        <svg className="w-5 h-5 text-orange-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        {deal.Stage === 'DEAL_ON_HOLD' ? 'Deal on Hold' : 'Deal Lost'} Details
                      </h4>
                      
                      <div className="space-y-3">
                        <div>
                          <span className="text-sm font-medium text-gray-500">Reason:</span>
                          <p className="text-sm text-gray-900 mt-1">
                            {getReasonLabel(dealStatus.Status, dealStatus.Reason)}
                            {dealStatus.CustomReason && (
                              <span className="text-gray-600"> - {dealStatus.CustomReason}</span>
                            )}
                          </p>
                        </div>
                        
                        {dealStatus.Notes && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">Notes:</span>
                            <p className="text-sm text-gray-900 mt-1 whitespace-pre-wrap">{dealStatus.Notes}</p>
                          </div>
                        )}
                        
                        {dealStatus.CreatedAt && (
                          <div>
                            <span className="text-sm font-medium text-gray-500">Date:</span>
                            <p className="text-sm text-gray-900 mt-1">
                              {formatDate(dealStatus.CreatedAt)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {onEditDealStatus && (
                      <button
                        onClick={handleEditStatus}
                        className="ml-4 px-3 py-1 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors flex items-center"
                        title="Edit status reason"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900">Customer & Ownership</h4>
                  <div>
                    <p className="text-xs text-gray-500">Contact Person</p>
                    <p className="text-sm text-gray-900">{deal.ContactName || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Salesperson</p>
                    <p className="text-sm text-gray-900">{deal.SalespersonName || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">KAM</p>
                    <p className="text-sm text-gray-900">{deal.KAMName || 'Not assigned'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Lead Source</p>
                    <p className="text-sm text-gray-900">{deal.LeadSource || 'Not specified'}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4 space-y-3">
                  <h4 className="font-semibold text-gray-900">Timeline & Stage</h4>
                  <div>
                    <p className="text-xs text-gray-500">Expected Closure Date</p>
                    <p className="text-sm text-gray-900">{formatDate(deal.ExpectedClosureDate)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Current Stage</p>
                    <p className="text-sm text-gray-900">{currentStage?.title || deal.Stage}</p>
                  </div>
                  {structuredNotes.orderProgress && (
                    <div>
                      <p className="text-xs text-gray-500">Order Progress</p>
                      <p className="text-sm text-gray-900">{structuredNotes.orderProgress}</p>
                    </div>
                  )}
                  {deal.Stage === 'OFFER_SUBMITTED' && (
                    <DealTemperature
                      deal={deal}
                      isEditable={deal.Draggable}
                      onTemperatureChange={onTemperatureChange}
                      compact={false}
                    />
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Product Lines</h4>
                {structuredNotes.productLines.length > 0 ? (
                  <div className="space-y-2">
                    {structuredNotes.productLines.map((line, idx) => (
                      <div key={idx} className="text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
                        {line}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No structured product lines found.</p>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Commercial</h4>
                <p className="text-sm text-gray-700">{structuredNotes.commercial || 'Not specified'}</p>
              </div>

              {deal.Notes && (
                <div className="rounded-lg border border-gray-200 p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">Raw Notes</h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm">{deal.Notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
                <div className="flex space-x-2">
                  {hasDealsEditPermission && activityLogs.length > 0 && (
                    <button
                      onClick={handleEditActivityDates}
                      className="px-3 py-1 text-sm bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors flex items-center"
                      title="Edit activity dates"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Edit Dates
                    </button>
                  )}
                  <button
                    onClick={fetchActivityLogs}
                    disabled={isLoadingActivity}
                    className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors flex items-center disabled:opacity-50"
                  >
                    <svg className={`w-4 h-4 mr-1 ${isLoadingActivity ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>

              {isLoadingActivity ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading activity...</span>
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p>No activity recorded for this deal yet.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {activityLogs.map((log) => (
                    <div key={log.ID} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(log.UserName)}`}>
                        {getInitials(log.UserName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.UserName}</span> {log.Action}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatActivityTime(log.CreatedAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Deal Notes</h3>
                <button
                  onClick={fetchNote}
                  disabled={isLoadingNote}
                  className="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors flex items-center disabled:opacity-50"
                >
                  <svg className={`w-4 h-4 mr-1 ${isLoadingNote ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>

              {isLoadingNote ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-gray-600">Loading note...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Notes
                    </label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Add your notes about this deal...(These are only visible to you)"
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-vertical min-h-[200px]"
                      rows={8}
                    />
                  </div>

                  {hasNoteChanges && (
                    <div className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-yellow-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span className="text-sm text-yellow-700">You have unsaved changes</span>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={handleCancelNote}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                         type="button" 
                          onClick={handleSaveNote}
                          disabled={isSavingNote}
                          className="px-4 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 flex items-center"
                        >
                          {isSavingNote ? (
                            <>
                              <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Saving...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Save Note
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasNoteChanges && noteExists && originalNote.trim() && (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center">
                        <svg className="w-5 h-5 text-green-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm text-green-700">Note saved successfully</span>
                      </div>
                    </div>
                  )}

     
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edit Deal Modal */}
      {canEditDeal && (
        <EditDealAdminModal
          isOpen={isEditDealModalOpen}
          onClose={() => setIsEditDealModalOpen(false)}
          deal={deal}
          onDealUpdated={handleDealUpdated}
        />
      )}

      {/* Edit Activity Log Dates Modal */}
      {hasDealsEditPermission && (
        <EditActivityLogDatesModal
          isOpen={isEditActivityDatesModalOpen}
          onClose={() => setIsEditActivityDatesModalOpen(false)}
          deal={deal}
          activityLogs={activityLogs}
          onDatesUpdated={handleActivityDatesUpdated}
        />
      )}
    </div>
  );
};

export default React.memo(ViewDealModal);
