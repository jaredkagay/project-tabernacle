// src/components/PlanPage/OrderOfService.jsx
import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import SortableServiceItem from './SortableServiceItem'; 
import './OrderOfService.css';

// Added 'showTimes = true' to the props below
const OrderOfService = ({ items, onOrderChange, onDeleteItem, onEditItem, assignedPeople, onUpdateKey, userRole, showTimes = true }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!items) { 
    return <p>Loading service items...</p>;
  }
  if (items.length === 0) {
    return <p>No items in the order of service yet.</p>;
  }

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newOrderedItems = arrayMove(items, oldIndex, newIndex);
      onOrderChange(newOrderedItems); 
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(item => item.id)} 
        strategy={verticalListSortingStrategy}
      >
        <div className="order-of-service-list">
          <ul>
            {items.map((item, index) => (
              <SortableServiceItem 
                key={item.id} 
                id={item.id} 
                item={item} 
                index={index} 
                onDelete={onDeleteItem}
                onEdit={onEditItem}
                assignedPeople={assignedPeople}
                onUpdateKey={onUpdateKey}
                userRole={userRole}
                showTimes={showTimes} /* Passed down here */
              />
            ))}
          </ul>
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default OrderOfService;