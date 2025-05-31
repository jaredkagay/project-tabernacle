// src/components/PlanPage/PlanPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

import ServiceDetails from './ServiceDetails';
import OrderOfService from './OrderOfService'; // Assumes SortableServiceItem is used within
import AssignedPeople from './AssignedPeople';
import AddItemForm from './AddItemForm';
import EditServiceItemForm from './EditServiceItemForm';
import EditEventInfoForm from './EditEventInfoForm';
import WeeklyChecklist from './WeeklyChecklist';
import InviteMemberForm from './InviteMemberForm';
import EditAssignmentForm from './EditAssignmentForm';

import './PlanPage.css';

// Helper to parse duration string (e.g., "5 min", "10m") to minutes
// This is a simple parser; you can make it more robust for "1h 30m", etc.
const parseDurationToMinutes = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const cleanedStr = durationStr.toLowerCase().replace('minutes', '').replace('minute', '').replace('mins', '').replace('min', '').replace('m', '').trim();
  const minutes = parseInt(cleanedStr, 10);
  return isNaN(minutes) ? 0 : minutes;
};

// Helper to format total minutes into HH:MM string
const formatMinutesToHHMM = (totalMinutes) => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const PREDEFINED_CHECKLIST_TASKS = [
  "Designate Bible verse reader", "Confirm guest speaker (if any)", "Organize worship team members and song list",
  "Prepare sermon/message notes & slides", "Coordinate with sound/AV team", "Plan welcome/greeting team assignments",
  "Prepare announcements and collect prayer requests", "Ensure children's ministry is staffed and prepared",
  "Check supplies (communion elements, bulletins, etc.)", "Review previous week's feedback/notes"
];

const PlanPage = () => {
  const { planId } = useParams();
  const { user, profile, loading: authIsLoading } = useAuth();
  const navigate = useNavigate();

  const [planPageLoading, setPlanPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [orderOfService, setOrderOfService] = useState([]);
  const [assignedPeople, setAssignedPeople] = useState([]);
  const [checklistStatus, setChecklistStatus] = useState({});
  const [organizationMembers, setOrganizationMembers] = useState([]);

  const [isAddItemFormVisible, setIsAddItemFormVisible] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditAssignmentModalOpen, setIsEditAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  // --- Calculate items with start times using useMemo ---
  const orderOfServiceWithTimes = React.useMemo(() => {
    let runningTimeInMinutes = 0;
    return orderOfService.map(item => {
      const startTimeFormatted = formatMinutesToHHMM(runningTimeInMinutes);
      let effectiveDurationMinutes = 0;
      if (item.type !== 'Divider' && item.duration) {
        effectiveDurationMinutes = parseDurationToMinutes(item.duration);
      }
      
      const itemWithTime = {
        ...item,
        calculatedStartTimeFormatted: startTimeFormatted, // e.g., "00:05"
        _calculatedStartTimeMinutes: runningTimeInMinutes, // For internal use if needed
        _effectiveDurationMinutes: effectiveDurationMinutes // For internal use if needed
      };
      
      runningTimeInMinutes += effectiveDurationMinutes;
      return itemWithTime;
    });
  }, [orderOfService]); // Re-calculate when orderOfService changes

  const initializeChecklistStatus = (dbStatus) => {
    const initialStatus = {};
    PREDEFINED_CHECKLIST_TASKS.forEach((task, index) => {
      initialStatus[index] = dbStatus && dbStatus[index] !== undefined ? dbStatus[index] : false;
    });
    return initialStatus;
  };

  const fetchPlanDataAndOrgMembers = useCallback(async () => {
    if (!planId || !user || !profile?.organization_id) {
      setError(prevError => prevError || "Required information (plan, user, or organization) is missing.");
      setPlanPageLoading(false); return;
    }
    setPlanPageLoading(true); setError(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error(sessionError?.message || "Session not available.");

      const { data: eventData, error: eventError } = await supabase.from('events').select('*, checklist_status, organization_id').eq('id', planId).eq('organization_id', profile.organization_id).single();
      if (eventError) throw new Error(`Event details error: ${eventError.message}`);
      if (!eventData) throw new Error("Event not found or access denied.");
      setEventDetails(eventData);
      setChecklistStatus(initializeChecklistStatus(eventData.checklist_status));

      const { data: orderData, error: orderError } = await supabase.from('service_items').select('*').eq('event_id', planId).order('sequence_number', { ascending: true });
      if (orderError) throw new Error(`Service items error: ${orderError.message}`);
      setOrderOfService(orderData || []);
      
      const { data: currentAssignments, error: assignmentsError } = await supabase.from('event_assignments').select(`id, status, instruments_assigned, notes_for_member, user_id, profile:profiles!event_assignments_user_id_fkey (id, first_name, last_name, instruments, role)`).eq('event_id', planId);
      if (assignmentsError) throw new Error(`Assignments error: ${assignmentsError.message}`);
      const formattedAssignments = (currentAssignments || []).map(a => ({
          id: a.user_id, assignment_id: a.id,
          name: `${a.profile?.first_name || 'User'} ${a.profile?.last_name || ''}`.trim(),
          firstName: `${a.profile?.first_name || 'User'}`.trim(),
          role: a.profile?.role,
          instruments_played_by_profile: a.profile?.instruments || [],
          instruments_assigned_for_event: a.instruments_assigned || [],
          status: a.status, notes: a.notes_for_member
      }));
      setAssignedPeople(formattedAssignments);

      if (profile.role === 'ORGANIZER') {
        const { data: members, error: membersError } = await supabase.from('profiles').select('id, first_name, last_name, instruments, role').eq('organization_id', profile.organization_id).eq('role', 'MUSICIAN');
        if (membersError) throw new Error(`Org members error: ${membersError.message}`);
        setOrganizationMembers(members || []);
      }
    } catch (err) {
      console.error("[PlanPage] Error in fetchPlanDataAndOrgMembers:", err.message);
      setError(err.message);
      setEventDetails(null); setOrderOfService([]); setAssignedPeople([]); setChecklistStatus({}); setOrganizationMembers([]);
    } finally {
      setPlanPageLoading(false);
    }
  }, [planId, user, profile?.organization_id]);

  useEffect(() => {
    if (!authIsLoading && user && planId && profile) {
        if (profile.organization_id) fetchPlanDataAndOrgMembers();
        else { setError("Your profile isn't linked to an organization."); setPlanPageLoading(false); }
    } else if (!authIsLoading && !user) { setError("User not authenticated."); setPlanPageLoading(false); }
    else if (!authIsLoading && user && !profile) { setError("User profile couldn't be loaded."); setPlanPageLoading(false); }
    else if (authIsLoading) setPlanPageLoading(true);
  }, [authIsLoading, user, planId, profile, fetchPlanDataAndOrgMembers]);

  const toggleAddItemForm = () => setIsAddItemFormVisible(prev => !prev);
  const toggleInviteModal = () => setIsInviteModalOpen(prev => !prev);
  const handleOpenEditModal = (itemToEdit) => { setEditingItem(itemToEdit); setIsEditItemModalOpen(true); };
  const handleCloseEditModal = () => { setIsEditItemModalOpen(false); setEditingItem(null); };
  const handleOpenEditEventModal = () => setIsEditEventModalOpen(true);
  const handleCloseEditEventModal = () => setIsEditEventModalOpen(false);
  const handleOpenEditAssignmentModal = (assignment) => { setEditingAssignment(assignment); setIsEditAssignmentModalOpen(true); };
  const handleCloseEditAssignmentModal = () => { setIsEditAssignmentModalOpen(false); setEditingAssignment(null); };

  const handleChecklistToggle = async (taskIndex) => {
    if (!eventDetails || !planId) return; // Ensure eventDetails is loaded
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
      if (updateError) {
        throw updateError;
      }
      // console.log('Checklist status updated in Supabase.');
    } catch (err) {
      console.error('Failed to update checklist status in Supabase:', err);
      setError('Failed to save checklist update: ' + err.message);
      // Revert optimistic update by re-fetching or setting state back
      setChecklistStatus(prevStatus => ({ ...prevStatus, [taskIndex]: !prevStatus[taskIndex] }));
      // Or call fetchPlanDataAndOrgMembers(); if you want to be absolutely sure
    }
  };

  const handleAddItem = async (newItemFromForm) => {
    if (!planId) {
      alert("Event ID is missing. Cannot add item.");
      return;
    }
    try {
      const currentMaxSequence = orderOfService.reduce((max, item) => Math.max(max, item.sequence_number !== null ? item.sequence_number : -1), -1);
      
      const itemToInsert = {
        ...newItemFromForm, // This includes type, title, and type-specific fields like assigned_singer_ids, bible_book, etc.
        event_id: planId,
        sequence_number: currentMaxSequence + 1,
      };

      // Ensure fields not relevant to the type are nulled or set to default
      if (itemToInsert.type !== 'Song') itemToInsert.assigned_singer_ids = itemToInsert.assigned_singer_ids || []; // Default to empty array if not song
      if (itemToInsert.type !== 'Bible Verse') {
        itemToInsert.bible_book = null;
        itemToInsert.bible_chapter = null;
        itemToInsert.bible_verse_range = null;
      }
      if (itemToInsert.type === 'Divider' || itemToInsert.type === 'Bible Verse') {
        itemToInsert.duration = null;
        itemToInsert.details = null;
      }
      // Ensure 'id' is not sent if it's an empty string from form, Supabase will generate it
      if (itemToInsert.id === '' || itemToInsert.id === undefined) {
        delete itemToInsert.id;
      }

      const { data: newlyAddedItem, error: insertError } = await supabase
        .from('service_items')
        .insert([itemToInsert])
        .select()
        .single();

      if (insertError) throw insertError;

      if (newlyAddedItem) {
        setOrderOfService(prevItems => 
            [...prevItems, newlyAddedItem].sort((a,b) => (a.sequence_number || 0) - (b.sequence_number || 0))
        );
        setIsAddItemFormVisible(false); // Close modal
      } else {
        // Should not happen if insert was successful and .select().single() was used
        console.warn("Newly added item data was not returned as expected. Re-fetching list.");
        fetchPlanDataAndOrgMembers(); // Re-fetch to be safe
        setIsAddItemFormVisible(false);
      }
    } catch (err) {
      console.error("Error adding service item to Supabase:", err);
      alert(`Failed to add item: ${err.message}`);
    }
  };

  const handleOrderOfServiceChange = async (newOrderedItemsFromDrag) => {
    const resequencedItemsForState = newOrderedItemsFromDrag.map((item, index) => ({
      ...item,
      sequence_number: index,
    }));
    setOrderOfService(resequencedItemsForState); // Optimistic UI update

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
          throw new Error(`Failed to update item order: ${result.error.details || result.error.message}`);
        }
      });
      // console.log('Order of service updated successfully in Supabase.');
    } catch (err) {
      console.error('Failed to update order of service in Supabase:', err);
      setError(`Failed to save new order: ${err.message}. The list might be out of sync.`);
      fetchPlanDataAndOrgMembers(); // Revert to DB state on error
    }
  };

  const handleDeleteItem = async (itemIdToDelete) => {
    try {
      const { error: deleteError } = await supabase
        .from('service_items')
        .delete()
        .eq('id', itemIdToDelete);
      if (deleteError) throw deleteError;

      const updatedOrderOfService = orderOfService.filter(item => item.id !== itemIdToDelete);
      const resequencedItems = updatedOrderOfService.map((item, index) => ({
        ...item,
        sequence_number: index
      }));
      setOrderOfService(resequencedItems); // Update UI immediately

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
        // console.log('Sequence numbers updated after deletion.');
      }
      // console.log(`Item ${itemIdToDelete} deleted successfully.`);
    } catch (err) {
      console.error('Error deleting service item:', err);
      setError(`Failed to delete item: ${err.message}`);
    }
  };

  const handleUpdateItem = async (formPayload) => { // formPayload from EditServiceItemForm
    if (!editingItem || !formPayload) {
      alert("Missing data for item update.");
      throw new Error("Missing data for item update."); // Ensure form can catch this
    }
    try {
      const payloadForSupabase = {
        title: formPayload.title,
        duration: formPayload.duration,
        details: formPayload.details,
        artist: formPayload.artist,
        chord_chart_url: formPayload.chord_chart_url,
        youtube_url: formPayload.youtube_url,
        assigned_singer_ids: formPayload.assigned_singer_ids,
        bible_book: formPayload.bible_book,
        bible_chapter: formPayload.bible_chapter,
        bible_verse_range: formPayload.bible_verse_range,
        // type: editingItem.type, // Type is not changed in edit form
        musical_key: formPayload.musical_key !== undefined ? formPayload.musical_key : editingItem.musical_key,
      };

      const { data, error: updateError } = await supabase
        .from('service_items')
        .update(payloadForSupabase)
        .eq('id', editingItem.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setOrderOfService(prevOrder =>
        prevOrder.map(item => (item.id === editingItem.id ? data : item))
      );
      handleCloseEditModal(); // Close modal on success
      // console.log(`Item ${editingItem.id} updated successfully.`);
    } catch (err) {
      console.error('Error updating service item:', err);
      alert(`Failed to update item: ${err.message}`); // Alert user
      throw err; // Re-throw so EditServiceItemForm's finally block runs
    }
  };

  const handleUpdateEventInfo = async (updatedEventData) => {
    if (!planId || !updatedEventData) {
      alert("Missing data for event update.");
      throw new Error("Missing data for event update.");
    }
    try {
      const payloadToUpdate = {
        title: updatedEventData.title,
        date: updatedEventData.date,
        time: updatedEventData.time,
        theme: updatedEventData.theme,
        notes: updatedEventData.notes,
      };
      const { data, error: updateError } = await supabase
        .from('events')
        .update(payloadToUpdate)
        .eq('id', planId)
        .select()
        .single();
      if (updateError) throw updateError;
      setEventDetails(data);
      handleCloseEditEventModal();
      // console.log(`Event ${planId} information updated successfully.`);
    } catch (err) {
      console.error('Error updating event information:', err);
      alert(`Failed to update event info: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateMusicalKey = async (itemId, newKey) => {
    try {
      const { data, error: updateError } = await supabase
        .from('service_items')
        .update({ musical_key: newKey })
        .eq('id', itemId)
        .select()
        .single();
      if (updateError) throw updateError;
      setOrderOfService(prevOrder =>
        prevOrder.map(item => (item.id === itemId ? data : item))
      );
      // console.log(`Musical key for item ${itemId} updated to ${newKey}.`);
    } catch (err) {
      console.error('Error updating musical key:', err);
      setError(`Failed to update key: ${err.message}`);
    }
  };

  const handleDeleteCurrentPlan = async () => {
    if (!eventDetails || !planId) {
      alert("Plan details not loaded yet, cannot delete.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete the plan "${eventDetails.title}"? This action cannot be undone.`)) {
      try {
        setPlanPageLoading(true); setError(null);
        const { error: deleteError } = await supabase.from('events').delete().eq('id', planId);
        if (deleteError) throw deleteError;
        alert(`Plan "${eventDetails.title}" has been deleted.`);
        navigate('/'); // Navigate back to AllPlansPage
      } catch (err) {
        console.error('Error deleting current plan:', err);
        setError(`Failed to delete plan: ${err.message}`);
        alert(`Failed to delete plan: ${err.message}`);
        setPlanPageLoading(false);
      }
    }
  };

  const unassignSingerFromSongs = async (userIdToUnassign, currentPlanId) => {
    if (!userIdToUnassign || !currentPlanId) return;
    try {
      const { data: songsAssigned, error: fetchError } = await supabase
        .from('service_items')
        .select('id, assigned_singer_ids')
        .eq('event_id', currentPlanId)
        .eq('type', 'Song')
        .neq('assigned_singer_ids', null);

      if (fetchError) { console.error("Error fetching songs for unassignment:", fetchError); return; }

      const updates = [];
      let changedInLocalState = false;
      (songsAssigned || []).forEach(song => {
        if (song.assigned_singer_ids && song.assigned_singer_ids.includes(userIdToUnassign)) {
          const newSingerIds = song.assigned_singer_ids.filter(id => id !== userIdToUnassign);
          updates.push(
            supabase.from('service_items').update({ assigned_singer_ids: newSingerIds.length > 0 ? newSingerIds : null }).eq('id', song.id)
          );
          changedInLocalState = true;
        }
      });
      if (updates.length > 0) {
        await Promise.all(updates.map(p => p.catch(e => console.error("Sub-update failed to unassign singer", e))));
      }
      if (changedInLocalState) {
         // The main data re-fetch in handleDecline/handleRescind will refresh orderOfService
      }
    } catch (err) { console.error("Exception in unassignSingerFromSongs:", err); }
  };

  const handleAcceptInvitation = async (assignmentId) => {
    if (!assignmentId) return;
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'ACCEPTED', responded_at: new Date().toISOString() }).eq('id', assignmentId);
      if (error) throw error;
      alert("Invitation accepted!");
      fetchPlanDataAndOrgMembers(); // Refresh to show status change
    } catch (err) { console.error("Error accepting invitation:", err); alert(`Failed to accept: ${err.message}`); }
  };

  const handleDeclineInvitation = async (assignmentId) => {
    if (!assignmentId) return;
    const assignment = assignedPeople.find(p => p.assignment_id === assignmentId);
    const decliningUserId = assignment?.id; // This is the user_id
    if (!window.confirm("Are you sure you want to decline this assignment?")) return;
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'DECLINED', responded_at: new Date().toISOString() }).eq('id', assignmentId);
      if (error) throw error;
      if (decliningUserId && planId) await unassignSingerFromSongs(decliningUserId, planId);
      alert("Invitation declined.");
      fetchPlanDataAndOrgMembers(); // Refresh all data to be sure
      navigate('/plans'); // Redirect musician
    } catch (err) { console.error("Error declining invitation:", err); alert(`Failed to decline: ${err.message}`); }
  };

  const handleRescindInvitation = async (assignmentId, musicianName) => {
    if (!assignmentId) return;
    const assignment = assignedPeople.find(p => p.assignment_id === assignmentId);
    const rescindedUserId = assignment?.id;
    if (!window.confirm(`Are you sure you want to remove ${musicianName} from this plan?`)) return;
    try {
      setPlanPageLoading(true);
      const { error } = await supabase.from('event_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      if (rescindedUserId && planId) await unassignSingerFromSongs(rescindedUserId, planId);
      alert(`${musicianName} has been removed from the plan.`);
      fetchPlanDataAndOrgMembers();
    } catch (err) { console.error("Error rescinding invitation:", err); alert(`Failed to remove: ${err.message}`);}
    finally { setPlanPageLoading(false); }
  };
  
  const handleSendInvitation = async (invitationData) => {
    // console.log("[PlanPage] handleSendInvitation received:", invitationData);
    if (!eventDetails?.id || !invitationData.musician_user_id || !invitationData.instruments?.length) {
      console.error("[PlanPage] handleSendInvitation: Validation failed - eventDetails, musician_user_id or instruments missing.");
      alert("Musician and instruments are required, and event details must be loaded.");
      throw new Error("Musician, instruments, or event details missing for invitation.");
    }
    try {
      // console.log("[PlanPage] handleSendInvitation: Attempting Supabase insert...");
      const { data, error } = await supabase
        .from('event_assignments')
        .insert([{
          event_id: eventDetails.id,
          user_id: invitationData.musician_user_id,
          instruments_assigned: invitationData.instruments,
          notes_for_member: invitationData.notes,
          status: 'PENDING',
        }])
        .select();

      if (error) {
        console.error("[PlanPage] handleSendInvitation: Supabase insert error:", error);
        throw error;
      }
      // console.log('[PlanPage] handleSendInvitation: Invitation sent successfully. Response data:', data);
      fetchPlanDataAndOrgMembers();
      toggleInviteModal();
      alert("Invitation sent successfully!");

    } catch (err) {
      console.error("[PlanPage] handleSendInvitation: CATCH block. Error sending invitation:", err.message, err);
      alert(`Failed to send invitation: ${err.message}`);
      throw err; // Re-throw so InviteMemberForm's finally block runs, and it knows submission failed
    }
  };
  
  const handleUpdateAssignment = async (assignmentId, updatedData) => {
    if (!assignmentId || !updatedData) {
      alert("Missing data for assignment update.");
      throw new Error("Missing data for assignment update.");
    }
    try {
      setPlanPageLoading(true);
      const { error: updateError } = await supabase
        .from('event_assignments')
        .update({
          instruments_assigned: updatedData.instruments_assigned,
          notes_for_member: updatedData.notes_for_member,
        })
        .eq('id', assignmentId);
      if (updateError) throw updateError;
      alert('Assignment updated successfully.');
      fetchPlanDataAndOrgMembers();
      handleCloseEditAssignmentModal();
    } catch (err) {
      console.error("Error updating assignment:", err.message);
      alert(`Failed to update assignment: ${err.message}`);
      throw err;
    } finally {
      setPlanPageLoading(false);
    }
  };

  // --- Prepare derived data for rendering ---
  const assignedUserIdsForNewInvites = assignedPeople.map(p => p.id);
  const availableMusiciansToInviteGenerically = organizationMembers.filter(
    member => !assignedUserIdsForNewInvites.includes(member.id) && member.role === 'MUSICIAN'
  );
  const potentialSingersForSongs = assignedPeople.filter(person =>
    (person.status === 'ACCEPTED' || person.status === 'PENDING') &&
    person.instruments_assigned_for_event?.some(instrument => instrument.toLowerCase().includes('vocals'))
  );

  // --- RENDER ---
  if (authIsLoading || (planPageLoading && !eventDetails && !error)) {
    return <p className="page-status-message">Loading plan...</p>;
  }
  if (error) {
    return <p className="page-status-message error-message">Error: {error}</p>;
  }
  if (!eventDetails) {
    return <p className="page-status-message">Plan not found or access denied for ID: {planId}.</p>;
  }

  return (
    <div className="plan-page-container">
      <header className="plan-header">
        <div className="plan-header-title-group">
          <h1>{eventDetails.title}</h1>
        </div>
        <div className="plan-header-actions">
          {profile?.role === 'ORGANIZER' && (
            <>
              <button onClick={handleOpenEditEventModal} className="edit-event-info-btn page-header-action-btn" disabled={planPageLoading}>
                Edit Event Info
              </button>
              <button onClick={handleDeleteCurrentPlan} className="delete-current-plan-btn page-header-action-btn" disabled={planPageLoading}>
                Delete Plan
              </button>
            </>
          )}
        </div>
      </header>
      
      {eventDetails && (
        <div className="plan-main-content">
          <div className="plan-left-column">
            <div className="order-of-service-header">
              <h2>Order of Service</h2>
              {profile?.role === 'ORGANIZER' && (
                <button onClick={toggleAddItemForm} className="toggle-add-item-form-btn">
                  + Add Item
                </button>
              )}
            </div>
            <OrderOfService
              items={orderOfServiceWithTimes}
              onOrderChange={handleOrderOfServiceChange}
              onDeleteItem={profile?.role === 'ORGANIZER' ? handleDeleteItem : undefined}
              onEditItem={profile?.role === 'ORGANIZER' ? handleOpenEditModal : undefined} // For Service Items
              assignedPeople={assignedPeople} 
              onUpdateKey={handleUpdateMusicalKey}
              userRole={profile?.role} // <--- PASS USER ROLE HERE
            />
          </div>

          <div className="plan-right-column">
            <ServiceDetails details={eventDetails} />
            <AssignedPeople 
              people={assignedPeople}
              onAccept={handleAcceptInvitation}
              onDecline={handleDeclineInvitation}
              onRescind={profile?.role === 'ORGANIZER' ? handleRescindInvitation : undefined}
              onOpenEditAssignment={profile?.role === 'ORGANIZER' ? handleOpenEditAssignmentModal : undefined}
            />
            {profile?.role === 'ORGANIZER' && (
              <button onClick={toggleInviteModal} className="invite-member-btn page-action-btn " style={{marginTop: '15px', width: '100%'}}>
                + Invite/Assign Musician
              </button>
            )}
            <WeeklyChecklist
              tasks={PREDEFINED_CHECKLIST_TASKS}
              checkedStatuses={checklistStatus}
              onTaskToggle={profile?.role === 'ORGANIZER' ? handleChecklistToggle : () => {}}
            />
          </div>
        </div>
      )}

      {/* ---- Modals ---- */}
      {isAddItemFormVisible && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleAddItemForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleAddItemForm}>&times;</button>
            <AddItemForm 
              onAddItem={handleAddItem} 
              assignedPeopleForSingerRole={potentialSingersForSongs} 
            />
          </div>
        </div>
      )}

      {isEditItemModalOpen && editingItem && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditModal}>&times;</button>
            <EditServiceItemForm
              itemToEdit={editingItem}
              onUpdateItem={handleUpdateItem}
              onCancel={handleCloseEditModal}
              assignedPeopleForSingerRole={potentialSingersForSongs}
            />
          </div>
        </div>
      )}

      {isEditEventModalOpen && eventDetails && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={handleCloseEditEventModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditEventModal}>&times;</button>
            <EditEventInfoForm
              initialData={eventDetails}
              onUpdateEvent={handleUpdateEventInfo}
              onCancel={handleCloseEditEventModal}
            />
          </div>
        </div>
      )}

      {isInviteModalOpen && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleInviteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleInviteModal}>&times;</button>
            <InviteMemberForm
              organizationMusicians={availableMusiciansToInviteGenerically}
              onSendInvitation={handleSendInvitation}
              onCancel={toggleInviteModal}
            />
          </div>
        </div>
      )}
      
      {isEditAssignmentModalOpen && editingAssignment && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={handleCloseEditAssignmentModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditAssignmentModal}>&times;</button>
            <EditAssignmentForm
              assignmentToEdit={editingAssignment}
              onUpdateAssignment={handleUpdateAssignment}
              onCancel={handleCloseEditAssignmentModal}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanPage;