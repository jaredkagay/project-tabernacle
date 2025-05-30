// src/components/PlanPage/AssignedPeople.js
import React from 'react';
import './AssignedPeople.css';

const AssignedPeople = ({ people }) => {
  if (!people || people.length === 0) {
    return <p>No one assigned to this service yet.</p>;
  }

  return (
    <div className="assigned-people-card">
      <h2>Assigned Team</h2>
      <ul>
        {people.map((person, index) => (
          <li key={person.id || index} className={`team-member status-${person.status?.toLowerCase()}`}>
            <span className="member-role"><strong>{person.role}:</strong></span>
            <span className="member-name">{person.name}</span>
            {person.status && <span className="member-status"> ({person.status})</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AssignedPeople;