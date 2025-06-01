// src/components/TasksPage/TaskDetailPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import './TaskDetailPage.css'; // Ensure this CSS file is created and styled

// Helper function to generate time slots
const generateTimeSlots = (startTimeStr, endTimeStr, intervalMinutes) => {
  const slots = [];
  let currentTime = new Date(`1970-01-01T${startTimeStr}:00`); // Use a dummy date for time manipulation
  const endTime = new Date(`1970-01-01T${endTimeStr}:00`);

  if (isNaN(currentTime.getTime()) || isNaN(endTime.getTime()) || currentTime >= endTime) {
    console.error("Invalid start/end time for generating slots", startTimeStr, endTimeStr);
    return [];
  }

  while (currentTime < endTime) {
    slots.push(
      currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    );
    currentTime.setMinutes(currentTime.getMinutes() + intervalMinutes);
  }
  return slots;
};

// Helper to render response data (can be shared or adapted from TaskResultsPage)
const renderSubmittedResponseData = (responseData, taskType, taskConfig, eventDetailsForTaskConfig) => {
  if (!responseData) return <p className="no-response-display"><em>No response was recorded.</em></p>;

  if (taskType === 'ACKNOWLEDGEMENT') {
    return responseData.acknowledged 
      ? <p>You acknowledged this task on: {responseData.acknowledged_at ? new Date(responseData.acknowledged_at).toLocaleString() : 'N/A'}</p> 
      : <p>Acknowledgement not recorded.</p>;
  }
  if (taskType === 'EVENT_AVAILABILITY') {
    if (responseData.availabilities && Object.keys(responseData.availabilities).length > 0) {
      const getEventInfo = (eventId) => {
        if (!eventDetailsForTaskConfig || eventDetailsForTaskConfig.length === 0) return { title: `Event ID: ${eventId.substring(0,8)}...`, date: '', time: '' };
        const event = eventDetailsForTaskConfig.find(e => e.id === eventId);
        return event ? { title: event.title || 'Untitled Event', date: event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString() : 'Date N/A', time: event.time || '' } : { title: `Event (ID: ${eventId.substring(0,8)}...) - Details Missing`, date: '', time: '' };
      };
      const orderedEventIds = taskConfig?.event_ids || Object.keys(responseData.availabilities);
      return (
        <div className="submitted-response-details">
          <h4>Your Submitted Availability:</h4>
          <ul className="availability-response-list view-only">
            {orderedEventIds.map(eventId => {
              const availability = responseData.availabilities[eventId];
              const eventInfo = getEventInfo(eventId);
              return (
                <li key={eventId}>
                  <strong>{eventInfo.title}</strong> ({eventInfo.date}{eventInfo.time ? `, ${eventInfo.time}` : ''}): 
                  <span className={`response-value availability-${availability?.toLowerCase()}`}>
                    {availability === 'YES' ? 'Available' : availability === 'NO' ? 'Unavailable' : availability === 'MAYBE' ? 'Maybe' : (availability || 'Not specified')}
                  </span>
                </li>);
            })}
          </ul>
        </div>
      );
    } else { return <p className="no-response-display"><em>No availability data submitted.</em></p>; }
  }
  if (taskType === 'REHEARSAL_POLL') {
    if (responseData.selected_slots && responseData.selected_slots.length > 0) {
      return (
        <div className="submitted-response-details">
          <h4>Your Submitted Rehearsal Slots:</h4>
          <ul className="raw-slot-list view-only">
            {responseData.selected_slots.map((slot, index) => (<li key={index}>{slot.day} at {slot.time}</li>))}
          </ul>
        </div>
      );
    } else { return <p className="no-response-display"><em>No rehearsal slots submitted.</em></p>; }
  }
  return <pre className="response-data-raw">{JSON.stringify(responseData, null, 2)}</pre>;
};


const TaskDetailPage = () => {
  const { assignmentId } = useParams();
  const { user, loading: authIsLoading } = useAuth(); // Get authLoading state
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true); // Page-specific loading
  const [error, setError] = useState('');
  const [isCompletingOrEditing, setIsCompletingOrEditing] = useState(false); // Combined loading state for submission/update


  // State for Event Availability Task (if needed for complex UI, otherwise handled in submit)
  const [eventDetailsForTask, setEventDetailsForTask] = useState([]);
  const [availabilityResponses, setAvailabilityResponses] = useState({});
  // --- NEW State for Rehearsal Poll Task ---
  const [allPossibleRehearsalSlots, setAllPossibleRehearsalSlots] = useState([]); // Structure: [{day: 'Monday', time: '18:00', id: 'Monday-18:00'}, ...]
  const [selectedRehearsalSlots, setSelectedRehearsalSlots] = useState([]); // Array of slot IDs like "Monday-18:00"

  const [isEditingResponse, setIsEditingResponse] = useState(false);

  const fetchTaskAssignmentDetails = useCallback(async () => {
    if (!assignmentId) {
      setError("Assignment ID is missing from the URL.");
      setLoading(false);
      return;
    }
    if (!user?.id) {
      setError("User information is not available. Cannot fetch task.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    setAssignment(null); // Reset previous state
    setTask(null);       // Reset previous state
    setEventDetailsForTask([]);
    setAvailabilityResponses({});

    try {
      const { data, error: fetchError } = await supabase
        .from('task_assignments')
        .select(`
          id, 
          status, 
          response_data, 
          assigned_to_user_id, 
          task:tasks!inner ( 
            id, 
            title, 
            type, 
            description, 
            task_config, 
            due_date,
            is_active
          )
        `)
        .eq('id', assignmentId)
        .eq('assigned_to_user_id', user.id) // Security: ensure current user is assigned this task
        .single();

      if (fetchError) {
        // This includes errors from .single() if >1 row found, or RLS errors
        throw fetchError;
      }
      if (!data) {
        // .single() returns null if 0 rows match all criteria
        throw new Error("Task assignment not found for you, or it does not exist.");
      }
      if (!data.task) {
        // Assignment found, but the INNER JOIN to tasks yielded no task (e.g., task deleted, RLS on tasks)
        throw new Error("The task associated with this assignment could not be loaded. It might be missing or inaccessible.");
      }
      
      setAssignment(data);
      setTask(data.task);

      // Pre-populate form states if response_data exists (for editing or resuming)
      if (data.response_data) {
        if (data.task.type === 'EVENT_AVAILABILITY' && data.response_data.availabilities) {
          setAvailabilityResponses(data.response_data.availabilities);
        }
        if (data.task.type === 'REHEARSAL_POLL' && data.response_data.selected_slots) {
          // Convert {day, time} objects back to "Day-Time" string IDs for state
          setSelectedRehearsalSlots(
            (data.response_data.selected_slots || []).map(slot => 
              typeof slot === 'string' ? slot : `${slot.day}-${slot.time}`
            )
          );
        }
      }

      // Fetch event details if it's an EVENT_AVAILABILITY task
      if (data.task.type === 'EVENT_AVAILABILITY' && data.task.task_config?.event_ids?.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase.from('events').select('id, title, date, time').in('id', data.task.task_config.event_ids);
        if (eventsError) { setError(prev => prev + " (Could not load event details for availability)"); }
        setEventDetailsForTask(eventsData || []);
        // Initialize responses if not already pre-filled from response_data
        if (!data.response_data?.availabilities) {
            const initialResponses = {};
            (eventsData || []).forEach(event => { initialResponses[event.id] = ''; });
            setAvailabilityResponses(initialResponses);
        }
      }

      // Generate slots if it's a REHEARSAL_POLL task
      if (data.task.type === 'REHEARSAL_POLL' && data.task.task_config) {
        const { days, time_start, time_end, interval_minutes } = data.task.task_config;
        if (days && time_start && time_end && interval_minutes) {
            const timeLabels = generateTimeSlots(time_start, time_end, interval_minutes);
            const generatedSlots = [];
            days.forEach(day => timeLabels.forEach(time => generatedSlots.push({ day, time, id: `${day}-${time}` })));
            setAllPossibleRehearsalSlots(generatedSlots);
        } else { setError(prev => prev + " (Rehearsal poll config incomplete)"); }
      }

    } catch (err) {
      console.error("Error in fetchTaskAssignmentDetails CATCH block:", err);
      setError(err.message || "Failed to load task details. It may have been removed or permissions changed.");
      // Ensure assignment and task are null if any critical error occurs
      setAssignment(null);
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, [assignmentId, user?.id]); // user.id ensures re-fetch if user changes, though unlikely on this page

  useEffect(() => {
    if (!authIsLoading) { // Wait for AuthContext to finish its loading
      if (user?.id && assignmentId) {
        fetchTaskAssignmentDetails();
      } else if (!user?.id) {
        setError("Cannot load task: User not authenticated.");
        setLoading(false);
      } else if (!assignmentId) {
        setError("Cannot load task: Assignment ID missing from URL.");
        setLoading(false);
      }
    }
  }, [authIsLoading, user?.id, assignmentId, fetchTaskAssignmentDetails]);

  const handleSlotSelection = (slotId) => {
    setSelectedRehearsalSlots(prevSelected =>
      prevSelected.includes(slotId)
        ? prevSelected.filter(id => id !== slotId)
        : [...prevSelected, slotId]
    );
  };

  const isTaskOpenForSubmission = useMemo(() => { // Renamed from isTaskOpenForSubmissionOrEdit
    if (!task) return false;
    const isActive = task.is_active;
    const now = new Date();
    const dueDate = task.due_date ? new Date(task.due_date + 'T23:59:59.999') : null; 
    return isActive && (!dueDate || now <= dueDate);
  }, [task]);

  const handleAvailabilityChange = (eventId, availability) => {
    setAvailabilityResponses(prev => ({ ...prev, [eventId]: availability }));
  };

   const completeTaskAssignment = async (responsePayload, taskTitle) => {
    setIsCompletingOrEditing(true); setError('');
    try {
      const { error: updateError } = await supabase
        .from('task_assignments')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          response_data: responsePayload,
        })
        .eq('id', assignment.id);
      if (updateError) throw updateError;
      alert(`Response for "${taskTitle}" submitted successfully!`);
      setIsEditingResponse(false); // If was editing, turn it off
      fetchTaskAssignmentDetails(); // Re-fetch to show updated status and read-only response
      // navigate('/tasks'); // Optional: navigate back immediately or let user see completed state
    } catch (err) {
      console.error("Error submitting task response:", err);
      setError(err.message || "Failed to submit response.");
    } finally {
      setIsCompletingOrEditing(false);
    }
  };

  const handleCompleteAcknowledgement = async () => {
    if (!task || !window.confirm(`Acknowledge and complete task: "${task.title}"?`)) return;
    const payload = { acknowledged: true, acknowledged_at: new Date().toISOString() };
    await completeTaskAssignment(payload, task.title);
  };

  const handleCompleteEventAvailability = async () => {
    if (!task) return;
    const requiredEventIds = task.task_config?.event_ids || [];
    const unanswered = requiredEventIds.filter(id => !availabilityResponses[id]?.trim());
    if (unanswered.length > 0) { alert("Please provide availability for all events."); return; }
    if (!window.confirm(`Submit availability for "${task.title}"?`)) return;
    await completeTaskAssignment({ availabilities: availabilityResponses }, task.title);
  };

  const handleCompleteRehearsalPoll = async () => {
    if (!task) return;
    if (!window.confirm(`Submit rehearsal availability for "${task.title}"?`)) return;
    const payload = { selected_slots: selectedRehearsalSlots.map(id => { const [day,time] = id.split('-'); return {day,time}; }) };
    await completeTaskAssignment(payload, task.title);
  };

  // Helper for sorting days, ensure DAYS_OF_WEEK is defined similar to CreateTaskForm
  const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Group slots by time for grid display
  const pollGrid = useMemo(() => {
    if (task?.type !== 'REHEARSAL_POLL' || !task.task_config || allPossibleRehearsalSlots.length === 0) {
      return { timeLabels: [], days: [], slotsByTime: {} };
    }
    const { days, time_start, time_end, interval_minutes } = task.task_config;
    const timeLabels = generateTimeSlots(time_start, time_end, interval_minutes);
    const slotsByTime = {};
    timeLabels.forEach(time => {
      slotsByTime[time] = {};
      days.forEach(day => {
        const slotId = `${day}-${time}`;
        slotsByTime[time][day] = {
          id: slotId,
          selected: selectedRehearsalSlots.includes(slotId)
        };
      });
    });
    return { timeLabels, days: days.sort((a,b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)), slotsByTime }; // Sort days for display
  }, [task, allPossibleRehearsalSlots, selectedRehearsalSlots]);

  const showCompletionForm = 
    isTaskOpenForSubmission && 
    (assignment.status === 'PENDING' || (assignment.status === 'COMPLETED' && isEditingResponse));

  // --- Render Logic ---
  if (authIsLoading || loading) { // Show loading if either auth context or this page is loading
    return <p className="page-status">Loading task details...</p>;
  }
  if (error) { // If there's an error string set, display it
    return <p className="page-status error">{error}</p>;
  }
  // This specific message should only appear if loading is done, no error, but still no assignment/task
  if (!assignment || !task) { 
    return <p className="page-status">Task details not found. It might have been removed or is no longer assigned to you.</p>;
  }

  // If task is COMPLETED and NO LONGER OPEN FOR EDITING, show read-only response and different message.
  if (assignment.status === 'COMPLETED' && !isTaskOpenForSubmission) {
    return (
      <div className="task-detail-page-container">
        <Link to="/tasks" className="back-to-tasks-btn" style={{marginBottom: '20px', display: 'inline-block'}}>&larr; Back to My Tasks</Link>
        <h1>{task.title}</h1>
        <div className="task-already-completed">
          <h3 className="form-success">This task was completed.</h3>
          {assignment.completed_at && <p>Completed on: {new Date(assignment.completed_at).toLocaleString()}</p>}
          <h4>Your Submitted Response:</h4>
          {renderSubmittedResponseData(assignment.response_data, task.type, task.task_config, eventDetailsForTask)}
          <p style={{marginTop: '15px', fontStyle: 'italic', color: '#777'}}>This task is no longer open for new responses or edits.</p>
        </div>
      </div>
    );
  }
  
  // If task is PENDING but NOT OPEN for submission
  if (assignment.status === 'PENDING' && !isTaskOpenForSubmission) {
    return (
      <div className="task-detail-page-container">
        <Link to="/tasks" className="back-to-tasks-btn" style={{marginBottom: '20px', display: 'inline-block'}}>&larr; Back to My Tasks</Link>
        <h1>{task.title}</h1>
        <div className="task-closed-message">
            <h3>Task Closed</h3>
            <p>This task is either past its due date or has been deactivated by the organizer. You can no longer submit a response.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="task-detail-page-container">
      <Link to="/tasks" className="back-to-tasks-btn" style={{marginBottom: '20px', display: 'inline-block'}}>&larr; Back to My Tasks</Link>
      
      <div className="task-header-details">
        <h1>{task.title}</h1>
        <p className="task-page-type">Type: {task.type.replace('_', ' ')}</p>
        {task.due_date && <p className="task-page-due-date"><strong>Due:</strong> {new Date(task.due_date + 'T00:00:00').toLocaleDateString()} {!isTaskOpenForSubmission && task.is_active && <span className="task-status-chip past-due-chip">(Past Due)</span>}</p>}
        {!task.is_active && <p className="task-status-chip inactive-chip">(Task Inactive)</p>}
        {task.description && <p className="task-page-description" style={{whiteSpace: 'pre-wrap'}}><strong>Description:</strong> {task.description}</p>}
      </div>

      {error && <p className="form-error" style={{textAlign:'center', marginBottom: '15px'}}>{error}</p>}

      <div className="task-completion-area">
        {/* Case 1: Task is COMPLETED and user is NOT currently editing it */}
        {assignment.status === 'COMPLETED' && !isEditingResponse && (
          <div className="task-already-completed">
            <h3 className="form-success" style={{color: '#155724', marginBottom: '10px'}}>This task was completed!</h3>
            {assignment.completed_at && <p>Completed on: {new Date(assignment.completed_at).toLocaleString()}</p>}
            <h4 style={{marginTop: '15px', marginBottom: '5px'}}>Your Submitted Response:</h4>
            {renderSubmittedResponseData(assignment.response_data, task.type, task.task_config, eventDetailsForTask)}
            
            {/* THIS IS THE "Edit Response" BUTTON LOGIC */}
            {isTaskOpenForSubmission && ( 
              <button 
                onClick={() => {
                  setIsEditingResponse(true);
                  // Pre-fill form states again based on existing response
                  if (task.type === 'EVENT_AVAILABILITY' && assignment.response_data?.availabilities) {
                    setAvailabilityResponses(assignment.response_data.availabilities);
                  }
                  if (task.type === 'REHEARSAL_POLL' && assignment.response_data?.selected_slots) {
                    setSelectedRehearsalSlots((assignment.response_data.selected_slots || []).map(slot => typeof slot === 'string' ? slot : `${slot.day}-${slot.time}`));
                  }
                }} 
                className="submit-btn edit-response-btn" 
                style={{marginTop: '20px'}}
                disabled={isCompletingOrEditing}
              >
                {isCompletingOrEditing ? 'Loading...' : 'Edit Response'}
              </button>
            )}
            {!isTaskOpenForSubmission && (
              <p style={{marginTop: '15px', fontStyle: 'italic', color: '#777'}}>
                This task is no longer open for editing (past due or inactive).
              </p>
            )}
          </div>
        )}

        {/* Case 2: Task is PENDING and NOT open for submission */}
        {assignment.status === 'PENDING' && !isTaskOpenForSubmission && (
            <div className="task-closed-message">
                <h3>Task Closed</h3>
                <p>This task is either past its due date or has been deactivated by the organizer. You can no longer submit a response.</p>
            </div>
        )}

        {/* Case 3: Show Completion/Editing Form if:
            - Task is PENDING AND OPEN, OR
            - Task is COMPLETED AND OPEN AND isEditingResponse is true 
        */}
        {showCompletionForm && (
          <>
            {task.type === 'ACKNOWLEDGEMENT' && (
              <div className="task-specific-form acknowledgement-form">
                <h3>{isEditingResponse ? 'Edit Your Acknowledgement' : 'Please Read and Acknowledge:'}</h3>
                <div className="acknowledgement-text-box">
                  {(task.task_config?.body_text || "No acknowledgement text provided.").split('\n').map((paragraph, index) => (
                      <p key={index}>{paragraph || <br />}</p>
                  ))}
                </div>
                <div className="form-actions" style={{justifyContent: 'flex-start'}}>
                    <button 
                    onClick={handleCompleteAcknowledgement}
                    className="submit-btn complete-task-btn"
                    disabled={isCompletingOrEditing}
                    >
                    {isCompletingOrEditing ? 'Submitting...' : (isEditingResponse ? 'Update Acknowledgement' : 'I Acknowledge & Complete Task')}
                    </button>
                    {isEditingResponse && (
                        <button type="button" onClick={() => setIsEditingResponse(false)} className="cancel-btn" disabled={isCompletingOrEditing}>
                            Cancel Edit
                        </button>
                    )}
                </div>
              </div>
            )}

            {task.type === 'EVENT_AVAILABILITY' && (
              <div className="task-specific-form event-availability-form">
                <h3>{isEditingResponse ? 'Edit Your Availability' : (task.task_config?.prompt || "Indicate Your Availability:")}</h3>
                {eventDetailsForTask.length === 0 && !error && <p>Loading event details for this task...</p>}
                {eventDetailsForTask.map(event => (
                  <div key={event.id} className="event-availability-item form-group">
                    <h4>{event.title} - {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString() : 'Date N/A'} {event.time || ''}</h4>
                    <div className="availability-options">
                      {['YES', 'NO', 'MAYBE'].map(option => (
                        <label key={option} className="radio-label">
                          <input 
                            type="radio" 
                            name={`event-${event.id}-availability`} 
                            value={option} 
                            checked={availabilityResponses[event.id] === option} 
                            onChange={() => handleAvailabilityChange(event.id, option)} 
                            disabled={isCompletingOrEditing} 
                          />
                          {option === 'YES' ? 'Available' : option === 'NO' ? 'Unavailable' : 'Maybe'}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {eventDetailsForTask.length > 0 && (
                  <div className="form-actions" style={{justifyContent: 'flex-start'}}>
                    <button 
                      onClick={handleCompleteEventAvailability}
                      className="submit-btn complete-task-btn"
                      disabled={isCompletingOrEditing}
                    >
                      {isCompletingOrEditing ? 'Submitting...' : (isEditingResponse ? 'Update Availability' : 'Submit Availability')}
                    </button>
                    {isEditingResponse && (
                        <button type="button" onClick={() => setIsEditingResponse(false)} className="cancel-btn" disabled={isCompletingOrEditing}>
                            Cancel Edit
                        </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {task.type === 'REHEARSAL_POLL' && task.task_config && (
              <div className="task-specific-form rehearsal-poll-form">
                <h3>{isEditingResponse ? 'Edit Your Rehearsal Availability' : (task.task_config.prompt || "Indicate Your Rehearsal Availability:")}</h3>
                {(allPossibleRehearsalSlots.length === 0 && task.task_config.days && task.task_config.time_start && task.task_config.time_end && !error) && 
                    <p>Generating time slots...</p>}
                {(allPossibleRehearsalSlots.length === 0 && !(task.task_config.days && task.task_config.time_start && task.task_config.time_end) && !error) && 
                    <p>Time slot configuration is missing or incomplete for this poll.</p>}
                
                {pollGrid.timeLabels.length > 0 && pollGrid.days.length > 0 && (
                  <div className="rehearsal-poll-grid-container">
                    <table className="rehearsal-poll-grid">
                      <thead><tr><th>Time</th>{pollGrid.days.map(day => <th key={day}>{day.substring(0,3)}</th>)}</tr></thead>
                      <tbody>
                        {pollGrid.timeLabels.map(time => (
                          <tr key={time}>
                            <td>{time}</td>
                            {pollGrid.days.map(day => {
                              const slot = pollGrid.slotsByTime[time]?.[day];
                              return (
                                <td 
                                  key={slot?.id || `${day}-${time}-empty`}
                                  className={`poll-slot ${slot ? (slot.selected ? 'selected' : 'available') : 'unavailable-slot-placeholder'}`}
                                  onClick={() => slot && !isCompletingOrEditing && handleSlotSelection(slot.id)}
                                  aria-disabled={isCompletingOrEditing}
                                ></td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {allPossibleRehearsalSlots.length > 0 && (
                  <div className="form-actions" style={{justifyContent: 'flex-start'}}>
                    <button 
                      onClick={handleCompleteRehearsalPoll}
                      className="submit-btn complete-task-btn"
                      disabled={isCompletingOrEditing}
                    >
                      {isCompletingOrEditing ? 'Submitting...' : (isEditingResponse ? 'Update Rehearsal Availability' : 'Submit Rehearsal Availability')}
                    </button>
                     {isEditingResponse && (
                        <button type="button" onClick={() => setIsEditingResponse(false)} className="cancel-btn" disabled={isCompletingOrEditing}>
                            Cancel Edit
                        </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default TaskDetailPage;