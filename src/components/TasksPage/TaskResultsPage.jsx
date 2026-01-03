// src/components/TasksPage/TaskResultsPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import './TaskResultsPage.css'; // We'll create this CSS file
import { DAYS_OF_WEEK } from '../../constants';

const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours, 10);
    const minute = parseInt(minutes, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 === 0 ? 12 : hour % 12;
    const formattedMinute = minute < 10 ? '0' + minute : minute;
    return `${formattedHour}:${formattedMinute} ${ampm}`;
};

const generateTimeSlots = (startTimeStr, endTimeStr, intervalMinutes) => {
    const slots = [];
    if (!startTimeStr || !endTimeStr || !intervalMinutes) return slots;

    let [startHours, startMinutes] = startTimeStr.split(':').map(Number);
    const [endHours, endMinutes] = endTimeStr.split(':').map(Number);

    let currentMinutes = startHours * 60 + startMinutes;
    const totalEndMinutes = endHours * 60 + endMinutes;

    while (currentMinutes < totalEndMinutes) {
        const hours = Math.floor(currentMinutes / 60);
        const minutes = currentMinutes % 60;
        slots.push(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        currentMinutes += intervalMinutes;
    }

    return slots;
};

const summarizeSlots = (selectedSlots, intervalMinutes = 30) => {
    if (!selectedSlots || selectedSlots.length === 0) {
        return {};
    }

    const slotsByDay = {};
    selectedSlots.forEach(slot => {
        if (!slotsByDay[slot.day]) {
            slotsByDay[slot.day] = [];
        }
        const [hours, minutes] = slot.time.split(':').map(Number);
        slotsByDay[slot.day].push(hours * 60 + minutes);
    });

    const summary = {};

    for (const day in slotsByDay) {
        const minutesList = slotsByDay[day].sort((a, b) => a - b);
        if (minutesList.length === 0) continue;

        summary[day] = [];
        let startMin = minutesList[0];
        let endMin = minutesList[0];

        for (let i = 1; i < minutesList.length; i++) {
            if (minutesList[i] === endMin + intervalMinutes) {
                endMin = minutesList[i];
            } else {
                summary[day].push({ start: startMin, end: endMin + intervalMinutes });
                startMin = minutesList[i];
                endMin = minutesList[i];
            }
        }
        summary[day].push({ start: startMin, end: endMin + intervalMinutes });
    }

    const formatMinutes = (totalMinutes) => {
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const formattedHour = hours % 12 === 0 ? 12 : hours % 12;
        const formattedMinute = minutes === 0 ? '' : `:${String(minutes).padStart(2, '0')}`;
        return `${formattedHour}${formattedMinute}${ampm}`;
    };

    const finalSummary = {};
    for (const day in summary) {
        finalSummary[day] = summary[day].map(range => {
            const startTime = formatMinutes(range.start);
            const endTime = formatMinutes(range.end);
            return `${startTime} - ${endTime}`;
        });
    }

    return finalSummary;
};

const TaskResultsPage = () => {
  const { taskId } = useParams(); // Get taskId from URL
  const { user, profile, loading: authIsLoading } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [eventDetailsForTask, setEventDetailsForTask] = useState([]); // For EVENT_AVAILABILITY tasks
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTaskResults = useCallback(async () => {
    if (!taskId || !profile || profile.role !== 'ORGANIZER' || !profile.organization_id) {
      setError("Access denied or required information is missing.");
      setLoading(false);
      return;
    }
    setLoading(true); setError('');
    try {
      // 1. Fetch the task details
      const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .select('id, title, type, task_config, organization_id')
        .eq('id', taskId)
        .eq('organization_id', profile.organization_id) // Ensure organizer owns this task
        .single();

      if (taskError) throw new Error(`Task fetch error: ${taskError.message}`);
      if (!taskData) throw new Error("Task not found or not part of your organization.");
      setTask(taskData);

      // 2. Fetch all assignments for this task, joining with profiles
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('task_assignments')
        .select(`
          id, 
          status, 
          completed_at, 
          response_data, 
          assigned_to_user_id, 
          assignee:profiles ( 
            first_name,
            last_name, 
            email
          )
        `)
        .eq('task_id', taskId)
        // FIXED: Changed 'created_at' to 'assigned_at' which exists on the table
        .order('assigned_at', { ascending: true }); 

      if (assignmentsError) throw new Error(`Assignments fetch error: ${assignmentsError.message}`);
      setAssignments(assignmentsData || []);

      // 3. If Event Availability task, fetch associated event details
      if (taskData.type === 'EVENT_AVAILABILITY' && taskData.task_config?.event_ids?.length > 0) {
        const { data: eventsData, error: eventsFetchError } = await supabase
          .from('events')
          .select('id, title, date, time')
          .in('id', taskData.task_config.event_ids);
        if (eventsFetchError) {
            console.error("Error fetching event details for results:", eventsFetchError);
        }
        
        // SORTING: Sort events by date (Ascending: Recent -> Furthest)
        const sortedEvents = (eventsData || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        setEventDetailsForTask(sortedEvents);
      }

    } catch (err) {
      console.error("Error fetching task results:", err);
      setError(err.message || "Failed to load task results.");
    } finally {
      setLoading(false);
    }
  }, [taskId, profile]);

  useEffect(() => {
    if (!authIsLoading && user && profile) {
        fetchTaskResults();
    } else if (!authIsLoading && !user) {
        setError("Please log in to view task results.");
        setLoading(false);
    }
  }, [authIsLoading, user, profile, fetchTaskResults]);


  // --- Memoized calculation for Rehearsal Poll aggregated results ---
  const rehearsalPollAggregatedResults = useMemo(() => {
    if (task?.type !== 'REHEARSAL_POLL' || !task.task_config || !assignments) {
      return { timeLabels: [], days: [], aggregatedSlots: {}, maxAvailability: 0, totalParticipants: 0 };
    }
    const { days, time_start, time_end, interval_minutes } = task.task_config;
    if (!days || !time_start || !time_end || !interval_minutes) {
        return { timeLabels: [], days: [], aggregatedSlots: {}, maxAvailability: 0, totalParticipants: 0 };
    }
    const timeLabels = generateTimeSlots(time_start, time_end, interval_minutes);
    const sortedDays = Array.isArray(days) ? [...days].sort((a, b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)) : [];
    const aggregatedSlots = {}; let maxAvailability = 0; let participantsWhoResponded = 0;
    assignments.forEach(assignment => {
      if (assignment.status === 'COMPLETED' && assignment.response_data?.selected_slots) {
        participantsWhoResponded++;
        (assignment.response_data.selected_slots || []).forEach(slot => {
          const slotId = `${slot.day}-${slot.time}`;
          if (!aggregatedSlots[slotId]) aggregatedSlots[slotId] = { count: 0, names: [] };
          aggregatedSlots[slotId].count++;
          if (assignment.assignee) aggregatedSlots[slotId].names.push(`${assignment.assignee.first_name} ${assignment.assignee.last_name}`.trim());
          if (aggregatedSlots[slotId].count > maxAvailability) maxAvailability = aggregatedSlots[slotId].count;
        });
      }
    });
    return { timeLabels, days: sortedDays, aggregatedSlots, maxAvailability, totalParticipants: participantsWhoResponded };
  }, [task, assignments]);

  // --- Aggregated Event Availability Results ---
  const aggregatedEventAvailability = useMemo(() => {
    if (task?.type !== 'EVENT_AVAILABILITY' || !assignments || !eventDetailsForTask) {
      return [];
    }
    const eventsMap = new Map();
    eventDetailsForTask.forEach(event => eventsMap.set(event.id, event));
    
    // Use the sorted order from eventDetailsForTask, not just the config IDs
    const eventIdsSorted = eventDetailsForTask.map(e => e.id);
    const resultsByEvent = {};

    eventIdsSorted.forEach(eventId => {
      const eventInfo = eventsMap.get(eventId);
      resultsByEvent[eventId] = {
        eventId: eventId,
        eventTitle: eventInfo?.title || `Event ID: ${eventId.substring(0,8)}...`,
        eventDate: eventInfo?.date ? new Date(eventInfo.date + 'T00:00:00').toLocaleDateString() : 'N/A',
        eventTime: eventInfo?.time ? formatTime(eventInfo.time) : '',
        available: [], unavailable: [], maybe: [], noResponse: []
      };
    });

    const respondedAssigneeIds = new Set();
    assignments.forEach(assignment => {
      const assigneeName = `${assignment.assignee?.first_name || 'User'} ${assignment.assignee?.last_name || ''}`.trim();
      if (assignment.status === 'COMPLETED' && assignment.response_data?.availabilities) {
        respondedAssigneeIds.add(assignment.assigned_to_user_id);
        Object.entries(assignment.response_data.availabilities).forEach(([eventId, availability]) => {
          if (resultsByEvent[eventId]) {
            if (availability === 'YES') resultsByEvent[eventId].available.push(assigneeName);
            else if (availability === 'NO') resultsByEvent[eventId].unavailable.push(assigneeName);
            else if (availability === 'MAYBE') resultsByEvent[eventId].maybe.push(assigneeName);
          }
        });
      }
    });
    
     assignments.forEach(assignment => {
        if (assignment.status === 'PENDING') {
             const assigneeName = `${assignment.assignee?.first_name || 'User'} ${assignment.assignee?.last_name || ''}`.trim();
             eventIdsSorted.forEach(eventId => {
                 if (resultsByEvent[eventId]) {
                     resultsByEvent[eventId].noResponse.push(assigneeName);
                 }
             });
        }
     });

    return eventIdsSorted.map(eventId => resultsByEvent[eventId]).filter(Boolean);
  }, [task, assignments, eventDetailsForTask]);

  const getEventInfo = (eventId) => {
    if (!eventDetailsForTask || eventDetailsForTask.length === 0) return { title: `Event ID: ${eventId.substring(0,8)}...`, date: '', time: '' };
    const event = eventDetailsForTask.find(e => e.id === eventId);
    return event ? { title: event.title || 'Untitled Event', date: event.date ? new Date(event.date + 'T00:00:00').toLocaleDateString() : 'Date N/A', time: event.time ? formatTime(event.time) : '' } : { title: `Event ID: ${eventId.substring(0,8)}... (Details Missing)`, date: '', time: '' };
  };
  
const renderIndividualResponseData = (responseData, taskType, eventDetailsForTask) => {
    if (!responseData) return <span className="no-response">No response.</span>;
    if (taskType === 'ACKNOWLEDGEMENT') { return responseData.acknowledged ? `Acknowledged: ${new Date(responseData.acknowledged_at).toLocaleString()}` : "Not Acknowledged"; }
    if (taskType === 'EVENT_AVAILABILITY') {
      if (responseData.availabilities && Object.keys(responseData.availabilities).length > 0) {
        // Use sorted event details to order the list
        let orderedEventIds = [];
        if (eventDetailsForTask && eventDetailsForTask.length > 0) {
          orderedEventIds = eventDetailsForTask.map(e => e.id).filter(id => responseData.availabilities.hasOwnProperty(id));
        } else {
          orderedEventIds = Object.keys(responseData.availabilities);
        }

        return (<ul className="availability-response-list">{orderedEventIds.map(eventId => { const availability = responseData.availabilities[eventId]; const eventInfo = getEventInfo(eventId); return (<li key={eventId}><strong>{eventInfo.title}</strong> ({eventInfo.date} {eventInfo.time}): <span className={`response-value availability-${availability?.toLowerCase()}`}>{availability || 'N/A'}</span></li>);})}</ul>);
      } else { return <span className="no-response">No availability data.</span>; }
    }
    if (taskType === 'REHEARSAL_POLL') {
        if (responseData.selected_slots && responseData.selected_slots.length > 0) {
            const summarized = summarizeSlots(responseData.selected_slots);
            return (
                <div>
                    {Object.entries(summarized).map(([day, slots]) => (
                        <div key={day} style={{ marginBottom: '5px' }}>
                            <strong>{day}:</strong>
                            <ul className="raw-slot-list" style={{ marginTop: '2px', paddingLeft: '25px' }}>
                                {slots.map((line, index) => (<li key={index}>{line}</li>))}
                            </ul>
                        </div>
                    ))}
                </div>
            );
        } else {
            return <span className="no-response">No slots selected.</span>;
        }
    }
    return <pre className="response-data-raw">{JSON.stringify(responseData, null, 2)}</pre>;
  };

  if (authIsLoading || loading) return <p className="page-status">Loading task results...</p>;
  if (error) return <p className="page-status error">{error}</p>;
  if (!task) return <p className="page-status">Task not found or not accessible.</p>;

  return (
    <div className="task-results-page-container task-detail-page-container">
      <Link to="/tasks" className="back-to-tasks-btn" style={{marginBottom: '20px', display: 'inline-block'}}>&larr; Back to Tasks List</Link>
      
      <div className="task-header-details">
        <h1>Results for: {task.title}</h1>
        <p className="task-page-type">Type: {task.type.replace('_', ' ')}</p>
      </div>

      {task.type === 'EVENT_AVAILABILITY' && (
        <div className="aggregated-event-availability task-completion-area">
          <h3>Event Availability Summary</h3>
          {aggregatedEventAvailability.length === 0 && !loading && <p>No specific events found in this task's configuration or no responses yet.</p>}
          {aggregatedEventAvailability.map(eventResult => (
            <div key={eventResult.eventId} className="event-summary-card">
              <h4>{eventResult.eventTitle} <span className="event-summary-date">({eventResult.eventDate} {eventResult.eventTime || ''})</span></h4>
              <div className="availability-category">
                <strong>Available ({eventResult.available.length}):</strong>
                <p>{eventResult.available.length > 0 ? eventResult.available.join(', ') : <span className="no-response-italic">None</span>}</p>
              </div>
              <div className="availability-category">
                <strong>Unavailable ({eventResult.unavailable.length}):</strong>
                <p>{eventResult.unavailable.length > 0 ? eventResult.unavailable.join(', ') : <span className="no-response-italic">None</span>}</p>
              </div>
              <div className="availability-category">
                <strong>Maybe ({eventResult.maybe.length}):</strong>
                <p>{eventResult.maybe.length > 0 ? eventResult.maybe.join(', ') : <span className="no-response-italic">None</span>}</p>
              </div>
              <div className="availability-category">
                <strong>No Response Yet ({eventResult.noResponse.length}):</strong>
                <p>{eventResult.noResponse.length > 0 ? eventResult.noResponse.join(', ') : <span className="no-response-italic">All responded or assigned</span>}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {task.type === 'REHEARSAL_POLL' && rehearsalPollAggregatedResults.timeLabels.length > 0 && (
        <div className="rehearsal-poll-results-grid-container task-completion-area">
          <h3>Aggregated Rehearsal Availability</h3>
          <p>{rehearsalPollAggregatedResults.totalParticipants} participant(s) responded.</p>
          <table className="rehearsal-poll-grid results-grid">
            <thead><tr><th>Time</th>{rehearsalPollAggregatedResults.days.map(day => <th key={day}>{day.substring(0,3)}</th>)}</tr></thead>
            <tbody>
              {rehearsalPollAggregatedResults.timeLabels.map(time => (
                <tr key={time}>
                  <td>{formatTime(time)}</td>
                  {rehearsalPollAggregatedResults.days.map(day => {
                    const slotId = `${day}-${time}`;
                    const slotData = rehearsalPollAggregatedResults.aggregatedSlots[slotId];
                    const count = slotData ? slotData.count : 0;
                    let cellStyle = {};
                    if (rehearsalPollAggregatedResults.maxAvailability > 0 && count > 0) {
                      const opacity = Math.max(0.2, count / rehearsalPollAggregatedResults.maxAvailability);
                      cellStyle = { backgroundColor: `rgba(46, 204, 113, ${opacity})` };
                    }
                    return (<td key={slotId} style={cellStyle} className={`poll-result-slot ${count > 0 ? 'has-availability' : ''}`} title={slotData ? `${count} available: ${slotData.names.join(', ')}` : '0 available'}>{count > 0 ? count : ''}</td>);
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="individual-responses-section task-completion-area">
        <h3>Individual Responses & Statuses</h3>
        {(!assignments || assignments.length === 0) && !loading && <p>No assignments or responses for this task yet.</p>}
        {assignments && assignments.length > 0 && (
          <table className="results-table">
            <thead><tr><th>Musician</th><th>Status</th><th>Completed At</th><th>Response Details</th></tr></thead>
            <tbody>
              {assignments.map(assign => (
                <tr key={assign.id}>
                  <td>{assign.assignee?.first_name || ''} {assign.assignee?.last_name || '(Name N/A)'}</td>
                  <td><span className={`status-badge-results status-${assign.status?.toLowerCase()}`}>{assign.status}</span></td>
                  <td>{assign.completed_at ? new Date(assign.completed_at).toLocaleString() : (assign.status === 'PENDING' ? 'Pending' : 'N/A')}</td>
                  <td>{assign.status === 'COMPLETED' ? renderIndividualResponseData(assign.response_data, task.type, eventDetailsForTask) : <span className="no-response">Pending</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default TaskResultsPage;