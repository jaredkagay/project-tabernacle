// src/components/TasksPage/AssignTaskForm.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient'; // May not be needed if parent handles all Supabase
import '../AllPlansPage/CreatePlanForm.css'; // Reusing some styles

const AssignTaskForm = ({ task, organizationMusicians, onAssignTask, onCancel, isSubmitting }) => {
  const [selectedMusicianIds, setSelectedMusicianIds] = useState([]);
  const [existingAssignmentUserIds, setExistingAssignmentUserIds] = useState([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(true);

  // Fetch existing assignments for this task to disable already assigned users
  useEffect(() => {
    if (task?.id) {
      setIsLoadingExisting(true);
      supabase
        .from('task_assignments')
        .select('assigned_to_user_id, status')
        .eq('task_id', task.id)
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching existing assignments for task:", error);
          } else if (data) {
            setExistingAssignmentUserIds(data.map(a => a.assigned_to_user_id));
          }
          setIsLoadingExisting(false);
        });
    }
  }, [task?.id]);

  const handleMusicianSelectionChange = (musicianId) => {
    setSelectedMusicianIds(prevSelectedIds =>
      prevSelectedIds.includes(musicianId)
        ? prevSelectedIds.filter(id => id !== musicianId)
        : [...prevSelectedIds, musicianId]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedMusicianIds.length === 0) {
      alert('Please select at least one musician to assign the task to.');
      return;
    }
    onAssignTask(selectedMusicianIds); // Parent (TasksPage) handles the actual Supabase insert
  };

  if (!task) return <p>No task selected for assignment.</p>;
  if (isLoadingExisting) return <p>Loading current assignments...</p>;

  // Filter out musicians who are already assigned this task from being selectable again
  const availableMusiciansToAssign = organizationMusicians.filter(
    musician => !existingAssignmentUserIds.includes(musician.id)
  );

  return (
    <form onSubmit={handleSubmit} className="create-plan-form assign-task-form">
      <h3>Assign Task: "{task.title}"</h3>
      <p>Select musicians from your organization to assign this task to.</p>

      <div className="form-group">
        <label>Available Musicians:</label>
        {availableMusiciansToAssign.length > 0 ? (
            <div className="checkbox-group multi-select-musician-group">
            {availableMusiciansToAssign.map(musician => (
                <label key={musician.id} className="checkbox-label">
                <input
                    type="checkbox"
                    value={musician.id}
                    checked={selectedMusicianIds.includes(musician.id)}
                    onChange={() => handleMusicianSelectionChange(musician.id)}
                    disabled={isSubmitting}
                />
                {musician.first_name} {musician.last_name} ({musician.email})
                </label>
            ))}
            </div>
        ) : (
            <p>All musicians in your organization have already been assigned this task or there are no musicians.</p>
        )}
      </div>
      
      {existingAssignmentUserIds.length > 0 && (
          <div className="form-group">
              <label>Already Assigned (cannot re-assign):</label>
              <ul>
                  {organizationMusicians.filter(m => existingAssignmentUserIds.includes(m.id)).map(m => <li key={m.id} style={{fontSize: '0.9em', color: '#777'}}>{m.first_name} {m.last_name}</li>)}
              </ul>
          </div>
      )}


      <div className="form-actions">
        <button 
            type="submit" 
            className="submit-btn" 
            disabled={isSubmitting || selectedMusicianIds.length === 0}
        >
          {isSubmitting ? 'Assigning...' : 'Assign to Selected'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default AssignTaskForm;