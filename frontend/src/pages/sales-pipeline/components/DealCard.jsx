import React from 'react';
import { Draggable } from 'react-beautiful-dnd';
import { formatIndianCurrency } from '../utils/formatters';
import { getDivisionConfig, getDivisionLabel } from '../../../config/divisions';
import { getReasonLabel } from '../../../config/deal-status-reasons-master';
import { UserIcon } from '@heroicons/react/24/outline';
import DealTemperature from './DealTemperature';


// Deal Card Component
const DealCard = ({ deal, index, onCardClick, dealStatus = null, onEditDealStatus = () => {}, onClearDeal = () => {}, onEditDeal = () => {}, onTemperatureChange = () => {} }) => {
  const divisionConfig = getDivisionConfig(deal.Division);
  const isPendingApproval = deal.Status === 'PENDING';
  const isRejected = deal.Status === 'REJECTED';
  const isLost = deal.Stage === 'DEAL_LOST';
  
  // Use backend-provided Draggable property instead of local logic
  const isDragDisabled = !deal.Draggable;

  const handleClick = (e) => {
    // Prevent click during drag
    if (e.defaultPrevented) return;
    onCardClick?.(deal);
  };

  const handleEditStatus = (e) => {
    e.stopPropagation(); // Prevent card click
    onEditDealStatus(deal);
  };

  const handleClearDeal = (e) => {
    e.stopPropagation(); // Prevent card click
    onClearDeal(deal);
  };

  const handleEditDeal = (e) => {
    e.stopPropagation(); // Prevent card click
    onEditDeal(deal);
  };

  const showStatus = dealStatus && (deal.Stage === 'DEAL_ON_HOLD' || deal.Stage === 'DEAL_LOST');

  return (
    <Draggable 
      draggableId={`deal-${deal.ID}`} 
      index={index}
      isDragDisabled={isDragDisabled}
    >
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={handleClick}
          className={`
            p-3 mb-2 bg-white rounded-lg shadow-sm border-2 transition-all duration-150 
            ${isPendingApproval 
              ? 'cursor-pointer border-orange-200 bg-orange-50' 
              : isRejected 
                ? 'cursor-pointer border-red-200 bg-red-50'
                : isLost
                  ? 'cursor-pointer border-gray-200 bg-gray-50'
                  : deal.Draggable
                    ? 'cursor-grab active:cursor-grabbing hover:cursor-pointer'
                    : 'cursor-pointer'
            }
            ${!isPendingApproval && !isRejected && !isLost && divisionConfig.borderColor}
            ${snapshot.isDragging ? 
              `shadow-lg ring-2 ${divisionConfig.ringColor} ring-opacity-50 transform rotate-1 scale-105` : 
              'hover:shadow-md'
            }
            ${(isPendingApproval || isRejected || isLost || !deal.Draggable) ? 'opacity-90' : ''}
          `}
          style={{
            ...provided.draggableProps.style,
            transform: snapshot.isDragging 
              ? `${provided.draggableProps.style?.transform} rotate(1deg) scale(1.05)`
              : provided.draggableProps.style?.transform
          }}
        >
          {/* Approval Status Banner */}
          {isPendingApproval && (
            <div className="mb-2 -mx-3 -mt-3 px-3 py-2 bg-orange-100 border-b border-orange-200">
              <div className="flex items-center text-xs text-orange-700">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-medium">
                  {deal.Flag === 'KAM_APPROVAL' ? 'Pending KAM Approval' : 
                   deal.Flag === 'DUPLICATE' ? 'Pending MD Office Approval' : 
                   'Pending Approval'}
                </span>
              </div>
            </div>
          )}

          {/* Rejected Status Banner */}
          {isRejected && (
            <div className="mb-2 -mx-3 -mt-3 px-3 py-2 bg-red-100 border-b border-red-200">
              <div className="flex items-center justify-between text-xs text-red-700">
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="font-medium">Rejected</span>
                </div>
                <button
                  onClick={handleClearDeal}
                  className="text-red-600 hover:text-red-800 font-medium"
                  title="Clear this deal from view"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Lost Deal Banner */}
          {isLost && !isRejected && (
            <div className="mb-2 -mx-3 -mt-3 px-3 py-2 bg-gray-100 border-b border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-700">
                <div className="flex items-center">
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  <span className="font-medium">Deal Lost</span>
                </div>
                {/* <button
                  onClick={handleClearDeal}
                  className="text-gray-600 hover:text-gray-800 font-medium"
                  title="Clear this deal from view"
                >
                  Clear
                </button> */}
              </div>
            </div>
          )}

          {/* Company and Service Type */}
          <div className="mb-2">
            <h3 className="font-semibold text-gray-900 text-sm truncate leading-tight" title={deal.AccountName}>
              {deal.AccountName}
            </h3>
            <p className="text-xs text-gray-600 truncate leading-tight" title={deal.ServiceType}>
              {deal.ServiceType}
            </p>
          </div>

          {/* Deal Value with Edit Icon */}
          <div className="mb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Value:</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-semibold text-green-600">
                  {formatIndianCurrency(deal.DealValue)}
                </span>
                {deal.Draggable && (
                  <button
                    onClick={handleEditDeal}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit deal"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Division Badge */}
          <div className="mb-2">
            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${divisionConfig.badgeColor}`}>
              {getDivisionLabel(deal.Division)}
            </span>
          </div>

          {/* Deal Temperature - show in Offer stage */}
          {deal.Stage === 'OFFER_SUBMITTED' && (
            <div className="mb-2">
              <DealTemperature
                deal={deal}
                isEditable={deal.Draggable}
                onTemperatureChange={onTemperatureChange}
                compact={true}
              />
            </div>
          )}

          {/* Deal Status (if applicable) */}
          {showStatus && dealStatus && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-gray-500">Reason:</span>
                  <p className="text-xs text-gray-700 font-medium truncate" title={getReasonLabel(dealStatus.Status, dealStatus.Reason)}>
                    {getReasonLabel(dealStatus.Status, dealStatus.Reason)}
                  </p>
                </div>
                {deal.Draggable && (
                  <button
                    onClick={handleEditStatus}
                    className="ml-2 p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="Edit status reason"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Contact Person */}
          {deal.ContactPerson && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center text-xs text-gray-500">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span className="truncate" title={deal.ContactPerson}>
                  {deal.ContactPerson}
                </span>
              </div>
            </div>
          )}

          {/* Salesperson */}
          {deal.SalespersonName && (
            <div className="mt-2 pt-2 border-t border-gray-100">
              <div className="flex items-center text-xs text-gray-500">
                <UserIcon className="w-3 h-3 mr-1" />
                <span className="truncate" title={deal.SalespersonName}>
                  {deal.SalespersonName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default DealCard;
