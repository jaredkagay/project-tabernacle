// src/components/PlanPage/OrderOfService.js
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
import { SortableServiceItem } from './SortableServiceItem'; // Import the new component
import './OrderOfService.css';

const OrderOfService = ({ items, onOrderChange, onDeleteItem, onEditItem, assignedPeople, onUpdateKey }) => { // Receive onOrderChange prop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!items) { // Handle case where items might be null briefly during loading
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
      onOrderChange(newOrderedItems); // Call the callback with the new order
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map(item => item.id)} // Pass array of IDs
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
              />
            ))}
          </ul>
        </div>
      </SortableContext>
    </DndContext>
  );
};

export default OrderOfService;