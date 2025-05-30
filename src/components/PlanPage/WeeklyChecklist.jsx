// src/components/PlanPage/WeeklyChecklist.js
import React from 'react'; // Removed useState
import './WeeklyChecklist.css';

// This component now receives tasks, their statuses, and a toggle handler from props
const WeeklyChecklist = ({ tasks, checkedStatuses, onTaskToggle }) => {

  if (!tasks || tasks.length === 0) {
    return (
      <div className="weekly-checklist-card">
        <h3>Pre-Service Checklist</h3>
        <p>No checklist tasks defined.</p>
      </div>
    );
  }

  return (
    <div className="weekly-checklist-card">
      <h3>Pre-Service Checklist</h3>
      <ul className="checklist-list">
        {tasks.map((task, index) => (
          <li key={index} className={`checklist-item ${checkedStatuses[index] ? 'completed' : ''}`}>
            <label>
              <input
                type="checkbox"
                checked={!!checkedStatuses[index]} // Ensure it's a boolean
                onChange={() => onTaskToggle(index)} // Call the handler passed from PlanPage
              />
              <span className="task-text">{task}</span>
            </label>
          </li>
        ))}
      </ul>
      {/* The note about session-only state can now be removed or updated, as it persists. */}
      {/* <p className="checklist-note">
        <em>Note: Checklist state is now saved with the plan.</em>
      </p> */}
    </div>
  );
};

export default WeeklyChecklist;