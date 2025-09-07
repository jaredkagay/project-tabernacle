// src/components/TasksPage/TasksPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import CreateTaskForm from './CreateTaskForm';
import AssignTaskForm from './AssignTaskForm';
import EditTaskForm from './EditTaskForm';
import './TasksPage.css';
import '../PlanPage/PlanPage.css'; // For modal styles

const TasksPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();
  
  const [createdTasks, setCreatedTasks] = useState([]);
  const [musicianTasks, setMusicianTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState('');
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState(null);
  const [organizationMusicians, setOrganizationMusicians] = useState([]);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isUpdatingTask, setIsUpdatingTask] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [upcomingOrgEvents, setUpcomingOrgEvents] = useState([]);

  useEffect(() => {
    const fetchPageData = async () => {
      if (!profile || !user) {
        setIsLoadingTasks(false);
        setError("User profile not loaded.");
        return;
      }
      
      setIsLoadingTasks(true);
      setError('');

      if (profile.role === 'ORGANIZER' && profile.organization_id) {
        try {
          const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('*').eq('organization_id', profile.organization_id).order('created_at', { ascending: false });
          if (tasksError) throw tasksError;
          setCreatedTasks(tasksData || []);

          const { data: membersData, error: membersError } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('organization_id', profile.organization_id).eq('role', 'MUSICIAN');
          if (membersError) throw membersError;
          setOrganizationMusicians(membersData || []);

          const today = new Date().toISOString().split('T')[0];
          const { data: eventsData, error: eventsError } = await supabase.from('events').select('id, title, date').eq('organization_id', profile.organization_id).gte('date', today).order('date', { ascending: true });
          if (eventsError) throw eventsError;
          setUpcomingOrgEvents(eventsData || []);
        } catch (err) {
          setError(err.message || "Failed to fetch organizer data.");
        }
      } else if (profile.role === 'MUSICIAN') {
        try {
          const { data, error: fetchError } = await supabase.from('task_assignments').select(`id, status, completed_at, task:tasks!inner (id, title, type, due_date, is_active)`).eq('assigned_to_user_id', user.id).in('status', ['PENDING', 'COMPLETED']);
          if (fetchError) throw fetchError;
          const sortedTasks = (data || []).sort((a, b) => {
            if (a.status === 'PENDING' && b.status === 'COMPLETED') return -1;
            if (a.status === 'COMPLETED' && b.status === 'PENDING') return 1;
            if (a.status === 'PENDING') {
                const dueDateA = a.task.due_date ? new Date(a.task.due_date) : new Date('9999-12-31');
                const dueDateB = b.task.due_date ? new Date(b.task.due_date) : new Date('9999-12-31');
                return dueDateA - dueDateB;
            }
            if (a.status === 'COMPLETED') return new Date(b.completed_at) - new Date(a.completed_at);
            return 0;
          });
          setMusicianTasks(sortedTasks);
        } catch (err) {
          setError(err.message || "Failed to fetch assigned tasks.");
        }
      }
      setIsLoadingTasks(false);
    };

    if (!authIsLoading) {
      fetchPageData();
    }
  }, [authIsLoading, user?.id, profile?.role, profile?.organization_id]);

  const toggleCreateTaskModal = () => { setIsCreateTaskModalOpen(!isCreateTaskModalOpen); setError(''); };
  const openAssignTaskModal = (task) => { setTaskToAssign(task); setIsAssignTaskModalOpen(true); setError(''); };
  const closeAssignTaskModal = () => { setTaskToAssign(null); setIsAssignTaskModalOpen(false); };
  const openEditTaskModal = (task) => { setEditingTask(task); setIsEditTaskModalOpen(true); setError(''); };
  const closeEditTaskModal = () => { setEditingTask(null); setIsEditTaskModalOpen(false); };

  const handleCreateTask = async (taskData) => {
    if (!user || !profile?.organization_id) throw new Error("User/Org info missing.");
    setIsSubmittingTask(true); setError('');
    try {
      const taskToInsert = { ...taskData, organization_id: profile.organization_id, created_by_user_id: user.id };
      const { data: newTask, error: insertError } = await supabase.from('tasks').insert([taskToInsert]).select().single();
      if (insertError) throw insertError;
      setCreatedTasks(prev => [newTask, ...prev].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      toggleCreateTaskModal(); alert(`Task "${newTask.title}" created!`);
    } catch (err) { setError(err.message); throw err; }
    finally { setIsSubmittingTask(false); }
  };

  const handleAssignTask = async (selectedMusicianIds) => {
    if (!taskToAssign || !selectedMusicianIds?.length) throw new Error("Task/Musicians missing.");
    setIsAssigningTask(true); setError('');
    const assignments = selectedMusicianIds.map(id => ({task_id: taskToAssign.id, assigned_to_user_id: id, status: 'PENDING'}));
    try {
      const { error } = await supabase.from('task_assignments').insert(assignments);
      if (error) { if (error.message.includes('unique constraint')) throw new Error("One or more already assigned."); throw error; }
      alert(`Task "${taskToAssign.title}" assigned.`); closeAssignTaskModal();
    } catch (err) { setError(err.message); throw err; }
    finally { setIsAssigningTask(false); }
  };

  const handleUpdateTask = async (updatedFormData) => {
    if (!editingTask?.id) throw new Error("Task ID missing for update.");
    setIsUpdatingTask(true); setError('');
    try {
      const payload = { title: updatedFormData.title, description: updatedFormData.description, due_date: updatedFormData.due_date, task_config: updatedFormData.task_config };
      const { data: updatedTask, error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id).select().single();
      if (error) throw error;
      alert(`Task "${updatedTask.title}" updated!`);
      setCreatedTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      closeEditTaskModal();
    } catch (err) { setError(err.message); throw err; }
    finally { setIsUpdatingTask(false); }
  };

  const handleToggleTaskActiveStatus = async (taskId, taskTitle, currentIsActive) => {
    const newActive = !currentIsActive;
    if (!window.confirm(`Sure you want to ${newActive ? "activate" : "deactivate"} "${taskTitle}"?`)) return;
    setActionInProgress(true); setError('');
    try {
      const { data: updated, error } = await supabase.from('tasks').update({ is_active: newActive }).eq('id', taskId).select().single();
      if (error) throw error;
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? updated : t).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      alert(`Task ${newActive ? "activated" : "deactivated"}.`);
    } catch (err) { setError(err.message); }
    finally { setActionInProgress(false); }
  };
  
  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`PERMANENTLY DELETE task "${taskTitle}" and all its assignments/responses?`)) return;
    setActionInProgress(true); setError('');
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setCreatedTasks(prev => prev.filter(t => t.id !== taskId));
      alert(`Task "${taskTitle}" deleted.`);
    } catch (err) { setError(err.message); }
    finally { setActionInProgress(false); }
  };

  const getMusicianTaskAction = (assignment) => {
    if (!assignment || !assignment.task) return { text: "Error", disabled: true };
    const taskIsOpen = assignment.task.is_active && (!assignment.task.due_date || new Date() <= new Date(assignment.task.due_date + 'T23:59:59.999'));
    if (assignment.status === 'PENDING') return taskIsOpen ? { text: "Complete Task", path: `/task/${assignment.id}`, disabled: false } : { text: "Closed", path: `/task/${assignment.id}`, disabled: true, isInfoLink: true };
    else if (assignment.status === 'COMPLETED') return taskIsOpen && assignment.task.type !== 'ACKNOWLEDGEMENT' ? { text: "View/Edit Response", path: `/task/${assignment.id}`, disabled: false } : { text: "View Response", path: `/task/${assignment.id}`, disabled: false, isInfoLink: true };
    return { text: "View Details", path: `/task/${assignment.id}`, disabled: true, isInfoLink: true };
  };

  if (authIsLoading) return <p className="page-status">Loading user data...</p>;
  if (!profile) return <p className="page-status">User profile not available. Please try again.</p>;

  return (
    <div className="tasks-page-container">
      <div className="tasks-header">
        <h1>{profile.role === 'ORGANIZER' ? "Manage Tasks" : "Your Tasks"}</h1>
        {profile.role === 'ORGANIZER' && (
          <button onClick={toggleCreateTaskModal} className="create-new-task-btn" disabled={actionInProgress || isSubmittingTask || isAssigningTask || isUpdatingTask}>+ Create New Task</button>
        )}
      </div>

      {error && <p className="form-error page-level-error">{error}</p>}

      {profile.role === 'ORGANIZER' && (
        <div className="organizer-tasks-view">
          {isLoadingTasks && <p className="page-status">Loading tasks...</p>}
          {!isLoadingTasks && createdTasks.length === 0 && !error && (<p>You haven't created any tasks yet.</p>)}
          {!isLoadingTasks && createdTasks.length > 0 && (
            <ul className="tasks-list">
              {createdTasks.map(task => (
                <li key={task.id} className={`task-item-card ${!task.is_active ? 'task-inactive' : ''}`}>
                  <h3>{task.title} {!task.is_active && <span className="inactive-chip">(Inactive)</span>}</h3>
                  <p className="task-type">Type: {task.type.replace('_', ' ')}</p>
                  {task.description && <p className="task-description">Desc: {task.description}</p>}
                  {task.due_date && <p className="task-due-date">Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
                  <div className="task-actions">
                    <button onClick={() => openAssignTaskModal(task)} className="assign-task-btn action-btn-placeholder" disabled={actionInProgress || !task.is_active}>Assign</button>
                    <button onClick={() => openEditTaskModal(task)} className="edit-task-btn action-btn-placeholder" disabled={actionInProgress}>Edit Task</button>
                    <Link to={`/task-results/${task.id}`} className="view-results-btn action-btn-placeholder">View Results</Link>
                    <button onClick={() => handleToggleTaskActiveStatus(task.id, task.title, task.is_active)} className={`action-btn-placeholder ${task.is_active ? 'deactivate-btn' : 'activate-btn'}`} disabled={actionInProgress}>{task.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button onClick={() => handleDeleteTask(task.id, task.title)} className="delete-task-btn action-btn-placeholder" disabled={actionInProgress}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {profile.role === 'MUSICIAN' && (
        <div className="musician-tasks-view">
          {isLoadingTasks && <p className="page-status">Loading your tasks...</p>}
          {!isLoadingTasks && musicianTasks.length === 0 && !error && (<p>You have no tasks assigned.</p>)}
          {!isLoadingTasks && musicianTasks.length > 0 && (
            <ul className="tasks-list">
              {musicianTasks.map(assignment => {
                if (!assignment.task) return null;
                const action = getMusicianTaskAction(assignment);
                return (
                  <li key={assignment.id} className={`task-item-card status-chip-${assignment.status?.toLowerCase()} ${!assignment.task.is_active ? 'task-inactive-display': ''} ${!action.disabled && !action.isInfoLink ? '' : 'task-closed-display'}`}>
                    <div className="task-info-musician">
                      <h3>{assignment.task.title}</h3>
                      {assignment.task.type === 'ACKNOWLEDGEMENT' && (<p className="task-type">Please acknowledge the expectations for the IV worship team.</p>)}
                      {assignment.task.type === 'REHEARSAL_POLL' && (<p className="task-type">Please let me know when you are available for rehearsal.</p>)}
                      {assignment.task.type === 'EVENT_AVAILABILITY' && (<p className="task-type">Please let me know which upcoming weeks you are available.</p>)}
                      {assignment.task.due_date && <p className="task-due-date">Due: {new Date(assignment.task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
                    </div>
                    <div className="task-status-and-action">
                        <span className={`status-badge-task status-${assignment.status?.toLowerCase()}`}>{assignment.status === 'PENDING' ? 'INCOMPLETE' : 'COMPLETE'}</span>
                        <Link to={action.path} className={`action-btn task-action-btn ${action.disabled ? 'disabled' : ''}`}>{action.text}</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {isCreateTaskModalOpen && profile.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleCreateTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleCreateTaskModal}>&times;</button>
            <CreateTaskForm onCreateTask={handleCreateTask} onCancel={toggleCreateTaskModal} isSubmitting={isSubmittingTask} upcomingOrgEvents={upcomingOrgEvents} />
          </div>
        </div>
      )}

      {isAssignTaskModalOpen && taskToAssign && profile.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={closeAssignTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeAssignTaskModal}>&times;</button>
            <AssignTaskForm task={taskToAssign} organizationMusicians={organizationMusicians} onAssignTask={handleAssignTask} onCancel={closeAssignTaskModal} isSubmitting={isAssigningTask} />
          </div>
        </div>
      )}

      {isEditTaskModalOpen && editingTask && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={closeEditTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeEditTaskModal}>&times;</button>
            <EditTaskForm taskToEdit={editingTask} onUpdateTask={handleUpdateTask} onCancel={closeEditTaskModal} isSubmitting={isUpdatingTask} upcomingOrgEvents={upcomingOrgEvents} />
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;