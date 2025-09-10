// src/components/PlanPage/PlanPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';

import ServiceDetails from './ServiceDetails';
import OrderOfService from './OrderOfService';
import AssignedPeople from './AssignedPeople';
import AddItemForm from './AddItemForm';
import EditServiceItemForm from './EditServiceItemForm';
import EditEventInfoForm from './EditEventInfoForm';
import WeeklyChecklist from './WeeklyChecklist';
import InviteMemberForm from './InviteMemberForm';
import EditAssignmentForm from './EditAssignmentForm';

import './PlanPage.css';

const parseDurationToMinutes = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const cleanedStr = durationStr.toLowerCase().replace('minutes', '').replace('minute', '').replace('mins', '').replace('min', '').replace('m', '').trim();
  const minutes = parseInt(cleanedStr, 10);
  return isNaN(minutes) ? 0 : minutes;
};

const formatMinutesToHHMM = (totalMinutes) => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const PlanPage = () => {
  const { planId } = useParams();
  const { user, profile, loading: authIsLoading } = useAuth();
  const navigate = useNavigate();

  const [planPageLoading, setPlanPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventDetails, setEventDetails] = useState(null);
  const [orderOfService, setOrderOfService] = useState([]);
  const [assignedPeople, setAssignedPeople] = useState([]);
  const [currentChecklistTasks, setCurrentChecklistTasks] = useState([]);
  const [checklistStatus, setChecklistStatus] = useState({});
  const [organizationMembers, setOrganizationMembers] = useState([]);

  const [isEditMode, setIsEditMode] = useState(false);

  const [isAddItemFormVisible, setIsAddItemFormVisible] = useState(false);
  const [isEditItemModalOpen, setIsEditItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isEditEventModalOpen, setIsEditEventModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isEditAssignmentModalOpen, setIsEditAssignmentModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(null);

  const orderOfServiceRole = profile?.role === 'ORGANIZER' && isEditMode ? 'ORGANIZER' : 'MUSICIAN';

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
        calculatedStartTimeFormatted: startTimeFormatted,
        _calculatedStartTimeMinutes: runningTimeInMinutes,
        _effectiveDurationMinutes: effectiveDurationMinutes
      };
      
      runningTimeInMinutes += effectiveDurationMinutes;
      return itemWithTime;
    });
  }, [orderOfService]);

  const initializeChecklistStatus = (tasksFromOrg, eventSpecificStatuses) => {
    const initialStatus = {};
    (tasksFromOrg || []).forEach(taskString => {
      initialStatus[taskString] = eventSpecificStatuses && eventSpecificStatuses[taskString] !== undefined 
        ? eventSpecificStatuses[taskString] 
        : false;
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
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select(`*, organization:organizations (id, name, default_checklist)`)
        .eq('id', planId)
        .eq('organization_id', profile.organization_id)
        .single();

      if (eventError) throw new Error(`Event details error: ${eventError.message}`);
      if (!eventData) throw new Error("Event not found or access denied.");
      
      setEventDetails(eventData);
      
      const orgDefaultTasks = eventData.organization?.default_checklist || [];
      setCurrentChecklistTasks(orgDefaultTasks);
      setChecklistStatus(initializeChecklistStatus(orgDefaultTasks, eventData.checklist_status));

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
  }, [planId, user, profile]);

  useEffect(() => {
    if (!authIsLoading && user && profile) {
        fetchPlanDataAndOrgMembers();
    } else if (!authIsLoading) {
        setPlanPageLoading(false);
    }
  }, [planId, user, profile, authIsLoading, fetchPlanDataAndOrgMembers]);


  const toggleAddItemForm = () => setIsAddItemFormVisible(prev => !prev);
  const toggleInviteModal = () => setIsInviteModalOpen(prev => !prev);
  const handleOpenEditModal = (itemToEdit) => { setEditingItem(itemToEdit); setIsEditItemModalOpen(true); };
  const handleCloseEditModal = () => { setIsEditItemModalOpen(false); setEditingItem(null); };
  const handleOpenEditEventModal = () => setIsEditEventModalOpen(true);
  const handleCloseEditEventModal = () => setIsEditEventModalOpen(false);
  const handleOpenEditAssignmentModal = (assignment) => { setEditingAssignment(assignment); setIsEditAssignmentModalOpen(true); };
  const handleCloseEditAssignmentModal = () => { setIsEditAssignmentModalOpen(false); setEditingAssignment(null); };

  const handleChecklistToggle = async (taskString) => {
    if (!eventDetails || !planId) return;
    const newStatus = { ...checklistStatus, [taskString]: !checklistStatus[taskString] };
    setChecklistStatus(newStatus);
    try {
      const { error: updateError } = await supabase.from('events').update({ checklist_status: newStatus }).eq('id', planId);
      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to update checklist status:', err);
      setError('Failed to save checklist update: ' + err.message);
      setChecklistStatus(prevStatus => ({ ...prevStatus, [taskString]: !prevStatus[taskString] }));
    }
  };

  const handleAddItem = async (newItemFromForm) => {
    try {
      const currentMaxSequence = orderOfService.reduce((max, item) => Math.max(max, item.sequence_number !== null ? item.sequence_number : -1), -1);
      const itemToInsert = { ...newItemFromForm, event_id: planId, sequence_number: currentMaxSequence + 1, };
      const { data: newlyAddedItem, error: insertError } = await supabase.from('service_items').insert([itemToInsert]).select().single();
      if (insertError) throw insertError;
      if (newlyAddedItem) {
        setOrderOfService(prevItems => [...prevItems, newlyAddedItem].sort((a,b) => (a.sequence_number || 0) - (b.sequence_number || 0)));
        setIsAddItemFormVisible(false);
      } else {
        fetchPlanDataAndOrgMembers();
        setIsAddItemFormVisible(false);
      }
    } catch (err) {
      alert(`Failed to add item: ${err.message}`);
    }
  };

  const handleOrderOfServiceChange = async (newOrderedItemsFromDrag) => {
    const resequencedItemsForState = newOrderedItemsFromDrag.map((item, index) => ({...item, sequence_number: index, }));
    setOrderOfService(resequencedItemsForState);

    const updatesForSupabase = resequencedItemsForState.map(item => ({ id: item.id, sequence_number: item.sequence_number, }));
    try {
      const updatePromises = updatesForSupabase.map(update => supabase.from('service_items').update({ sequence_number: update.sequence_number }).eq('id', update.id));
      const results = await Promise.all(updatePromises);
      results.forEach(result => { if (result.error) throw new Error(`Failed to update item order: ${result.error.details || result.error.message}`); });
    } catch (err) {
      setError(`Failed to save new order: ${err.message}.`);
      fetchPlanDataAndOrgMembers();
    }
  };

  const handleDeleteItem = async (itemIdToDelete) => {
    try {
      const { error: deleteError } = await supabase.from('service_items').delete().eq('id', itemIdToDelete);
      if (deleteError) throw deleteError;
      const updatedOrderOfService = orderOfService.filter(item => item.id !== itemIdToDelete);
      const resequencedItems = updatedOrderOfService.map((item, index) => ({...item, sequence_number: index }));
      setOrderOfService(resequencedItems);
      if (resequencedItems.length > 0) {
        const updates = resequencedItems.map(item => ({ id: item.id, sequence_number: item.sequence_number }));
        const updatePromises = updates.map(update => supabase.from('service_items').update({ sequence_number: update.sequence_number }).eq('id', update.id));
        await Promise.all(updatePromises);
      }
    } catch (err) {
      setError(`Failed to delete item: ${err.message}`);
    }
  };

  const handleUpdateItem = async (formPayload) => {
    if (!editingItem) throw new Error("Missing item data for update.");
    try {
      const { data, error: updateError } = await supabase.from('service_items').update(formPayload).eq('id', editingItem.id).select().single();
      if (updateError) throw updateError;
      setOrderOfService(prevOrder => prevOrder.map(item => (item.id === editingItem.id ? data : item)));
      handleCloseEditModal();
    } catch (err) {
      alert(`Failed to update item: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateEventInfo = async (updatedEventData) => {
    if (!planId) throw new Error("Missing event ID for update.");
    try {
      const { data, error: updateError } = await supabase.from('events').update(updatedEventData).eq('id', planId).select().single();
      if (updateError) throw updateError;
      setEventDetails(data);
      handleCloseEditEventModal();
    } catch (err) {
      alert(`Failed to update event info: ${err.message}`);
      throw err;
    }
  };

  const handleUpdateMusicalKey = async (itemId, newKey) => {
    try {
      const { data, error: updateError } = await supabase.from('service_items').update({ musical_key: newKey }).eq('id', itemId).select().single();
      if (updateError) throw updateError;
      setOrderOfService(prevOrder => prevOrder.map(item => (item.id === itemId ? data : item)));
    } catch (err) {
      setError(`Failed to update key: ${err.message}`);
    }
  };

  const handleDeleteCurrentPlan = async () => {
    if (!eventDetails) return;
    if (window.confirm(`Are you sure you want to delete the plan "${eventDetails.title}"? This action cannot be undone.`)) {
      try {
        setPlanPageLoading(true); setError(null);
        const { error: deleteError } = await supabase.from('events').delete().eq('id', planId);
        if (deleteError) throw deleteError;
        alert(`Plan "${eventDetails.title}" has been deleted.`);
        navigate('/plans');
      } catch (err) {
        setError(`Failed to delete plan: ${err.message}`);
        setPlanPageLoading(false);
      }
    }
  };

  const unassignSingerFromSongs = async (userIdToUnassign, currentPlanId) => {
    if (!userIdToUnassign || !currentPlanId) return;
    try {
      const { data: songsAssigned, error: fetchError } = await supabase.from('service_items').select('id, assigned_singer_ids').eq('event_id', currentPlanId).eq('type', 'Song').neq('assigned_singer_ids', null);
      if (fetchError) { console.error("Error fetching songs for unassignment:", fetchError); return; }
      const updates = [];
      (songsAssigned || []).forEach(song => {
        if (song.assigned_singer_ids && song.assigned_singer_ids.includes(userIdToUnassign)) {
          const newSingerIds = song.assigned_singer_ids.filter(id => id !== userIdToUnassign);
          updates.push(supabase.from('service_items').update({ assigned_singer_ids: newSingerIds.length > 0 ? newSingerIds : null }).eq('id', song.id));
        }
      });
      if (updates.length > 0) await Promise.all(updates);
    } catch (err) { console.error("Exception in unassignSingerFromSongs:", err); }
  };

  const handleAcceptInvitation = async (assignmentId) => {
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'ACCEPTED', responded_at: new Date().toISOString() }).eq('id', assignmentId);
      if (error) throw error;
      alert("Invitation accepted!");
      fetchPlanDataAndOrgMembers();
    } catch (err) { alert(`Failed to accept: ${err.message}`); }
  };

  const handleDeclineInvitation = async (assignmentId) => {
    const assignment = assignedPeople.find(p => p.assignment_id === assignmentId);
    if (!window.confirm("Are you sure you want to decline this assignment?")) return;
    try {
      const { error } = await supabase.from('event_assignments').update({ status: 'DECLINED', responded_at: new Date().toISOString() }).eq('id', assignmentId);
      if (error) throw error;
      if (assignment?.id && planId) await unassignSingerFromSongs(assignment.id, planId);
      alert("Invitation declined.");
      fetchPlanDataAndOrgMembers();
      navigate('/plans');
    } catch (err) { alert(`Failed to decline: ${err.message}`); }
  };

  const handleRescindInvitation = async (assignmentId, musicianName) => {
    const assignment = assignedPeople.find(p => p.assignment_id === assignmentId);
    if (!window.confirm(`Are you sure you want to remove ${musicianName} from this plan?`)) return;
    try {
      setPlanPageLoading(true);
      const { error } = await supabase.from('event_assignments').delete().eq('id', assignmentId);
      if (error) throw error;
      if (assignment?.id && planId) await unassignSingerFromSongs(assignment.id, planId);
      alert(`${musicianName} has been removed from the plan.`);
      fetchPlanDataAndOrgMembers();
    } catch (err) { alert(`Failed to remove: ${err.message}`);}
    finally { setPlanPageLoading(false); }
  };
  
  const handleSendInvitation = async (invitationData) => {
    if (!eventDetails?.id) throw new Error("Event details missing.");
    try {
      const { error } = await supabase.from('event_assignments').insert([{
        event_id: eventDetails.id, 
        user_id: invitationData.musician_user_id,
        instruments_assigned: invitationData.instruments,
        notes_for_member: invitationData.notes,
        status: 'PENDING'
      }]);
      if (error) throw error;
      fetchPlanDataAndOrgMembers();
      toggleInviteModal();
      alert("Invitation sent successfully!");
    } catch (err) {
      alert(`Failed to send invitation: ${err.message}`);
      throw err;
    }
  };
  
  const handleUpdateAssignment = async (assignmentId, updatedData) => {
    try {
      setPlanPageLoading(true);
      const { error: updateError } = await supabase.from('event_assignments').update(updatedData).eq('id', assignmentId);
      if (updateError) throw updateError;
      alert('Assignment updated successfully.');
      fetchPlanDataAndOrgMembers();
      handleCloseEditAssignmentModal();
    } catch (err) {
      alert(`Failed to update assignment: ${err.message}`);
      throw err;
    } finally {
      setPlanPageLoading(false);
    }
  };

  const assignedUserIdsForNewInvites = assignedPeople.map(p => p.id);
  const availableMusiciansToInviteGenerically = organizationMembers.filter(
    member => !assignedUserIdsForNewInvites.includes(member.id) && member.role === 'MUSICIAN'
  );
  const potentialSingersForSongs = assignedPeople.filter(person =>
    (person.status === 'ACCEPTED' || person.status === 'PENDING') &&
    person.instruments_assigned_for_event?.some(instrument => instrument.toLowerCase().includes('vocals'))
  );

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
        <div className="plan-header-title-group"><h1>{eventDetails.title}</h1></div>
        <div className="plan-header-actions">
          {profile?.role === 'ORGANIZER' && (
            <>
              <button onClick={handleOpenEditEventModal} className="edit-event-info-btn page-header-action-btn" disabled={planPageLoading}>Edit Event Info</button>
              <button onClick={handleDeleteCurrentPlan} className="delete-current-plan-btn page-header-action-btn" disabled={planPageLoading}>Delete Plan</button>
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
                <div className="view-mode-toggle">
                  <span>Edit Mode</span>
                  <label className="switch">
                    <input type="checkbox" checked={isEditMode} onChange={() => setIsEditMode(!isEditMode)} />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}
            </div>
             <OrderOfService 
                items={orderOfServiceWithTimes} 
                onOrderChange={handleOrderOfServiceChange} 
                onDeleteItem={orderOfServiceRole === 'ORGANIZER' ? handleDeleteItem : undefined} 
                onEditItem={orderOfServiceRole === 'ORGANIZER' ? handleOpenEditModal : undefined} 
                assignedPeople={assignedPeople} 
                onUpdateKey={orderOfServiceRole === 'ORGANIZER' ? handleUpdateMusicalKey : undefined} 
                userRole={profile?.role === 'ORGANIZER' ? orderOfServiceRole : 'MUSICIAN'}
              />
              {profile?.role === 'ORGANIZER' && isEditMode && (
                <button onClick={toggleAddItemForm} className={`toggle-add-item-form-btn ${isAddItemFormVisible ? 'cancel-style' : ''}`} style={{marginTop: '20px', width: '100%'}}>
                  {isAddItemFormVisible ? 'Cancel Adding Item' : '+ Add Service Item'}
                </button>
              )}
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
            {profile?.role === 'ORGANIZER' && (<button onClick={toggleInviteModal} className="invite-member-btn page-action-btn " style={{marginTop: '15px', width: '100%'}}>+ Invite/Assign Musician</button>)}
            {profile?.role === 'ORGANIZER' && <WeeklyChecklist 
              tasks={currentChecklistTasks} 
              checkedStatuses={checklistStatus} 
              onTaskToggle={profile?.role === 'ORGANIZER' ? handleChecklistToggle : undefined} 
            />
            }
          </div>
        </div>
      )}

      {isAddItemFormVisible && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleAddItemForm}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleAddItemForm}>&times;</button>
            <AddItemForm onAddItem={handleAddItem} assignedPeopleForSingerRole={potentialSingersForSongs} />
          </div>
        </div>
      )}
      {isEditItemModalOpen && editingItem && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={handleCloseEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditModal}>&times;</button>
            <EditServiceItemForm itemToEdit={editingItem} onUpdateItem={handleUpdateItem} onCancel={handleCloseEditModal} assignedPeopleForSingerRole={potentialSingersForSongs} />
          </div>
        </div>
      )}
      {isEditEventModalOpen && eventDetails && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={handleCloseEditEventModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditEventModal}>&times;</button>
            <EditEventInfoForm initialData={eventDetails} onUpdateEvent={handleUpdateEventInfo} onCancel={handleCloseEditEventModal} />
          </div>
        </div>
      )}
      {isInviteModalOpen && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleInviteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleInviteModal}>&times;</button>
            <InviteMemberForm organizationMusicians={availableMusiciansToInviteGenerically} onSendInvitation={handleSendInvitation} onCancel={toggleInviteModal} />
          </div>
        </div>
      )}
      {isEditAssignmentModalOpen && editingAssignment && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={handleCloseEditAssignmentModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={handleCloseEditAssignmentModal}>&times;</button>
            <EditAssignmentForm assignmentToEdit={editingAssignment} onUpdateAssignment={handleUpdateAssignment} onCancel={handleCloseEditAssignmentModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanPage;