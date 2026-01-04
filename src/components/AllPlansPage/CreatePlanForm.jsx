// src/components/AllPlansPage/CreatePlanForm.jsx
import React, { useState } from 'react';
// We can keep the import, but we'll clear the CSS file next so it doesn't conflict
import './CreatePlanForm.css'; 

const CreatePlanForm = ({ onCreatePlan, onCancel }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Please provide at least a title and a date.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreatePlan({ title, date, time, theme, notes });
      setTitle(''); setDate(''); setTime(''); setTheme(''); setNotes('');
    } catch (error) {
      // Parent handles error
    } finally {
      setIsSubmitting(false);
    }
  };

  // UPDATED: Changed className to "glass-form"
  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>Create New Event Plan</h3>
      
      <div className="form-group">
        <label htmlFor="plan-title">Title</label>
        <input
          type="text"
          id="plan-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      
      {/* Group Date and Time in one row for a better look */}
      <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div>
            <label htmlFor="plan-date">Date</label>
            <input
              type="date"
              id="plan-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
        </div>
        <div>
            <label htmlFor="plan-time">Time</label>
            <input
              type="time"
              id="plan-time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="plan-theme">Theme</label>
        <input
          type="text"
          id="plan-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="e.g., Easter Service"
        />
      </div>

      <div className="form-group">
        <label htmlFor="plan-notes">Notes</label>
        <textarea
          id="plan-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes..."
        />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Plan'}
        </button>
      </div>
    </form>
  );
};

export default CreatePlanForm;