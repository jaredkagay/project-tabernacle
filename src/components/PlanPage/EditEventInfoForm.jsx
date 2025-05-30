// src/components/PlanPage/EditEventInfoForm.js
import React, { useState, useEffect } from 'react';
// You can reuse styles from CreatePlanForm or AddItemForm, or create specific ones
import '../AllPlansPage/CreatePlanForm.css'; // Example: reusing styles

const EditEventInfoForm = ({ initialData, onUpdateEvent, onCancel }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(''); // Assuming you have a time field
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      // Ensure date is in YYYY-MM-DD format for the input type="date"
      setDate(initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : '');
      setTime(initialData.time || '');
      setTheme(initialData.theme || '');
      setNotes(initialData.notes || '');
    }
  }, [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Event title and date are required.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onUpdateEvent({
        // Only pass fields that are being edited by this form
        title,
        date,
        time,
        theme,
        notes,
      });
      // Parent component will close the modal
    } catch (error) {
      alert(`Failed to update event information: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!initialData) return null; // Or a loading indicator

  return (
    <form onSubmit={handleSubmit} className="create-plan-form edit-event-info-form"> {/* Re-use or make new class */}
      <h3>Edit Event Information</h3>
      <div className="form-group">
        <label htmlFor="event-title">Title:</label>
        <input
          type="text"
          id="event-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="event-date">Date:</label>
        <input
          type="date"
          id="event-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="event-time">Time (Optional):</label>
        <input
          type="time" // Use time input
          id="event-time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="event-theme">Theme (Optional):</label>
        <input
          type="text"
          id="event-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="event-notes">Notes (Optional):</label>
        <textarea
          id="event-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      <div className="form-actions" style={{ marginTop: '15px' }}>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Event Info'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EditEventInfoForm;