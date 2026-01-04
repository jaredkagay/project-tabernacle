// src/components/PlanPage/WeeklyChecklist.js
import React from 'react';
import './WeeklyChecklist.css';

const WeeklyChecklist = ({ tasks, checkedStatuses, onTaskToggle }) => {

  const handleCheckboxChange = (taskString) => {
    if (onTaskToggle) {
        onTaskToggle(taskString);
    }
  };

  if (!tasks || tasks.length === 0) {
    return (
      <div className="weekly-checklist-card">
        <h3>Pre-Service Checklist</h3>
        <p>No tasks defined for this organization yet.</p>
      </div>
    );
  }

  return (
    <div className="weekly-checklist-card">
      <h3>Pre-Service Checklist</h3>
      <ul className="checklist-list">
        {tasks.map((taskString, index) => (
          <li key={taskString + '-' + index} className={`checklist-item ${checkedStatuses[taskString] ? 'completed' : ''}`}>
            <label>
              <input
                type="checkbox"
                checked={!!checkedStatuses[taskString]}
                onChange={() => handleCheckboxChange(taskString)}
                disabled={!onTaskToggle}
              />
              <span className="task-text">{taskString}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WeeklyChecklist;