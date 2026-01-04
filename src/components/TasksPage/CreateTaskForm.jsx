// src/components/TasksPage/CreateTaskForm.jsx
import React, { useState, useEffect } from 'react';
import { DAYS_OF_WEEK } from '../../constants';

const TASK_TYPES = [
  { value: 'ACKNOWLEDGEMENT', label: 'Expectations Acknowledgement' },
  { value: 'EVENT_AVAILABILITY', label: 'Event Availability Request' },
  { value: 'REHEARSAL_POLL', label: 'Rehearsal Availability Poll' },
];

const CreateTaskForm = ({ onCreateTask, onCancel, isSubmitting, upcomingOrgEvents }) => {
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState(TASK_TYPES[0].value);
  const [dueDate, setDueDate] = useState('');

  // Type-specific fields state
  const [acknowledgementBodyText, setAcknowledgementBodyText] = useState('');
  const [eventAvailabilityPrompt, setEventAvailabilityPrompt] = useState('Please indicate your availability for the following events:');
  const [selectedEventIdsForTask, setSelectedEventIdsForTask] = useState([]);
  const [rehearsalPollPrompt, setRehearsalPollPrompt] = useState('Please mark all time slots you are available for rehearsal:');
  const [selectedDaysForPoll, setSelectedDaysForPoll] = useState([]);
  const [pollTimeStart, setPollTimeStart] = useState('18:00');
  const [pollTimeEnd, setPollTimeEnd] = useState('21:00');
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(30);

  useEffect(() => {
    setAcknowledgementBodyText('');
    setEventAvailabilityPrompt('Please indicate your availability for the following events:');
    setSelectedEventIdsForTask([]);
    setRehearsalPollPrompt('Please mark all time slots you are available for rehearsal:');
    setSelectedDaysForPoll([]);
    setPollTimeStart('18:00');
    setPollTimeEnd('21:00');
    setPollIntervalMinutes(30);
  }, [selectedType]);

  const handleEventSelectionChange = (eventId) => {
    setSelectedEventIdsForTask(prev => prev.includes(eventId) ? prev.filter(id => id !== eventId) : [...prev, eventId]);
  };

  const handleDaySelectionChange = (day) => {
    setSelectedDaysForPoll(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !selectedType) {
      alert('Task title and type are required.'); return;
    }

    let taskConfig = {};
    if (selectedType === 'ACKNOWLEDGEMENT') {
      if (!acknowledgementBodyText.trim()) { alert('Body text for acknowledgement is required.'); return; }
      taskConfig = { body_text: acknowledgementBodyText.trim() };
    } else if (selectedType === 'EVENT_AVAILABILITY') {
      if (selectedEventIdsForTask.length === 0) { alert('Please select at least one event for the availability request.'); return; }
      if (!eventAvailabilityPrompt.trim()) { alert('Please provide a prompt for the event availability request.'); return; }
      taskConfig = { 
        event_ids: selectedEventIdsForTask,
        prompt: eventAvailabilityPrompt.trim()
      };
    } else if (selectedType === 'REHEARSAL_POLL') {
      if (selectedDaysForPoll.length === 0) { alert('Please select at least one day for the rehearsal poll.'); return; }
      if (!pollTimeStart || !pollTimeEnd || pollTimeStart >= pollTimeEnd) { alert('Poll start time must be before the end time.'); return; }
      if (![15, 30, 60].includes(pollIntervalMinutes)) { alert('Please select a valid interval (15, 30, or 60 minutes).'); return; }
      if (!rehearsalPollPrompt.trim()) { alert('Please provide a prompt for the rehearsal poll.'); return; }
      
      taskConfig = {
        prompt: rehearsalPollPrompt.trim(),
        days: selectedDaysForPoll.sort((a,b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)),
        time_start: pollTimeStart,
        time_end: pollTimeEnd,
        interval_minutes: pollIntervalMinutes
      };
    }

    onCreateTask({
      title: title.trim(),
      type: selectedType,
      due_date: dueDate || null,
      task_config: taskConfig,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="create-plan-form create-task-form">
      <h3>Create New Task</h3>
      <div className="form-group">
        <label htmlFor="task-title-create">Task Title:</label>
        <input type="text" id="task-title-create" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Q3 Availability, Read Welcome Packet" required disabled={isSubmitting} />
      </div>

      <div className="form-group">
        <label htmlFor="task-type-create">Task Type:</label>
        <select id="task-type-create" value={selectedType} onChange={(e) => setSelectedType(e.target.value)} disabled={isSubmitting}>
          {TASK_TYPES.map(typeOpt => (
            <option key={typeOpt.value} value={typeOpt.value}>{typeOpt.label}</option>
          ))}
        </select>
      </div>

      {selectedType === 'ACKNOWLEDGEMENT' && (
        <div className="form-group">
          <label htmlFor="acknowledgement-body-create">Text to Acknowledge:</label>
          <textarea id="acknowledgement-body-create" value={acknowledgementBodyText} onChange={(e) => setAcknowledgementBodyText(e.target.value)} rows={6} placeholder="Enter the full text..." required disabled={isSubmitting} />
        </div>
      )}

      {selectedType === 'EVENT_AVAILABILITY' && (
        <>
          <div className="form-group">
            <label htmlFor="event-availability-prompt-create">Prompt for Musicians:</label>
            <input type="text" id="event-availability-prompt-create" value={eventAvailabilityPrompt} onChange={(e) => setEventAvailabilityPrompt(e.target.value)} required disabled={isSubmitting} />
          </div>
          <div className="form-group">
            <label>Select Events for Availability Request:</label>
            <div className="checkbox-group event-selection-group">
              {(!upcomingOrgEvents || upcomingOrgEvents.length === 0) ? <p>No upcoming events found.</p> :
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

      {selectedType === 'REHEARSAL_POLL' && (
        <>
          <div className="form-group"><label htmlFor="rehearsal-poll-prompt-create">Prompt for Musicians:</label><input type="text" id="rehearsal-poll-prompt-create" value={rehearsalPollPrompt} onChange={(e) => setRehearsalPollPrompt(e.target.value)} required disabled={isSubmitting} /></div>
          <div className="form-group"><label>Select Days for Poll:</label><div className="checkbox-group day-selection-group">{DAYS_OF_WEEK.map(day => (<label key={day} className="checkbox-label"><input type="checkbox" value={day} checked={selectedDaysForPoll.includes(day)} onChange={() => handleDaySelectionChange(day)} disabled={isSubmitting} />{day}</label>))}</div></div>
          <div className="form-row"><div className="form-group"><label htmlFor="poll-time-start-create">Time Range Start:</label><input type="time" id="poll-time-start-create" value={pollTimeStart} onChange={(e) => setPollTimeStart(e.target.value)} required disabled={isSubmitting} /></div><div className="form-group"><label htmlFor="poll-time-end-create">Time Range End:</label><input type="time" id="poll-time-end-create" value={pollTimeEnd} onChange={(e) => setPollTimeEnd(e.target.value)} required disabled={isSubmitting} /></div></div>
          <div className="form-group"><label htmlFor="poll-interval-create">Time Slot Interval:</label><select id="poll-interval-create" value={pollIntervalMinutes} onChange={(e) => setPollIntervalMinutes(parseInt(e.target.value, 10))} disabled={isSubmitting}><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>60 minutes</option></select></div>
        </>
      )}
      
      <div className="form-group">
        <label htmlFor="task-due-date-create">Due Date (Optional):</label>
        <input type="date" id="task-due-date-create" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting} />
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating Task...' : 'Create Task'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default CreateTaskForm;