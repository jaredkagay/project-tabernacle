// src/components/PlanPage/InviteMemberForm.jsx
import React, { useState, useEffect } from 'react';
// Use existing form styles or create new ones
import '../AllPlansPage/CreatePlanForm.css'; // Example: reusing styles

const InviteMemberForm = ({ organizationMusicians, onSendInvitation, onCancel }) => {
  const [selectedMusicianUserId, setSelectedMusicianUserId] = useState('');
  const [selectedInstrumentsForEvent, setSelectedInstrumentsForEvent] = useState([]);
  const [availableInstrumentsForSelectedMusician, setAvailableInstrumentsForSelectedMusician] = useState([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // When a musician is selected, update the available instruments for checkboxes
  useEffect(() => {
    setSelectedInstrumentsForEvent([]); // Reset selected instruments for the event
    if (selectedMusicianUserId) {
      const musician = organizationMusicians.find(m => m.id === selectedMusicianUserId);
      setAvailableInstrumentsForSelectedMusician(musician?.instruments || []);
    } else {
      setAvailableInstrumentsForSelectedMusician([]);
    }
  }, [selectedMusicianUserId, organizationMusicians]);

  const handleInstrumentSelection = (instrument) => {
    setSelectedInstrumentsForEvent(prev =>
      prev.includes(instrument)
        ? prev.filter(item => item !== instrument)
        : [...prev, instrument]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMusicianUserId || selectedInstrumentsForEvent.length === 0) {
      alert('Please select a musician and at least one instrument they will play for this event.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSendInvitation({
        musician_user_id: selectedMusicianUserId,
        instruments: selectedInstrumentsForEvent,
        notes: notes.trim(),
      });
      // Parent (PlanPage) will close modal and refresh
    } catch (error) {
      // Parent will alert, but form should know submission failed for its state
      // alert(`Failed to send invitation: ${error.message}`); // Parent handles this
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="create-plan-form invite-member-form"> {/* Re-use or new class */}
      <h3>Invite Musician to Plan</h3>
      <div className="form-group">
        <label htmlFor="select-musician">Select Musician:</label>
        <select
          id="select-musician"
          value={selectedMusicianUserId}
          onChange={(e) => setSelectedMusicianUserId(e.target.value)}
          required
        >
          <option value="">-- Choose a musician --</option>
          {organizationMusicians.map(musician => (
            <option key={musician.id} value={musician.id}>
              {musician.first_name} {musician.last_name}
            </option>
          ))}
        </select>
      </div>

      {selectedMusicianUserId && availableInstrumentsForSelectedMusician.length > 0 && (
        <div className="form-group">
          <label>Assign Instruments for this Event (from their known instruments):</label>
          <div className="checkbox-group" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            {availableInstrumentsForSelectedMusician.map(instrument => (
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
      )}
      {selectedMusicianUserId && availableInstrumentsForSelectedMusician.length === 0 && (
        <p style={{color: 'orange', fontSize: '0.9em'}}>This musician has no instruments listed on their profile. You can still assign a general role via notes if needed, or ask them to update their profile.</p>
      )}


      <div className="form-group">
        <label htmlFor="invitation-notes">Notes for Musician (Optional):</label>
        <textarea
          id="invitation-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., Specific song version, arrival time..."
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting || !selectedMusicianUserId || selectedInstrumentsForEvent.length === 0}>
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default InviteMemberForm;