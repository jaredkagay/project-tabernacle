// src/components/PlanPage/PlanPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ServiceDetails from './ServiceDetails';
import OrderOfService from './OrderOfService';
import AssignedPeople from './AssignedPeople';
import AddItemForm from './AddItemForm';
import WeeklyChecklist from './WeeklyChecklist';
import { supabase } from '../../supabaseClient'; // Adjust path if needed
import './PlanPage.css'; // Main CSS for PlanPage
import EditServiceItemForm from './EditServiceItemForm';
import EditEventInfoForm from './EditEventInfoForm';

// Define the hardcoded tasks here or import from a constants file
const PREDEFINED_CHECKLIST_TASKS = [
  "Designate Bible verse reader",
  "Confirm guest speaker (if any)",
  "Organize worship team members and song list",
  "Prepare sermon/message notes & slides",
  "Coordinate with sound/AV team",
  "Plan welcome/greeting team assignments",
  "Prepare announcements and collect prayer requests",
  "Ensure children's ministry is staffed and prepared",
  "Check supplies (communion elements, bulletins, etc.)",
  "Review previous week's feedback/notes"
];

const PlanPage = () => {
  const { planId } = useParams(); // Get planId from URL
  const navigate = useNavigate();

  // State variables
  const [eventDetails, setEventDetails] = useState(null);
  const [orderOfService, setOrderOfService] = useState([]);
  const [assignedPeople, setAssignedPeople] = useState([]);
  const [checklistStatus, setChecklistStatus] = useState({}); // For { "0": true, "1": false }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAddItemFormVisible, setIsAddItemFormVisible] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false); // For edit modal
  const [editingItem, setEditingItem] = useState(null); // To store item being edited
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);

  // Helper to initialize checklist status from DB or defaults
  const initializeChecklistStatus = (dbStatus) => {
    const initialStatus = {};
    PREDEFINED_CHECKLIST_TASKS.forEach((task, index) => {
      initialStatus[index] = dbStatus && dbStatus[index] !== undefined ? dbStatus[index] : false;
    });
    return initialStatus;
  };

  // Fetch all data for the current plan
  const fetchPlanData = useCallback(async () => {
    if (!planId) {
      setError("No Plan ID provided in the URL.");
      setLoading(false);
      setEventDetails(null); setOrderOfService([]); setAssignedPeople([]); setChecklistStatus(initializeChecklistStatus(null));
      return;
    }
    setLoading(true); setError(null);
    try {
      // Fetch Event Details (including checklist_status)
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*, checklist_status')
        .eq('id', planId)
        .single();
      if (eventError) throw eventError; // Error if event not found or RLS issue
      setEventDetails(eventData);
      setChecklistStatus(initializeChecklistStatus(eventData?.checklist_status));

      // Fetch Order of Service Items
      const { data: orderData, error: orderError } = await supabase
        .from('service_items')
        .select('*')
        .eq('event_id', planId)
        .order('sequence_number', { ascending: true });
      if (orderError) throw orderError;
      setOrderOfService(orderData || []);

      // Fetch Assigned People
      const { data: peopleData, error: peopleError } = await supabase
        .from('event_assignments')
        .select('*')
        .eq('event_id', planId);
      if (peopleError) throw peopleError;
      setAssignedPeople(peopleData || []);

    } catch (err) {
      console.error("Error fetching plan data:", err);
      const errorMessage = err.message.includes("JSON object requested, multiple (or no) rows returned")
        ? `No event found with ID: ${planId}, or multiple events returned.`
        : err.message || 'Failed to fetch plan data.';
      setError(errorMessage);
      setEventDetails(null); setOrderOfService([]); setAssignedPeople([]); setChecklistStatus(initializeChecklistStatus(null));
    } finally {
      setLoading(false);
    }
  }, [planId]); // Dependency: planId

  // useEffect to call fetchPlanData when planId changes
  useEffect(() => {
    fetchPlanData();
  }, [fetchPlanData]); // fetchPlanData is memoized with planId as dependency

  // Handler for toggling checklist items
  const handleChecklistToggle = async (taskIndex) => {
    const newStatus = {
      ...checklistStatus,
      [taskIndex]: !checklistStatus[taskIndex]
    };
    setChecklistStatus(newStatus); // Optimistic UI update

    try {
      const { error: updateError } = await supabase
        .from('events')
        .update({ checklist_status: newStatus })
        .eq('id', planId);
      if (updateError) throw updateError;
      console.log('Checklist status updated in Supabase.');
    } catch (err) {
      console.error('Failed to update checklist status in Supabase:', err);
      setError('Failed to save checklist update. ' + err.message);
      // Optionally revert optimistic update by re-fetching or setting state back
      // fetchPlanData(); // Or setChecklistStatus(checklistStatus); to revert (might need original)
    }
  };

  // Handler for adding a new item to the order of service
  const handleAddItem = async (newItemFromForm) => {
    if (!planId) {
        alert("Cannot add item: Event ID is missing.");
        return;
    }
    try {
      // Calculate next sequence number based on the current, correctly sequenced list
      const currentMaxSequence = orderOfService.reduce((max, item) => Math.max(max, item.sequence_number !== null ? item.sequence_number : -1), -1);
      
      const itemToInsert = {
        ...newItemFromForm,
        event_id: planId,
        sequence_number: currentMaxSequence + 1,
      };

      if (itemToInsert.id === '' || itemToInsert.id === undefined) {
        delete itemToInsert.id;
      }

      const { data: newlyAddedItem, error: insertError } = await supabase // Renamed 'data' to 'newlyAddedItem'
        .from('service_items')
        .insert([itemToInsert])
        .select()
        .single(); // .single() returns an object, or null if no row (though insert should return it)

      if (insertError) throw insertError;

      if (newlyAddedItem) { // Check if newlyAddedItem is not null
        // Add the single new item (object) to the list and re-sort
        // The sort should now work correctly because all existing items have proper sequence numbers
        setOrderOfService(prevItems => 
            [...prevItems, newlyAddedItem].sort((a,b) => (a.sequence_number || 0) - (b.sequence_number || 0))
        );
        setIsAddItemFormVisible(false);
      } else {
        // This case should ideally not happen if insert was successful and .select().single() was used.
        // But if it does, re-fetch to be safe.
        console.warn("Newly added item data was not returned as expected. Re-fetching list.");
        fetchPlanData();
        setIsAddItemFormVisible(false);
      }
    } catch (err) {
      console.error("Error adding item to Supabase:", err);
      alert(`Failed to add item: ${err.message}`);
    }
  };

  // Handler for reordering service items
  const handleOrderOfServiceChange = async (newOrderedItemsFromDrag) => {
    // 1. Create a new array with items having their sequence_number property updated
    //    according to their new position in the list.
    const resequencedItemsForState = newOrderedItemsFromDrag.map((item, index) => ({
      ...item,
      sequence_number: index, // Assign the new sequence number based on the new visual order
    }));

    // 2. Optimistically update local state with these correctly re-sequenced items
    setOrderOfService(resequencedItemsForState);

    // 3. Prepare updates for Supabase using these re-sequenced items
    //    (This ensures the sequence numbers sent to Supabase match the local state's new truth)
    const updatesForSupabase = resequencedItemsForState.map(item => ({
      id: item.id,
      sequence_number: item.sequence_number,
    }));

    try {
      const updatePromises = updatesForSupabase.map(update =>
        supabase
          .from('service_items')
          .update({ sequence_number: update.sequence_number })
          .eq('id', update.id)
      );
      const results = await Promise.all(updatePromises);

      results.forEach(result => {
        if (result.error) {
          console.error('Supabase update error for an item during reorder:', result.error);
          // It's important to throw an error here to be caught by the catch block
          throw new Error(`Failed to update item order: ${result.error.details || result.error.message}`);
        }
      });
      console.log('Order of service updated successfully in Supabase.');
      // At this point, the local state (set optimistically) and DB state should match.
      // No need to re-fetch if all updates were successful.

    } catch (err) {
      console.error('Failed to update order of service in Supabase:', err);
      setError(`Failed to save new order: ${err.message}. The list might be out of sync. Consider refreshing.`);
      // IMPORTANT: If Supabase updates fail, the optimistic local state is now incorrect.
      // You should revert the optimistic update by re-fetching the data from Supabase.
      fetchPlanData(); // Re-fetch to ensure consistency with the database
    }
  };

  // Handler for toggling the Add Item Form modal
  const toggleAddItemForm = () => {
    setIsAddItemFormVisible(prevState => !prevState);
  };

  const handleDeleteItem = async (itemIdToDelete) => {
    try {
      // 1. Delete from Supabase
      const { error: deleteError } = await supabase
        .from('service_items')
        .delete()
        .eq('id', itemIdToDelete);

      if (deleteError) throw deleteError;

      // 2. Update local state
      const updatedOrderOfService = orderOfService.filter(item => item.id !== itemIdToDelete);
      
      // 3. Re-sequence the remaining items (optional but good for consistency)
      // The existing handleOrderOfServiceChange function already does this if you call it.
      // It updates local state and then updates Supabase with new sequence numbers.
      const resequencedItems = updatedOrderOfService.map((item, index) => ({
        ...item,
        sequence_number: index
      }));
      setOrderOfService(resequencedItems); // Update UI immediately with re-sequenced items

      // 4. Persist the new sequence numbers for all remaining items
      // This is important because deleting an item changes subsequent sequence numbers.
      // We can reuse parts of handleOrderOfServiceChange or make a specific function.
      // For simplicity, let's directly update sequence for remaining items.
      if (resequencedItems.length > 0) {
        const updates = resequencedItems.map(item => ({
          id: item.id,
          sequence_number: item.sequence_number
        }));
        
        const updatePromises = updates.map(update =>
          supabase
            .from('service_items')
            .update({ sequence_number: update.sequence_number })
            .eq('id', update.id)
        );
        await Promise.all(updatePromises);
        console.log('Sequence numbers updated after deletion.');
      } else {
         console.log('No items left to re-sequence after deletion.');
      }


      console.log(`Item ${itemIdToDelete} deleted successfully.`);

    } catch (err) {
      console.error('Error deleting service item:', err);
      setError(`Failed to delete item: ${err.message}`);
    }
  };

  const handleOpenEditModal = (itemToEdit) => {
    setEditingItem(itemToEdit);
    setIsEditItemModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditItemModalOpen(false);
    setEditingItem(null);
  };

  const handleUpdateItem = async (formPayload) => {
    if (!editingItem || !formPayload) {
        alert("Missing data for item update.");
        return;
    }

    try {
      // The formPayload from EditServiceItemForm is already structured
      // with appropriate nulls for fields not relevant to its type.
      // We just need to ensure we keep the original item's ID and type (if type isn't editable).
      const payloadForSupabase = {
        ...formPayload, // This includes title, duration, details, and type-specific fields
        type: editingItem.type, // Ensure type is not accidentally changed if form doesn't edit it
        // musical_key is already preserved in formPayload by EditServiceItemForm
      };

      const { data, error: updateError } = await supabase
        .from('service_items')
        .update(payloadForSupabase) // Send the payload directly
        .eq('id', editingItem.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setOrderOfService(prevOrder =>
        prevOrder.map(item => (item.id === editingItem.id ? data : item))
      );
      handleCloseEditModal();
      console.log(`Item ${editingItem.id} updated successfully.`);
    } catch (err) {
      console.error('Error updating service item:', err);
      setError(`Failed to update item: ${err.message}`);
      throw err; // Re-throw for form's isSubmitting state
    }
  };

  const handleOpenEditEventModal = () => {
    setIsEditEventModalOpen(true);
  };

  const handleCloseEditEventModal = () => {
    setIsEditEventModalOpen(false);
  };

  const handleUpdateEventInfo = async (updatedEventData) => {
    if (!planId || !updatedEventData) {
      alert("Missing data for event update.");
      return;
    }

    try {
      // Fields that can be updated via this form
      const payloadToUpdate = {
        title: updatedEventData.title,
        date: updatedEventData.date,
        time: updatedEventData.time, // Make sure 'time' column exists in your 'events' table
        theme: updatedEventData.theme,
        notes: updatedEventData.notes,
      };

      const { data, error: updateError } = await supabase
        .from('events')
        .update(payloadToUpdate)
        .eq('id', planId)
        .select() // Select the updated row
        .single(); // Expect one row back

      if (updateError) throw updateError;

      // Update local eventDetails state
      setEventDetails(data); // Assuming 'data' is the full updated event object

      handleCloseEditEventModal(); // Close the modal
      console.log(`Event ${planId} information updated successfully.`);

    } catch (err) {
      console.error('Error updating event information:', err);
      setError(`Failed to update event info: ${err.message}`);
      throw err; // Re-throw so EditEventInfoForm can stop its submitting state
    }
  };

  const handleUpdateMusicalKey = async (itemId, newKey) => {
    try {
      // 1. Update in Supabase
      const { data, error: updateError } = await supabase
        .from('service_items')
        .update({ musical_key: newKey })
        .eq('id', itemId)
        .select() // Important to get the updated item back for consistent state
        .single();

      if (updateError) throw updateError;

      // 2. Update local state
      setOrderOfService(prevOrder =>
        prevOrder.map(item =>
          item.id === itemId ? data : item // Replace item with the updated one from Supabase
        )
      );
      console.log(`Musical key for item ${itemId} updated to ${newKey}.`);
    } catch (err) {
      console.error('Error updating musical key:', err);
      setError(`Failed to update key: ${err.message}`);
      // Optionally, you might want to re-fetch or revert the UI change if the DB update fails.
    }
  };

  const handleDeleteCurrentPlan = async () => {
    if (!eventDetails || !planId) {
      alert("Plan details not loaded yet, cannot delete.");
      return;
    }

    if (window.confirm(`Are you sure you want to delete the plan "${eventDetails.title}"? This action cannot be undone and will delete all associated service items and assignments.`)) {
      try {
        setLoading(true); // Show loading state
        setError(null);

        // With ON DELETE CASCADE, only need to delete from the 'events' table
        const { error: deleteError } = await supabase
          .from('events')
          .delete()
          .eq('id', planId);

        if (deleteError) throw deleteError;

        console.log(`Plan "${eventDetails.title}" (ID: ${planId}) deleted successfully.`);
        alert(`Plan "${eventDetails.title}" has been deleted.`);
        navigate('/'); // Navigate back to the AllPlansPage (or your desired route e.g., '/plans')

      } catch (err) {
        console.error('Error deleting current plan:', err);
        setError(`Failed to delete plan: ${err.message}`);
        alert(`Failed to delete plan: ${err.message}`);
        setLoading(false); // Reset loading state on error
      }
      // No finally setLoading(false) here if navigation occurs on success
    }
  };

  // Conditional rendering for loading and error states
  if (loading) return <p className="page-status-message">Loading plan details...</p>;
  if (error) return <p className="page-status-message error-message">Error: {error}</p>;
  if (!eventDetails && !loading) return <p className="page-status-message">No event data found for ID: {planId}. Please ensure the plan exists and you have access.</p>;

  // Main JSX for the page
  return (
    <div className="plan-page-container">
      <header className="plan-header">
        <div className="plan-header-title-group">
            <h1>{eventDetails?.title || 'Plan Title Not Available'}</h1>
        </div>
        <div className="plan-header-actions">
            <button 
                onClick={handleOpenEditEventModal} 
                className="edit-event-info-btn page-header-action-btn"
                disabled={loading} // Disable if an operation is in progress
            >
                Edit Event Info
            </button>
            <button 
                onClick={handleDeleteCurrentPlan} 
                className="delete-current-plan-btn page-header-action-btn"
                disabled={loading} // Disable if an operation is in progress
            >
                Delete Plan
            </button>
        </div>
      </header>
      <div className="plan-main-content">
        {/* Column 1 (Order of Service) - Now on the left */}
        <div className="plan-left-column">
          <div className="order-of-service-header">
            <h2>Order of Service</h2>
            <button onClick={toggleAddItemForm} className="toggle-add-item-form-btn">
              + Add Item
            </button>
          </div>
          <OrderOfService
            items={orderOfService}
            onOrderChange={handleOrderOfServiceChange}
            onDeleteItem={handleDeleteItem} // <--- ADD THIS PROP
            onEditItem={handleOpenEditModal}
            assignedPeople={assignedPeople}
            onUpdateKey={handleUpdateMusicalKey}
          />
        </div>

        {/* Column 2 (Details, People, Checklist) - Now on the right */}
        <div className="plan-right-column">
          <ServiceDetails details={eventDetails} />
          <AssignedPeople people={assignedPeople} />
          <WeeklyChecklist
            tasks={PREDEFINED_CHECKLIST_TASKS}
            checkedStatuses={checklistStatus}
            onTaskToggle={handleChecklistToggle}
          />
        </div>
      </div>

      {/* Modal for AddItemForm */}
      {isAddItemFormVisible && (
        <div className="modal-overlay" onClick={toggleAddItemForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleAddItemForm}>
              &times;
            </button>
            <AddItemForm
              onAddItem={handleAddItem}
              assignedPeople={assignedPeople}
              // onCancel={handleCloseEditModal}
            />
          </div>
        </div>
      )}
      
      {isEditItemModalOpen && editingItem && (
        <div className="modal-overlay" onClick={handleCloseEditModal}> {/* Use specific close handler */}
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditModal}>
              &times;
            </button>
            <EditServiceItemForm
              itemToEdit={editingItem}
              onUpdateItem={handleUpdateItem}
              onCancel={handleCloseEditModal}
              assignedPeople={assignedPeople}
            />
          </div>
        </div>
      )}
      {/* Modal for Editing Event Information (NEW) */}
      {isEditEventModalOpen && eventDetails && (
        <div className="modal-overlay" onClick={handleCloseEditEventModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditEventModal}>
              &times;
            </button>
            <EditEventInfoForm
              initialData={eventDetails} // Pass current eventDetails
              onUpdateEvent={handleUpdateEventInfo}
              onCancel={handleCloseEditEventModal}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanPage;