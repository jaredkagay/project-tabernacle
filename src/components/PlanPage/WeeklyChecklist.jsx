// src/components/PlanPage/WeeklyChecklist.js
import React from 'react'; // Removed useState
import './WeeklyChecklist.css';

// This component now receives tasks, their statuses, and a toggle handler from props
const WeeklyChecklist = ({ tasks, checkedStatuses, onTaskToggle }) => {

  const handleCheckboxChange = (taskString) => {
    if (onTaskToggle) { // Check if onTaskToggle is provided (for read-only view for musicians)
        onTaskToggle(taskString);
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="weekly-checklist-card">
        <h3>Pre-Service Checklist</h3>
        <p>No default checklist tasks defined for this organization yet.</p>
        {/* Organizers can set this in Settings */}
      </div>
    );
  }

  return (
    <div className="weekly-checklist-card">
      <h3>Pre-Service Checklist</h3>
      <ul className="checklist-list">
        {tasks.map((taskString, index) => ( // Iterate over tasks from props
          <li key={taskString + '-' + index} className={`checklist-item ${checkedStatuses[taskString] ? 'completed' : ''}`}>
            <label>
              <input
                type="checkbox"
                checked={!!checkedStatuses[taskString]} // Use taskString as key
                onChange={() => handleCheckboxChange(taskString)} // Pass taskString
                disabled={!onTaskToggle} // Disable if no toggle function (read-only for musicians)
              />
              <span className="task-text">{taskString}</span>
            </label>
          </li>
        ))}
      </ul>
      {/* The note about session-only state is no longer needed as it's persisted per plan */}
    </div>
  );
};

export default WeeklyChecklist;