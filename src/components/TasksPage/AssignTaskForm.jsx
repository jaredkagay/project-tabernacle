// src/components/TasksPage/AssignTaskForm.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import '../AllPlansPage/CreatePlanForm.css'; 

const AssignTaskForm = ({ task, organizationMusicians, upcomingOrgEvents, onAssignTask, onCancel, isSubmitting }) => {
  const [selectedMusicianIds, setSelectedMusicianIds] = useState([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);
  
  // State for REHEARSAL_POLL mode
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [loadingPlanRoster, setLoadingPlanRoster] = useState(false);

  // Helper to fetch roster from a plan and update selection
  const fetchAndSelectRoster = async (planId) => {
    setLoadingPlanRoster(true);
    try {
      // Fetch users assigned to this plan ('ACCEPTED' or 'PENDING')
      const { data, error } = await supabase
        .from('event_assignments')
        .select('user_id')
        .eq('event_id', planId)
        .in('status', ['ACCEPTED', 'PENDING']);
        
      if (error) throw error;
      
      const rosterIds = (data || []).map(r => r.user_id);
      setSelectedMusicianIds(rosterIds);
    } catch (err) {
      console.error("Error fetching plan roster:", err);
      alert("Failed to load musicians for this plan.");
    } finally {
      setLoadingPlanRoster(false);
    }
  };

  useEffect(() => {
    if (task?.id) {
      setIsLoadingExisting(true);
      
      const initializeForm = async () => {
        // 1. Check if this task is already linked to a plan (Auto-Select Plan Logic)
        if (task.task_config?.linked_event_id) {
            setSelectedPlanId(task.task_config.linked_event_id);
            // AUTO-SYNC: Fetch the *current* roster of the linked plan. 
            // This ensures if people were added/removed from the plan, the task form reflects that.
            await fetchAndSelectRoster(task.task_config.linked_event_id);
        } else {
            // 2. If not linked to a plan, just load existing assignments normally
            const { data, error } = await supabase
                .from('task_assignments')
                .select('assigned_to_user_id')
                .eq('task_id', task.id);
            if (!error && data) {
                setSelectedMusicianIds(data.map(a => a.assigned_to_user_id));
            }
        }
        setIsLoadingExisting(false);
      };

      initializeForm();
    }
  }, [task?.id, task.task_config]);

  const handleMusicianSelectionChange = (musicianId) => {
    setSelectedMusicianIds(prev =>
      prev.includes(musicianId)
        ? prev.filter(id => id !== musicianId)
        : [...prev, musicianId]
    );
  };

  const handleSelectAll = () => {
    setSelectedMusicianIds(organizationMusicians.map(m => m.id));
  };

  const handleDeselectAll = () => {
    setSelectedMusicianIds([]);
  };

  const handlePlanSelection = async (planId) => {
    setSelectedPlanId(planId);
    await fetchAndSelectRoster(planId);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Pass selectedPlanId so the parent can save the link
    onAssignTask(selectedMusicianIds, selectedPlanId);
  };

  if (!task) return <p>No task selected.</p>;
  if (isLoadingExisting) return <p>Loading current assignments...</p>;

  const isRehearsalPoll = task.type === 'REHEARSAL_POLL';

  return (
    <form onSubmit={handleSubmit} className="create-plan-form assign-task-form">
      <h3>Manage Assignments: "{task.title}"</h3>
      
      {/* MODE: REHEARSAL POLL (Select by Plan) */}
      {isRehearsalPoll && (
        <div className="form-group">
          <p>Select an upcoming plan. This will select all musicians currently scheduled for that service.</p>
          <div className="checkbox-group" style={{maxHeight: '200px', overflowY: 'auto'}}>
            {(!upcomingOrgEvents || upcomingOrgEvents.length === 0) ? (
              <p>No upcoming plans found.</p>
            ) : (
               upcomingOrgEvents.map(plan => (
                 <label key={plan.id} className="radio-label" style={{display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer'}}>
                   <input 
                      type="radio" 
                      name="plan_selection" 
                      value={plan.id}
                      checked={selectedPlanId === plan.id}
                      onChange={() => handlePlanSelection(plan.id)}
                      disabled={isSubmitting || loadingPlanRoster}
                      style={{marginRight: '10px'}}
                   />
                   <span>{plan.title} ({new Date(plan.date + 'T00:00:00').toLocaleDateString()})</span>
                 </label>
               ))
            )}
          </div>
          {loadingPlanRoster && <p style={{fontSize: '0.9em', color: '#666'}}>Loading roster...</p>}
          {selectedPlanId && !loadingPlanRoster && (
            <p style={{fontSize: '0.9em', color: '#2ecc71', marginTop: '5px'}}>
              <strong>{selectedMusicianIds.length}</strong> musician(s) selected from this plan.
            </p>
          )}
        </div>
      )}

      {/* MODE: OTHER TASKS (Select Individual Musicians) */}
      {!isRehearsalPoll && (
        <div className="form-group">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px'}}>
            <label style={{marginBottom: 0}}>Select Musicians:</label>
            <div className="select-all-actions">
              <button type="button" onClick={handleSelectAll} className="small-text-btn" disabled={isSubmitting}>Select All</button>
              <span style={{margin: '0 5px'}}>|</span>
              <button type="button" onClick={handleDeselectAll} className="small-text-btn" disabled={isSubmitting}>Deselect All</button>
            </div>
          </div>
          
          <div className="checkbox-group multi-select-musician-group">
            {organizationMusicians.length > 0 ? (
              organizationMusicians.map(musician => (
                <label key={musician.id} className="checkbox-label">
                  <input
                      type="checkbox"
                      value={musician.id}
                      checked={selectedMusicianIds.includes(musician.id)}
                      onChange={() => handleMusicianSelectionChange(musician.id)}
                      disabled={isSubmitting}
                  />
                  {musician.first_name} {musician.last_name}
                </label>
              ))
            ) : (
              <p>No musicians found in your organization.</p>
            )}
          </div>
          <p style={{fontSize: '0.9em', color: '#666', marginTop: '5px'}}>
            Currently Selected: {selectedMusicianIds.length}
          </p>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Updating...' : 'Update Assignments'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AssignTaskForm;