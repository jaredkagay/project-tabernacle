// src/components/TasksPage/EditTaskForm.jsx
import React, { useState, useEffect } from 'react';

const EditTaskForm = ({ taskToEdit, onUpdateTask, onCancel, isSubmitting }) => {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDueDate(taskToEdit.due_date || '');
    }
  }, [taskToEdit]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdateTask({
        title,
        due_date: dueDate || null,
        // We do NOT update task_config here anymore, preserving the original
        task_config: taskToEdit.task_config 
    });
  };

  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>Edit Task</h3>
      
      <div className="form-group">
        <label>Title</label>
        <input 
          type="text" 
          value={title} 
          onChange={e => setTitle(e.target.value)} 
          required 
          disabled={isSubmitting} 
        />
      </div>

      <div className="form-group">
        <label>Due Date</label>
        <input 
          type="date" 
          value={dueDate} 
          onChange={e => setDueDate(e.target.value)} 
          disabled={isSubmitting} 
        />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>Cancel</button>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save Changes'}</button>
      </div>
    </form>
  );
};

export default EditTaskForm;