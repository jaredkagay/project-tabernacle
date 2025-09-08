// src/components/TasksPage/EditTaskForm.jsx
import React, { useState, useEffect } from 'react';
import '../AllPlansPage/CreatePlanForm.css'; // Reusing styles
import { DAYS_OF_WEEK } from '../../constants';

const TASK_TYPES_DISPLAY = {
  ACKNOWLEDGEMENT: 'Expectations Acknowledgement',
  EVENT_AVAILABILITY: 'Event Availability Request',
  REHEARSAL_POLL: 'Rehearsal Availability Poll',
};

const EditTaskForm = ({ taskToEdit, onUpdateTask, onCancel, isSubmitting, upcomingOrgEvents }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [hasResponses, setHasResponses] = useState(false);

  // Type-specific fields state
  const [acknowledgementBodyText, setAcknowledgementBodyText] = useState('');
  const [eventAvailabilityPrompt, setEventAvailabilityPrompt] = useState('');
  const [selectedEventIdsForTask, setSelectedEventIdsForTask] = useState([]);
  
  const [rehearsalPollPrompt, setRehearsalPollPrompt] = useState('');
  const [selectedDaysForPoll, setSelectedDaysForPoll] = useState([]);
  const [pollTimeStart, setPollTimeStart] = useState('18:00');
  const [pollTimeEnd, setPollTimeEnd] = useState('21:00');
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(30);

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setDueDate(taskToEdit.due_date || '');
      setHasResponses(taskToEdit.has_responses || false); // Assuming this prop is passed

      const config = taskToEdit.task_config || {};
      if (taskToEdit.type === 'ACKNOWLEDGEMENT') {
        setAcknowledgementBodyText(config.body_text || '');
      }
      if (taskToEdit.type === 'EVENT_AVAILABILITY') {
        setEventAvailabilityPrompt(config.prompt || 'Please indicate your availability:');
        setSelectedEventIdsForTask(config.event_ids || []);
      }
      if (taskToEdit.type === 'REHEARSAL_POLL') {
        setRehearsalPollPrompt(config.prompt || 'Please mark all available slots:');
        setSelectedDaysForPoll(config.days || []);
        setPollTimeStart(config.time_start || '18:00');
        setPollTimeEnd(config.time_end || '21:00');
        setPollIntervalMinutes(config.interval_minutes || 30);
      }
    }
  }, [taskToEdit]);
  
  const handleEventSelectionChange = (eventId) => {
    setSelectedEventIdsForTask(prev => prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]);
  };

  const handleDaySelectionChange = (day) => {
    setSelectedDaysForPoll(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };


  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Task title is required.'); return;
    }

    if (hasResponses) {
        if (!window.confirm("Warning: This task has existing responses. Changing its structure (e.g., adding/removing events, changing poll times) may invalidate those responses. Do you want to continue?")) {
            return;
        }
    }

    let updatedTaskConfig = { ...taskToEdit.task_config };

    if (taskToEdit.type === 'ACKNOWLEDGEMENT') {
      if (!acknowledgementBodyText.trim()) { alert('Body text is required.'); return; }
      updatedTaskConfig.body_text = acknowledgementBodyText.trim();
    } else if (taskToEdit.type === 'EVENT_AVAILABILITY') {
      if (selectedEventIdsForTask.length === 0) { alert('Please select at least one event.'); return; }
      if (!eventAvailabilityPrompt.trim()) { alert('Prompt is required.'); return; }
      updatedTaskConfig.prompt = eventAvailabilityPrompt.trim();
      updatedTaskConfig.event_ids = selectedEventIdsForTask;
    } else if (taskToEdit.type === 'REHEARSAL_POLL') {
        if (selectedDaysForPoll.length === 0) { alert('Please select at least one day.'); return; }
        if (!pollTimeStart || !pollTimeEnd || pollTimeStart >= pollTimeEnd) { alert('Valid start and end times are required.'); return; }
        updatedTaskConfig = {
            prompt: rehearsalPollPrompt.trim(),
            days: selectedDaysForPoll.sort((a,b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)),
            time_start: pollTimeStart,
            time_end: pollTimeEnd,
            interval_minutes: pollIntervalMinutes
        };
    }

    onUpdateTask({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      task_config: updatedTaskConfig,
    });
  };

  if (!taskToEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="create-plan-form edit-task-form">
      <h3>Edit Task: {taskToEdit.title}</h3>
      <p style={{ marginBottom: '15px', color: '#555' }}>
        Type: <strong>{TASK_TYPES_DISPLAY[taskToEdit.type] || taskToEdit.type}</strong> (Cannot be changed)
      </p>

      {hasResponses && <p className="form-warning">This task has responses. Modifying its structure may invalidate existing data.</p>}

      <div className="form-group">
        <label htmlFor="edit-task-title">Task Title:</label>
        <input type="text" id="edit-task-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting} />
      </div>
      <div className="form-group">
        <label htmlFor="edit-task-description">Description (Optional):</label>
        <textarea id="edit-task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={isSubmitting} />
      </div>

      {taskToEdit.type === 'ACKNOWLEDGEMENT' && (
        <div className="form-group">
          <label htmlFor="edit-acknowledgement-body">Text to Acknowledge:</label>
          <textarea id="edit-acknowledgement-body" value={acknowledgementBodyText} onChange={(e) => setAcknowledgementBodyText(e.target.value)} rows={6} required disabled={isSubmitting} />
        </div>
      )}

      {taskToEdit.type === 'EVENT_AVAILABILITY' && (
        <>
          <div className="form-group">
            <label htmlFor="edit-event-availability-prompt">Prompt for Musicians:</label>
            <input type="text" id="edit-event-availability-prompt" value={eventAvailabilityPrompt} onChange={(e) => setEventAvailabilityPrompt(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label>Select Events for Request:</label>
            <div className="checkbox-group event-selection-group">
              {(!upcomingOrgEvents || upcomingOrgEvents.length === 0) ? <p className="no-items-message">No upcoming events found.</p> :
                upcomingOrgEvents.map(event => (
                  <label key={event.id} className="checkbox-label">
                    <input type="checkbox" value={event.id} checked={selectedEventIdsForTask.includes(event.id)} onChange={() => handleEventSelectionChange(event.id)} disabled={isSubmitting}/>
                    {event.title} ({new Date(event.date + 'T00:00:00').toLocaleDateString()})
                  </label>
                ))
              }
            </div>
          </div>
        </>
      )}

      {taskToEdit.type === 'REHEARSAL_POLL' && (
        <>
          <div className="form-group">
            <label htmlFor="edit-rehearsal-poll-prompt">Prompt for Musicians:</label>
            <input type="text" id="edit-rehearsal-poll-prompt" value={rehearsalPollPrompt} onChange={(e) => setRehearsalPollPrompt(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label>Select Days for Poll:</label>
            <div className="checkbox-group day-selection-group">
              {DAYS_OF_WEEK.map(day => (
                <label key={day} className="checkbox-label">
                  <input type="checkbox" value={day} checked={selectedDaysForPoll.includes(day)} onChange={() => handleDaySelectionChange(day)} disabled={isSubmitting} />
                  {day}
                </label>
              ))}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="edit-poll-time-start">Time Range Start:</label>
              <input type="time" id="edit-poll-time-start" value={pollTimeStart} onChange={(e) => setPollTimeStart(e.target.value)} required disabled={isSubmitting} />
            </div>
            <div className="form-group">
              <label htmlFor="edit-poll-time-end">Time Range End:</label>
              <input type="time" id="edit-poll-time-end" value={pollTimeEnd} onChange={(e) => setPollTimeEnd(e.target.value)} required disabled={isSubmitting} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="edit-poll-interval">Time Slot Interval:</label>
            <select id="edit-poll-interval" value={pollIntervalMinutes} onChange={(e) => setPollIntervalMinutes(parseInt(e.target.value, 10))} disabled={isSubmitting}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
        </>
      )}
      
      <div className="form-group">
        <label htmlFor="edit-task-due-date">Due Date (Optional):</label>
        <input type="date" id="edit-task-due-date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting} />
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};
export default EditTaskForm;