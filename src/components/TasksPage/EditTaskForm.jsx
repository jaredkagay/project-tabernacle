// src/components/TasksPage/EditTaskForm.jsx
import React, { useState, useEffect } from 'react';
import '../AllPlansPage/CreatePlanForm.css'; // Reusing styles

// TASK_TYPES might be imported from a shared location if CreateTaskForm also uses it
const TASK_TYPES_DISPLAY = {
  ACKNOWLEDGEMENT: 'Expectations Acknowledgement',
  EVENT_AVAILABILITY: 'Event Availability Request',
  REHEARSAL_POLL: 'Rehearsal Availability Poll',
};

const EditTaskForm = ({ taskToEdit, onUpdateTask, onCancel, isSubmitting }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');

  // Type-specific fields state
  const [acknowledgementBodyText, setAcknowledgementBodyText] = useState('');
  const [eventAvailabilityPrompt, setEventAvailabilityPrompt] = useState('');
  const [rehearsalPollPrompt, setRehearsalPollPrompt] = useState('');
  // Note: We are not editing event_ids or poll structure (days, times) here for simplicity

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setDueDate(taskToEdit.due_date || '');

      if (taskToEdit.type === 'ACKNOWLEDGEMENT') {
        setAcknowledgementBodyText(taskToEdit.task_config?.body_text || '');
      }
      if (taskToEdit.type === 'EVENT_AVAILABILITY') {
        setEventAvailabilityPrompt(taskToEdit.task_config?.prompt || 'Please indicate your availability for the following events:');
      }
      if (taskToEdit.type === 'REHEARSAL_POLL') {
        setRehearsalPollPrompt(taskToEdit.task_config?.prompt || 'Please mark all time slots you are available for rehearsal:');
      }
    }
  }, [taskToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Task title is required.'); return;
    }

    let updatedTaskConfig = { ...taskToEdit.task_config }; // Start with existing config

    if (taskToEdit.type === 'ACKNOWLEDGEMENT') {
      if (!acknowledgementBodyText.trim()) { alert('Body text for acknowledgement is required.'); return; }
      updatedTaskConfig.body_text = acknowledgementBodyText.trim();
    } else if (taskToEdit.type === 'EVENT_AVAILABILITY') {
      if (!eventAvailabilityPrompt.trim()) { alert('Prompt for event availability is required.'); return; }
      updatedTaskConfig.prompt = eventAvailabilityPrompt.trim();
      // event_ids are not changed here
    } else if (taskToEdit.type === 'REHEARSAL_POLL') {
      if (!rehearsalPollPrompt.trim()) { alert('Prompt for rehearsal poll is required.'); return; }
      updatedTaskConfig.prompt = rehearsalPollPrompt.trim();
      // poll structure (days, times, interval) are not changed here
    }

    onUpdateTask({
      // id is not passed in payload, it's used in .eq()
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate || null,
      task_config: updatedTaskConfig,
      // type is not changed
    });
  };

  if (!taskToEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="create-plan-form edit-task-form"> {/* Use or adapt existing styles */}
      <h3>Edit Task: {taskToEdit.title}</h3>
      <p style={{ marginBottom: '15px', color: '#555' }}>
        Type: <strong>{TASK_TYPES_DISPLAY[taskToEdit.type] || taskToEdit.type}</strong> (Cannot be changed)
      </p>

      <div className="form-group">
        <label htmlFor="edit-task-title">Task Title:</label>
        <input type="text" id="edit-task-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting} />
      </div>
      <div className="form-group">
        <label htmlFor="edit-task-description">Description (Optional):</label>
        <textarea id="edit-task-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} disabled={isSubmitting} />
      </div>

      {/* --- ACKNOWLEDGEMENT FIELDS --- */}
      {taskToEdit.type === 'ACKNOWLEDGEMENT' && (
        <div className="form-group">
          <label htmlFor="edit-acknowledgement-body">Expectations / Text to Acknowledge:</label>
          <textarea id="edit-acknowledgement-body" value={acknowledgementBodyText} onChange={(e) => setAcknowledgementBodyText(e.target.value)} rows={6} required disabled={isSubmitting} />
        </div>
      )}

      {/* --- EVENT AVAILABILITY PROMPT --- */}
      {taskToEdit.type === 'EVENT_AVAILABILITY' && (
        <div className="form-group">
          <label htmlFor="edit-event-availability-prompt">Prompt for Musicians:</label>
          <input type="text" id="edit-event-availability-prompt" value={eventAvailabilityPrompt} onChange={(e) => setEventAvailabilityPrompt(e.target.value)} required disabled={isSubmitting} />
        </div>
      )}

      {/* --- REHEARSAL POLL PROMPT --- */}
      {taskToEdit.type === 'REHEARSAL_POLL' && (
        <div className="form-group">
          <label htmlFor="edit-rehearsal-poll-prompt">Prompt for Musicians:</label>
          <input type="text" id="edit-rehearsal-poll-prompt" value={rehearsalPollPrompt} onChange={(e) => setRehearsalPollPrompt(e.target.value)} required disabled={isSubmitting} />
        </div>
      )}
      
      <div className="form-group">
        <label htmlFor="edit-task-due-date">Due Date (Optional):</label>
        <input type="date" id="edit-task-due-date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={isSubmitting} />
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};
export default EditTaskForm;