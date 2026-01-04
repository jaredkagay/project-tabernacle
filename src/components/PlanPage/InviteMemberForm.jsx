// src/components/PlanPage/InviteMemberForm.jsx
import React, { useState, useEffect } from 'react';
// CSS handled by PlanPage.css (Shared Form Styles)

const InviteMemberForm = ({ organizationMusicians, onSendInvitation, onCancel }) => {
  const [selectedMusicianUserId, setSelectedMusicianUserId] = useState('');
  const [selectedInstrumentsForEvent, setSelectedInstrumentsForEvent] = useState([]);
  const [availableInstrumentsForSelectedMusician, setAvailableInstrumentsForSelectedMusician] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setSelectedInstrumentsForEvent([]);
    if (selectedMusicianUserId) {
      const musician = organizationMusicians.find(m => m.id === selectedMusicianUserId);
      setAvailableInstrumentsForSelectedMusician(musician?.instruments || []);
    } else {
      setAvailableInstrumentsForSelectedMusician([]);
    }
  }, [selectedMusicianUserId, organizationMusicians]);

  const handleInstrumentSelection = (instrument) => {
    setSelectedInstrumentsForEvent(prev => prev.includes(instrument) ? prev.filter(i => i !== instrument) : [...prev, instrument]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMusicianUserId || selectedInstrumentsForEvent.length === 0) {
      alert('Please select a musician and at least one instrument.'); return;
    }
    setIsSubmitting(true);
    try {
      // Notes field removed as requested
      await onSendInvitation({ 
        musician_user_id: selectedMusicianUserId, 
        instruments: selectedInstrumentsForEvent,
        notes: null 
      });
    } catch (error) { 
      /* handled by parent */ 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>Invite Musician</h3>
      <div className="form-group">
        <label htmlFor="select-musician">Musician</label>
        <select id="select-musician" value={selectedMusicianUserId} onChange={(e) => setSelectedMusicianUserId(e.target.value)} required>
          <option value="">Select</option>
          {organizationMusicians.map(m => (
            <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
          ))}
        </select>
      </div>

      {selectedMusicianUserId && (
        <div className="form-group">
          <label>Instruments</label>
          {availableInstrumentsForSelectedMusician.length > 0 ? (
            <div className="checkbox-group">
              {availableInstrumentsForSelectedMusician.map(inst => (
                <label key={inst} className="checkbox-label">
                  <input type="checkbox" value={inst} checked={selectedInstrumentsForEvent.includes(inst)} onChange={() => handleInstrumentSelection(inst)} />
                  {inst}
                </label>
              ))}
            </div>
          ) : (
            <p style={{color: '#f59e0b', fontSize: '0.9em', fontStyle:'italic'}}>
              This member has no instruments listed on their profile.
            </p>
          )}
        </div>
      )}

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="submit-btn" disabled={isSubmitting || !selectedMusicianUserId || selectedInstrumentsForEvent.length === 0}>
          {isSubmitting ? 'Sending...' : 'Send Invitation'}
        </button>
      </div>
    </form>
  );
};
export default InviteMemberForm;