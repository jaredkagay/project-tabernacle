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
  const [isCompleting, setIsCompleting] = useState(false);

  // State for Event Availability Task (if needed for complex UI, otherwise handled in submit)
  const [eventDetailsForTask, setEventDetailsForTask] = useState([]);
  const [availabilityResponses, setAvailabilityResponses] = useState({});
  // --- NEW State for Rehearsal Poll Task ---
  const [allPossibleRehearsalSlots, setAllPossibleRehearsalSlots] = useState([]); // Structure: [{day: 'Monday', time: '18:00', id: 'Monday-18:00'}, ...]
  const [selectedRehearsalSlots, setSelectedRehearsalSlots] = useState([]); // Array of slot IDs like "Monday-18:00"


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
            due_date 
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

      if (data.task?.type === 'REHEARSAL_POLL' && data.task.task_config) {
        const { days, time_start, time_end, interval_minutes } = data.task.task_config;
        if (days && time_start && time_end && interval_minutes) {
            const generatedSlots = [];
            const timeLabels = generateTimeSlots(time_start, time_end, interval_minutes);
            days.forEach(day => {
                timeLabels.forEach(time => {
                    generatedSlots.push({ day, time, id: `${day}-${time}` });
                });
            });
            setAllPossibleRehearsalSlots(generatedSlots);
            // Initialize selected slots from previously saved response_data if any
            if (data.response_data?.selected_slots) {
                 // Assuming response_data.selected_slots is an array of slot IDs
                setSelectedRehearsalSlots(data.response_data.selected_slots.map(slot => typeof slot === 'string' ? slot : `${slot.day}-${slot.time}`));
            } else {
                setSelectedRehearsalSlots([]);
            }
        } else {
            setError("Rehearsal poll task configuration is incomplete.");
        }
    }

      // If task is EVENT_AVAILABILITY, fetch details for the listed event_ids
     else if (data.task.type === 'EVENT_AVAILABILITY' && data.task.task_config?.event_ids?.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
          .from('events')
          .select('id, title, date, time')
          .in('id', data.task.task_config.event_ids);

        if (eventsError) {
          console.error("Error fetching event details for task:", eventsError);
          // Set a partial error, but allow page to render with what we have
          setError(prev => prev + " (Could not load all event details for availability section)");
          setEventDetailsForTask([]);
        } else {
          setEventDetailsForTask(eventsData || []);
          // Initialize availabilityResponses based on fetched events and any existing response_data
          const initialResponses = {};
          (eventsData || []).forEach(event => {
            const existingResponse = data.response_data?.availabilities?.[event.id];
            initialResponses[event.id] = existingResponse || ''; // Default to empty string (no selection)
          });
          setAvailabilityResponses(initialResponses);
        }
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

  const handleAvailabilityChange = (eventId, availability) => {
    setAvailabilityResponses(prev => ({ ...prev, [eventId]: availability }));
  };

  const handleCompleteAcknowledgement = async () => {
    if (!assignment || !task || task.type !== 'ACKNOWLEDGEMENT' || assignment.status !== 'PENDING') {
        setError("This task cannot be completed at this time or is not an acknowledgement task.");
        return;
    }
    if (!window.confirm(`Acknowledge and complete task: "${task.title}"?`)) return;
    setIsCompleting(true); setError('');
    try {
      const responsePayload = { acknowledged: true, acknowledged_at: new Date().toISOString() };
      const { error: updateError } = await supabase.from('task_assignments').update({
          status: 'COMPLETED', completed_at: new Date().toISOString(), response_data: responsePayload
        }).eq('id', assignment.id);
      if (updateError) throw updateError;
      alert(`Task "${task.title}" completed!`);
      navigate('/tasks');
    } catch (err) { console.error("Error completing acknowledgement:", err); setError(err.message); }
    finally { setIsCompleting(false); }
  };

  const handleCompleteEventAvailability = async () => {
    if (!assignment || !task || task.type !== 'EVENT_AVAILABILITY' || assignment.status !== 'PENDING') {
      setError("This task cannot be completed or is not an event availability task."); return;
    }
    const requiredEventIds = task.task_config?.event_ids || [];
    const unansweredEvents = requiredEventIds.filter(id => !availabilityResponses[id] || availabilityResponses[id] === '');
    if (unansweredEvents.length > 0) {
        alert(`Please provide your availability for all listed events.`); setError(`Missing availability for all events.`); return;
    }
    if (!window.confirm(`Submit your availability for "${task.title}"?`)) return;
    setIsCompleting(true); setError('');
    try {
      const responsePayload = { availabilities: availabilityResponses };
      const { error: updateError } = await supabase.from('task_assignments').update({
          status: 'COMPLETED', completed_at: new Date().toISOString(), response_data: responsePayload
        }).eq('id', assignment.id);
      if (updateError) throw updateError;
      alert(`Availability for "${task.title}" submitted!`); navigate('/tasks');
    } catch (err) { console.error("Error submitting availability:", err); setError(err.message); }
    finally { setIsCompleting(false); }
  };

  // --- NEW: Handler for Rehearsal Poll ---
  const handleCompleteRehearsalPoll = async () => {
    if (!assignment || !task || task.type !== 'REHEARSAL_POLL' || assignment.status !== 'PENDING') {
      setError("This task cannot be completed at this time.");
      return;
    }
    // No specific validation needed for selection, user can submit an empty poll if they are unavailable for all slots.
    if (!window.confirm(`Submit your rehearsal availability for "${task.title}"?`)) return;

    setIsCompleting(true); setError('');
    try {
      // Convert selected slot IDs back to {day, time} objects if preferred for DB,
      // or store array of IDs. Storing IDs is simpler if allPossibleRehearsalSlots provides context.
      // For consistency with designed response_data: { selected_slots: [{ day: "Monday", time: "18:00" }, ...] }
      const responsePayload = {
        selected_slots: selectedRehearsalSlots.map(slotId => {
          const [day, time] = slotId.split('-');
          return { day, time };
        })
      };

      const { error: updateError } = await supabase
        .from('task_assignments')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          response_data: responsePayload
        })
        .eq('id', assignment.id);

      if (updateError) throw updateError;

      alert(`Rehearsal availability for "${task.title}" submitted!`);
      navigate('/tasks');
    } catch (err) {
      console.error("Error submitting rehearsal availability:", err);
      setError(err.message || "Failed to submit rehearsal poll.");
    } finally {
      setIsCompleting(false);
    }
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

  if (assignment.status === 'COMPLETED') {
    return (
      <div className="task-detail-page-container">
        <Link to="/tasks" className="back-to-tasks-btn" style={{marginBottom: '20px', display: 'inline-block'}}>&larr; Back to My Tasks</Link>
        <h1>{task.title}</h1>
        <p className="form-success" style={{textAlign: 'center', marginTop: '20px'}}>This task has already been completed.</p>
        {/* Optionally display response_data here if useful */}
      </div>
    );
  }

  return (
    <div className="task-detail-page-container">
      <Link to="/tasks" className="back-to-tasks-btn" style={{marginBottom: '20px', display: 'inline-block'}}>&larr; Back to My Tasks</Link>
      <div className="task-header-details">
        <h1>{task.title}</h1>
        <p className="task-page-type">Type: {task.type.replace('_', ' ')}</p>
        {task.due_date && <p className="task-page-due-date"><strong>Due:</strong> {new Date(task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
        {task.description && <p className="task-page-description" style={{whiteSpace: 'pre-wrap'}}><strong>Description:</strong> {task.description}</p>}
      </div>

       {assignment.status === 'COMPLETED' && (
        <div className="task-completion-area task-already-completed">
          <h3 className="form-success">This task was completed!</h3>
          {assignment.completed_at && <p>Completed on: {new Date(assignment.completed_at).toLocaleString()}</p>}
          <h4>Your Response:</h4>
          {renderSubmittedResponseData(assignment.response_data, task.type, task.task_config, eventDetailsForTask)}
        </div>
      )}

        {assignment.status === 'PENDING' && (
            <>
            {task.type === 'ACKNOWLEDGEMENT' && assignment.status === 'PENDING' && task.task_config?.body_text && (
                <div className="task-completion-area">
                <h3>Please Read and Acknowledge:</h3>
                <div className="acknowledgement-text-box">
                    {task.task_config.body_text.split('\n').map((paragraph, index) => ( <p key={index}>{paragraph || <br />}</p> ))}
                </div>
                <button onClick={handleCompleteAcknowledgement} className="submit-btn complete-task-btn" disabled={isCompleting}>
                    {isCompleting ? 'Submitting...' : 'I Acknowledge & Complete Task'}
                </button>
                </div>
            )}

            {task.type === 'EVENT_AVAILABILITY' && assignment.status === 'PENDING' && (
                <div className="task-completion-area event-availability-form">
                <h3>{task.task_config?.prompt || "Indicate Your Availability:"}</h3>
                {eventDetailsForTask.length === 0 && !error && <p>Loading event details for this task...</p>}
                {eventDetailsForTask.length > 0 && eventDetailsForTask.map(event => (
                    <div key={event.id} className="event-availability-item form-group">
                    <h4>{event.title} - {event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString() : 'Date N/A'} {event.time || ''}</h4>
                    <div className="availability-options">
                        {['YES', 'NO', 'MAYBE'].map(option => (
                        <label key={option} className="radio-label">
                            <input type="radio" name={`event-${event.id}-availability`} value={option} checked={availabilityResponses[event.id] === option} onChange={() => handleAvailabilityChange(event.id, option)} disabled={isCompleting} />
                            {option === 'YES' ? 'Available' : option === 'NO' ? 'Unavailable' : 'Maybe'}
                        </label>
                        ))}
                    </div>
                    </div>
                ))}
                {eventDetailsForTask.length > 0 && (
                    <button onClick={handleCompleteEventAvailability} className="submit-btn complete-task-btn" disabled={isCompleting}>
                    {isCompleting ? 'Submitting...' : 'Submit Availability'}
                    </button>
                )}
                </div>
            )}

            {/* --- NEW: Rehearsal Poll UI --- */}
            {task.type === 'REHEARSAL_POLL' && assignment.status === 'PENDING' && task.task_config && (
                <div className="task-completion-area rehearsal-poll-form">
                <h3>{task.task_config.prompt || "Indicate Your Rehearsal Availability:"}</h3>
                {allPossibleRehearsalSlots.length === 0 && <p>No time slots defined for this poll.</p>}
                
                {pollGrid.timeLabels.length > 0 && (
                    <div className="rehearsal-poll-grid-container">
                    <table className="rehearsal-poll-grid">
                        <thead>
                        <tr>
                            <th>Time</th>
                            {pollGrid.days.map(day => <th key={day}>{day.substring(0,3)}</th>)}
                        </tr>
                        </thead>
                        <tbody>
                        {pollGrid.timeLabels.map(time => (
                            <tr key={time}>
                            <td>{time}</td>
                            {pollGrid.days.map(day => {
                                const slot = pollGrid.slotsByTime[time]?.[day];
                                return (
                                <td 
                                    key={slot?.id || `${day}-${time}-empty`}
                                    className={`poll-slot ${slot?.selected ? 'selected' : ''} ${slot ? 'available' : 'unavailable'}`}
                                    onClick={() => slot && handleSlotSelection(slot.id)}
                                >
                                    {/* Can add content inside if needed, e.g., a checkmark */}
                                </td>
                                );
                            })}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    </div>
                )}

                {allPossibleRehearsalSlots.length > 0 && (
                    <button 
                    onClick={handleCompleteRehearsalPoll}
                    className="submit-btn complete-task-btn"
                    disabled={isCompleting}
                    >
                    {isCompleting ? 'Submitting...' : 'Submit Rehearsal Availability'}
                    </button>
                )}
                </div>
            )}
            </>
        )}
    </div>
  );
};

export default TaskDetailPage;