import React from 'react';
import { Droppable } from 'react-beautiful-dnd';
import { formatIndianCurrency } from '../utils/formatters';
import DealCard from './DealCard';
import { PlusIcon } from '@heroicons/react/24/outline';

// Stage Column Component with default parameters
const StageColumn = ({ 
  stage, 
  deals = [], 
  totalValue = 0, 
  count = 0,
  onCardClick = () => {},
  dealStatuses = {},
  onEditDealStatus = () => {},
  onClearDeal = () => {},
  onEditDeal = () => {},
  onTemperatureChange = () => {}
}) => (
  <div className="flex-shrink-0 w-64">
    <div className={`rounded-lg ${stage.color} border border-gray-200 stage-column`}>
      {/* Stage Header */}
      <div className={`rounded-t-lg ${stage.headerColor} p-3 border-b border-gray-200 flex-shrink-0 sticky top-0 z-10`}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">{stage.title}</h2>
            <p className="text-xs text-gray-600">{count} deals</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              {formatIndianCurrency(totalValue)}
            </p>
          </div>
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`
              stage-droppable-area p-3 transition-all duration-150
              ${snapshot.isDraggingOver ? 'bg-blue-50 bg-opacity-70' : ''}
            `}
          >
            {deals.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-400 text-sm">
                <div className="text-center">
                  <PlusIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <span className="text-xs font-medium">Drop deals here</span>
                </div>
              </div>
            ) : (
              deals.map((deal, index) => (
                <DealCard 
                  key={deal.ID} 
                  deal={deal} 
                  index={index} 
                  onCardClick={onCardClick}
                  dealStatus={dealStatuses[deal.ID] || null}
                  onEditDealStatus={onEditDealStatus}
                  onClearDeal={onClearDeal}
                  onEditDeal={onEditDeal}
                  onTemperatureChange={onTemperatureChange}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  </div>
);

// Use React.memo without defaultProps to avoid the warning
export default React.memo(StageColumn);
