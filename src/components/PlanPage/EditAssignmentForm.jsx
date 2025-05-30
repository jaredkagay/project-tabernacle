// src/components/PlanPage/EditAssignmentForm.jsx
import React, { useState, useEffect } from 'react';
import '../AllPlansPage/CreatePlanForm.css'; // Reusing styles

const EditAssignmentForm = ({ assignmentToEdit, onUpdateAssignment, onCancel }) => {
  // assignmentToEdit should contain:
  // { assignment_id, user_id, name, instruments_played_by_profile, instruments_assigned_for_event, notes_for_member }
  const [selectedInstrumentsForEvent, setSelectedInstrumentsForEvent] = useState([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (assignmentToEdit) {
      setSelectedInstrumentsForEvent(assignmentToEdit.instruments_assigned_for_event || []);
      setNotes(assignmentToEdit.notes_for_member || '');
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
        notes_for_member: notes.trim(),
      });
    } catch (error) {
      // Parent will alert
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!assignmentToEdit) return null;

  return (
    <form onSubmit={handleSubmit} className="create-plan-form edit-assignment-form">
      <h3>Edit Assignment for {assignmentToEdit.name}</h3>
      <p>Instruments {assignmentToEdit.name} can play: {assignmentToEdit.instruments_played_by_profile?.join(', ') || 'None listed'}</p>
      
      {assignmentToEdit.instruments_played_by_profile && assignmentToEdit.instruments_played_by_profile.length > 0 ? (
        <div className="form-group">
          <label>Assign Instruments for this Event:</label>
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

      <div className="form-group">
        <label htmlFor="assignment-notes">Notes for Musician (Optional):</label>
        <textarea
          id="assignment-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting || selectedInstrumentsForEvent.length === 0}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EditAssignmentForm;