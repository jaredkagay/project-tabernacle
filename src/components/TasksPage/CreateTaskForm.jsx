// src/components/TasksPage/CreateTaskForm.jsx
import React, { useState, useEffect } from 'react';
// Assuming you have a shared form CSS or can reuse styles
import '../AllPlansPage/CreatePlanForm.css'; // Example: reusing some styles

const TASK_TYPES = [
  { value: 'ACKNOWLEDGEMENT', label: 'Expectations Acknowledgement' },
  { value: 'EVENT_AVAILABILITY', label: 'Event Availability Request' }, // For later
  { value: 'REHEARSAL_POLL', label: 'Rehearsal Availability Poll' }, // For later
];

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CreateTaskForm = ({ onCreateTask, onCancel, isSubmitting, upcomingOrgEvents }) => {
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState(TASK_TYPES[0].value);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Type-specific fields state
  const [acknowledgementBodyText, setAcknowledgementBodyText] = useState('');
  const [eventAvailabilityPrompt, setEventAvailabilityPrompt] = useState('Please indicate your availability for the following events:');
  const [selectedEventIdsForTask, setSelectedEventIdsForTask] = useState([]);

  // --- NEW State for Rehearsal Poll Task ---
  const [rehearsalPollPrompt, setRehearsalPollPrompt] = useState('Please mark all time slots you are available for rehearsal:');
  const [selectedDaysForPoll, setSelectedDaysForPoll] = useState([]); // e.g., ["Monday", "Wednesday"]
  const [pollTimeStart, setPollTimeStart] = useState('18:00'); // Default start time
  const [pollTimeEnd, setPollTimeEnd] = useState('21:00');   // Default end time
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(30); // Default slot interval


  // Reset type-specific fields when type changes
  useEffect(() => {
    setAcknowledgementBodyText('');
    setEventAvailabilityPrompt('Please indicate your availability for the following events:');
    setSelectedEventIdsForTask([]);
    // Reset new rehearsal poll fields
    setRehearsalPollPrompt('Please mark all time slots you are available for rehearsal:');
    setSelectedDaysForPoll([]);
    setPollTimeStart('18:00');
    setPollTimeEnd('21:00');
    setPollIntervalMinutes(30);
  }, [selectedType]);

  const handleEventSelectionChange = (eventId) => {
    setSelectedEventIdsForTask(prevSelectedIds =>
      prevSelectedIds.includes(eventId)
        ? prevSelectedIds.filter(id => id !== eventId)
        : [...prevSelectedIds, eventId]
    );
  };

// Handler for selecting days for rehearsal poll
  const handleDaySelectionChange = (day) => {
    setSelectedDaysForPoll(prevSelectedDays =>
      prevSelectedDays.includes(day)
        ? prevSelectedDays.filter(d => d !== day)
        : [...prevSelectedDays, day]
    );
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
      if (selectedEventIdsForTask.length === 0) { alert('Please select at least one event.'); return; }
      if (!eventAvailabilityPrompt.trim()) { alert('Please provide a prompt.'); return; }
      taskConfig = { event_ids: selectedEventIdsForTask, prompt: eventAvailabilityPrompt.trim() };
    } else if (selectedType === 'REHEARSAL_POLL') {
      if (selectedDaysForPoll.length === 0) { alert('Please select at least one day for the rehearsal poll.'); return; }
      if (!pollTimeStart || !pollTimeEnd) { alert('Please specify a start and end time for the poll.'); return; }
      if (pollTimeStart >= pollTimeEnd) { alert('Poll start time must be before the end time.'); return; }
      if (![15, 30, 60].includes(pollIntervalMinutes)) { alert('Please select a valid interval (15, 30, or 60 minutes).'); return; }
      if (!rehearsalPollPrompt.trim()) { alert('Please provide a prompt for the rehearsal poll.'); return; }
      
      taskConfig = {
        prompt: rehearsalPollPrompt.trim(),
        days: selectedDaysForPoll.sort((a,b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)), // Store sorted days
        time_start: pollTimeStart,
        time_end: pollTimeEnd,
        interval_minutes: pollIntervalMinutes
      };
    }

    onCreateTask({
      title: title.trim(),
      type: selectedType,
      description: description.trim() || null,
      due_date: dueDate || null,
      task_config: taskConfig,
    });
    // Form reset can be handled by parent closing modal or here if needed
  };

  return (
    <form onSubmit={handleSubmit} className="create-plan-form create-task-form"> {/* Use or adapt existing styles */}
      <h3>Create New Task</h3>
      <div className="form-group">
        <label htmlFor="task-title">Task Title:</label>
        <input
          type="text"
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Read Welcome Packet, Q3 Availability"
          required
          disabled={isSubmitting}
        />
      </div>

      <div className="form-group">
        <label htmlFor="task-type">Task Type:</label>
        <select
          id="task-type"
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          disabled={isSubmitting}
        >
          {TASK_TYPES.map(typeOpt => (
            <option key={typeOpt.value} value={typeOpt.value}>{typeOpt.label}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="task-description">Description (Optional):</label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Briefly describe the task for other organizers or your reference."
          disabled={isSubmitting}
        />
      </div>

      {selectedType === 'ACKNOWLEDGEMENT' && (
        <div className="form-group">
          <label htmlFor="acknowledgement-body">Expectations / Text to Acknowledge:</label>
          <textarea
            id="acknowledgement-body"
            value={acknowledgementBodyText}
            onChange={(e) => setAcknowledgementBodyText(e.target.value)}
            rows={6}
            placeholder="Enter the full text musicians need to read and acknowledge..."
            required
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* --- EVENT AVAILABILITY FIELDS --- */}
      {selectedType === 'EVENT_AVAILABILITY' && (
        <>
          <div className="form-group">
            <label htmlFor="event-availability-prompt">Prompt for Musicians:</label>
            <input
              type="text"
              id="event-availability-prompt"
              value={eventAvailabilityPrompt}
              onChange={(e) => setEventAvailabilityPrompt(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Select Events for Availability Request (Upcoming Only):</label>
            <div className="checkbox-group event-selection-group"> {/* Style this similar to other checkbox groups */}
              {(!upcomingOrgEvents || upcomingOrgEvents.length === 0) && <p>No upcoming events found in your organization to select.</p>}
              {upcomingOrgEvents && upcomingOrgEvents.map(event => (
                <label key={event.id} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={event.id}
                    checked={selectedEventIdsForTask.includes(event.id)}
                    onChange={() => handleEventSelectionChange(event.id)}
                    disabled={isSubmitting}
                  />
                  {event.title} ({new Date(event.date + 'T00:00:00').toLocaleDateString()})
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* --- NEW: REHEARSAL AVAILABILITY POLL FIELDS --- */}
      {selectedType === 'REHEARSAL_POLL' && (
        <>
          <div className="form-group">
            <label htmlFor="rehearsal-poll-prompt">Prompt for Musicians:</label>
            <input
              type="text"
              id="rehearsal-poll-prompt"
              value={rehearsalPollPrompt}
              onChange={(e) => setRehearsalPollPrompt(e.target.value)}
              required
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <label>Select Days for Poll:</label>
            <div className="checkbox-group day-selection-group">
              {DAYS_OF_WEEK.map(day => (
                <label key={day} className="checkbox-label">
                  <input
                    type="checkbox"
                    value={day}
                    checked={selectedDaysForPoll.includes(day)}
                    onChange={() => handleDaySelectionChange(day)}
                    disabled={isSubmitting}
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>
          <div className="form-row"> {/* For side-by-side time inputs */}
            <div className="form-group">
              <label htmlFor="poll-time-start">Time Range Start:</label>
              <input type="time" id="poll-time-start" value={pollTimeStart} onChange={(e) => setPollTimeStart(e.target.value)} required disabled={isSubmitting} />
            </div>
            <div className="form-group">
              <label htmlFor="poll-time-end">Time Range End:</label>
              <input type="time" id="poll-time-end" value={pollTimeEnd} onChange={(e) => setPollTimeEnd(e.target.value)} required disabled={isSubmitting} />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="poll-interval">Time Slot Interval (minutes):</label>
            <select id="poll-interval" value={pollIntervalMinutes} onChange={(e) => setPollIntervalMinutes(parseInt(e.target.value, 10))} disabled={isSubmitting}>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
            </select>
          </div>
        </>
      )}

      <div className="form-group">
        <label htmlFor="task-due-date">Due Date (Optional):</label>
        <input
          type="date"
          id="task-due-date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          disabled={isSubmitting}
        />
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