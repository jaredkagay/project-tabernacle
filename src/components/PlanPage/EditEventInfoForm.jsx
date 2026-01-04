// src/components/PlanPage/EditEventInfoForm.jsx
import React, { useState, useEffect } from 'react';
// CSS handled by PlanPage.css (Shared Form Styles)

const EditEventInfoForm = ({ initialData, onUpdateEvent, onCancel }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
      setTime(initialData.time || '');
      setTheme(initialData.theme || '');
      setNotes(initialData.notes || '');
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) { alert('Event title and date are required.'); return; }
    setIsSubmitting(true);
    try {
      await onUpdateEvent({ title, date, time, theme, notes });
    } catch (error) {
      alert(`Failed to update: ${error.message}`);
    } finally { setIsSubmitting(false); }
  };

  if (!initialData) return null;

  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>Edit Event Information</h3>
      <div className="form-group">
        <label htmlFor="event-title">Title</label>
        <input type="text" id="event-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      
      <div className="form-group" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
        <div>
            <label htmlFor="event-date">Date</label>
            <input type="date" id="event-date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div>
            <label htmlFor="event-time">Time</label>
            <input type="time" id="event-time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="event-theme">Theme</label>
        <input type="text" id="event-theme" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g., Christmas Service" />
      </div>
      
      <div className="form-group">
        <label htmlFor="event-notes">Notes</label>
        <textarea id="event-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes for the team..." />
      </div>
      
      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};
export default EditEventInfoForm;