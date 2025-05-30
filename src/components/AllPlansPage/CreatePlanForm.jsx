// src/components/AllPlansPage/CreatePlanForm.js
import React, { useState } from 'react';
import './CreatePlanForm.css';

const CreatePlanForm = ({ onCreatePlan, onCancel }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState(''); // <--- ADD STATE FOR TIME
  const [theme, setTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      alert('Please provide at least a title and a date for the new plan.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onCreatePlan({ title, date, time, theme, notes }); // <--- INCLUDE TIME HERE
      // Reset form or expect modal to close
      setTitle('');
      setDate('');
      setTime(''); // <--- RESET TIME
      setTheme('');
      setNotes('');
    } catch (error) {
      // Error handling might be done in the parent or here
      // alert(`Failed to create plan: ${error.message}`); // Parent handles alert now
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-plan-form">
      <h3>Create New Event Plan</h3>
      <div className="form-group">
        <label htmlFor="plan-title">Title:</label>
        <input
          type="text"
          id="plan-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Sunday Morning Worship, Youth Night"
          required
        />
      </div>
      <div className="form-group">
        <label htmlFor="plan-date">Date:</label>
        <input
          type="date"
          id="plan-date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>
      {/* --- ADD TIME FIELD --- */}
      <div className="form-group">
        <label htmlFor="plan-time">Time (Optional):</label>
        <input
          type="time" // Input type for time
          id="plan-time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </div>
      {/* --- END TIME FIELD --- */}
      <div className="form-group">
        <label htmlFor="plan-theme">Theme (Optional):</label>
        <input
          type="text"
          id="plan-theme"
          value={theme}
          onChange={(e) => setTheme(e.target.value)}
          placeholder="e.g., Love & Grace"
        />
      </div>
      <div className="form-group">
        <label htmlFor="plan-notes">Notes (Optional):</label>
        <textarea
          id="plan-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any initial notes for this plan..."
        />
      </div>
      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Plan'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default CreatePlanForm;