// src/components/TasksPage/CreateTaskForm.jsx
import React, { useState } from 'react';
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

  // Type-specific state
  const [acknowledgementBodyText, setAcknowledgementBodyText] = useState('');
  
  // Event Availability State
  const [selectedEventIdsForTask, setSelectedEventIdsForTask] = useState([]);
  
  // Rehearsal Poll State
  const [selectedDaysForPoll, setSelectedDaysForPoll] = useState([]);
  const [pollTimeStart, setPollTimeStart] = useState('09:00');
  const [pollTimeEnd, setPollTimeEnd] = useState('22:00');
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState(30);

  const handleSubmit = (e) => {
    e.preventDefault();
    const taskData = {
        title,
        type: selectedType,
        due_date: dueDate || null,
        is_active: true,
        task_config: {}
    };

    if (selectedType === 'ACKNOWLEDGEMENT') {
        taskData.task_config = { 
            body_text: acknowledgementBodyText 
        };
    } else if (selectedType === 'EVENT_AVAILABILITY') {
        taskData.task_config = { 
            // Hardcoded default prompt
            prompt: "Please indicate your availability for the following events:", 
            event_ids: selectedEventIdsForTask 
        };
    } else if (selectedType === 'REHEARSAL_POLL') {
        taskData.task_config = { 
            // Hardcoded default prompt
            prompt: "Please mark all time slots you are available for rehearsal:", 
            days: selectedDaysForPoll, 
            time_start: pollTimeStart, 
            time_end: pollTimeEnd, 
            interval_minutes: pollIntervalMinutes 
        };
    }
    onCreateTask(taskData);
  };

  const toggleDay = (day) => {
      setSelectedDaysForPoll(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };
  
  const toggleEvent = (eId) => {
      setSelectedEventIdsForTask(prev => prev.includes(eId) ? prev.filter(id => id !== eId) : [...prev, eId]);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>Create New Task</h3>

      <div className="form-group">
        <label>Title</label>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)} required disabled={isSubmitting} />
      </div>

      <div className="form-group">
        <label>Type</label>
        <select value={selectedType} onChange={e => setSelectedType(e.target.value)} disabled={isSubmitting}>
            {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* ACKNOWLEDGEMENT FIELDS */}
      {selectedType === 'ACKNOWLEDGEMENT' && (
          <div className="form-group">
              <label>Acknowledgement</label>
              <textarea value={acknowledgementBodyText} onChange={e => setAcknowledgementBodyText(e.target.value)} required rows={5} disabled={isSubmitting} />
          </div>
      )}

      {/* EVENT AVAILABILITY FIELDS */}
      {selectedType === 'EVENT_AVAILABILITY' && (
          <div className="form-group">
            <label>Events</label>
            <div style={{maxHeight:'150px', overflowY:'auto', border:'1px solid #e2e8f0', padding:'10px', borderRadius:'10px', background:'#f8fafc'}}>
                {upcomingOrgEvents.map(evt => (
                    <label key={evt.id} style={{display:'flex', gap:'8px', marginBottom:'5px', cursor:'pointer'}}>
                        <input type="checkbox" checked={selectedEventIdsForTask.includes(evt.id)} onChange={() => toggleEvent(evt.id)} />
                        <span>{new Date(evt.date).toLocaleDateString()} - {evt.title}</span>
                    </label>
                ))}
            </div>
            {selectedEventIdsForTask.length === 0 && <p style={{color:'#ef4444', fontSize:'0.8rem', marginTop:'4px'}}>Please select at least one event.</p>}
          </div>
      )}

      {/* REHEARSAL POLL FIELDS */}
      {selectedType === 'REHEARSAL_POLL' && (
          <>
            <div className="form-group">
                <label>Days</label>
                <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                    {DAYS_OF_WEEK.map(day => (
                        <label key={day} style={{display:'flex', gap:'5px', cursor:'pointer', fontSize:'0.9em'}}>
                            <input type="checkbox" checked={selectedDaysForPoll.includes(day)} onChange={() => toggleDay(day)} />
                            {day}
                        </label>
                    ))}
                </div>
            </div>
            <div style={{display:'flex', gap:'1rem'}}>
                <div className="form-group" style={{flex:1}}>
                    <label>Start Time</label>
                    <input type="time" value={pollTimeStart} onChange={e => setPollTimeStart(e.target.value)} required disabled={isSubmitting} />
                </div>
                <div className="form-group" style={{flex:1}}>
                    <label>End Time</label>
                    <input type="time" value={pollTimeEnd} onChange={e => setPollTimeEnd(e.target.value)} required disabled={isSubmitting} />
                </div>
            </div>
            <div className="form-group">
                <label>Interval</label>
                <select value={pollIntervalMinutes} onChange={e => setPollIntervalMinutes(Number(e.target.value))} disabled={isSubmitting}>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                </select>
            </div>
          </>
      )}

      <div className="form-group">
          <label>Due Date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} disabled={isSubmitting} />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Task'}</button>
      </div>
    </form>
  );
};

export default CreateTaskForm;