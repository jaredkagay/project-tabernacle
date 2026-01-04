// src/components/PlanPage/EditAssignmentForm.jsx
import React, { useState, useEffect } from 'react';

const EditAssignmentForm = ({ assignmentToEdit, onUpdateAssignment, onCancel }) => {
  // assignmentToEdit should contain:
  // { assignment_id, user_id, name, instruments_played_by_profile, instruments_assigned_for_event }
  const [selectedInstrumentsForEvent, setSelectedInstrumentsForEvent] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (assignmentToEdit) {
      setSelectedInstrumentsForEvent(assignmentToEdit.instruments_assigned_for_event || []);
    }
  }, [assignmentToEdit]);

  const handleInstrumentSelection = (instrument) => {
    setSelectedInstrumentsForEvent(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedInstrumentsForEvent.length === 0) {
      alert('Please assign at least one instrument.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onUpdateAssignment(assignmentToEdit.assignment_id, {
        instruments_assigned: selectedInstrumentsForEvent,
        // notes_for_member removed
      });
    } catch (error) {
      // Parent will alert
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!assignmentToEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>Edit Assignment for {assignmentToEdit.name}</h3>
      
      {assignmentToEdit.instruments_played_by_profile && assignmentToEdit.instruments_played_by_profile.length > 0 ? (
        <div className="form-group">
          <label>Instruments</label>
          <div className="checkbox-group">
            {assignmentToEdit.instruments_played_by_profile.map(instrument => (
              <label key={instrument} className="checkbox-label">
                <input
                  type="checkbox"
                  value={instrument}
                  checked={selectedInstrumentsForEvent.includes(instrument)}
                  onChange={() => handleInstrumentSelection(instrument)}
                />
                {instrument}
              </label>
            ))}
          </div>
        </div>
      ) : (
        <p style={{color: 'orange'}}>This musician has no instruments listed on their profile. You may need to ask them to update it.</p>
      )}

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={isSubmitting || selectedInstrumentsForEvent.length === 0}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default EditAssignmentForm;