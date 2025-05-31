// src/components/PlanPage/AssignedPeople.js
import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AssignedPeople.css';

const AssignedPeople = ({ people, onAccept, onDecline, onRescind, onOpenEditAssignment }) => {
  const { user, profile } = useAuth();

  if (!people || people.length === 0) {
    return (
      <div className="assigned-people-card">
        <h2>Assigned Team</h2>
        <p>No one assigned to this plan yet.</p>
      </div>
    );
  }

  return (
    <div className="assigned-people-card">
      <h2>Assigned Team</h2>
      <ul>
        {people.map((person) => (
          <li key={person.assignment_id || person.id} className="team-member"> {/* Removed dynamic status class from li */}
            <div className="member-details-row">
              <div className="member-info">
                <span className="member-name"><strong>{person.name}</strong></span>
                {person.instruments_assigned_for_event && person.instruments_assigned_for_event.length > 0 && (
                  <div className="member-instruments">
                    {person.instruments_assigned_for_event.join(', ')}
                  </div>
                )}
              </div>
              <div className={`member-status-badge status-${person.status?.toLowerCase()}`}>
                <span className="status-text">{person.status || 'N/A'}</span>
              </div>
            </div>
            
            {/* Action Buttons for Musicians with PENDING status */}
            {user && user.id === person.id && person.status === 'PENDING' && (
              <div className="assignment-actions">
                <button 
                  onClick={() => onAccept(person.assignment_id)} 
                  className="action-btn accept-btn"
                >
                  Accept
                </button>
                <button 
                  onClick={() => onDecline(person.assignment_id)} 
                  className="action-btn decline-btn"
                >
                  Decline
                </button>
              </div>
            )}
            
            {/* Organizer Actions */}
            {profile?.role === 'ORGANIZER' && (
              <div className="assignment-actions organizer-actions">
                {/* Conditionally render Edit button: Show if status is NOT 'DECLINED' */}
                {person.status !== 'DECLINED' && (
                  <button
                    onClick={() => onOpenEditAssignment(person)}
                    className="action-btn edit-assignment-btn"
                    title="Edit Assignment"
                  >
                    Edit
                  </button>
                )}
                <button 
                  onClick={() => onRescind(person.assignment_id, person.name)} 
                  className="action-btn rescind-btn"
                  title="Remove this member from the plan"
                >
                  Remove
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AssignedPeople;