// src/components/TasksPage/TasksPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import CreateTaskForm from './CreateTaskForm';
import AssignTaskForm from './AssignTaskForm';
import EditTaskForm from './EditTaskForm'; // Make sure this is imported
import './TasksPage.css';
import '../PlanPage/PlanPage.css'; // For modal styles (consider centralizing)

const TasksPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();
  
  const [createdTasks, setCreatedTasks] = useState([]); 
  const [pendingTasks, setPendingTasks] = useState([]); 
  const [completedTasksForMusician, setCompletedTasksForMusician] = useState([]); 
  
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

  const [actionInProgress, setActionInProgress] = useState(false); // General loading for task list actions

  const fetchOrganizerData = useCallback(async () => {
    if (!profile || profile.role !== 'ORGANIZER' || !profile.organization_id || !user) {
        setIsLoadingTasks(false); setCreatedTasks([]); setOrganizationMusicians([]); return;
    }
    setIsLoadingTasks(true); setError('');
    try {
      const { data: tasksData, error: tasksError } = await supabase.from('tasks').select('id, title, type, description, due_date, created_at, is_active, task_config').eq('organization_id', profile.organization_id).order('created_at', { ascending: false });
      if (tasksError) throw tasksError;
      setCreatedTasks(tasksData || []);

      const { data: membersData, error: membersError } = await supabase.from('profiles').select('id, first_name, last_name, email').eq('organization_id', profile.organization_id).eq('role', 'MUSICIAN');
      if (membersError) throw membersError;
      setOrganizationMusicians(membersData || []);

      // Fetch upcoming events for CreateTaskForm (if it needs to select events)
      // This part was in CreateTaskForm's parent previously (TasksPage).
      // Ensure CreateTaskForm gets upcomingOrgEvents if it needs them.
      // For simplicity, I'll assume CreateTaskForm might not directly need this prop for now
      // unless we are building dynamic event selection within it.
      // const today = new Date().toISOString().split('T')[0];
      // const { data: eventsData, error: eventsError } = await supabase.from('events').select('id, title, date').eq('organization_id', profile.organization_id).gte('date', today).order('date', { ascending: true });
      // if (eventsError) console.warn("Could not fetch upcoming events for task creation:", eventsError);
      // setUpcomingOrgEvents(eventsData || []); // You'd need useState for upcomingOrgEvents

    } catch (err) {
      console.error("Error fetching organizer data (tasks/musicians):", err);
      setError(err.message || "Failed to fetch organizer data.");
      setCreatedTasks([]); setOrganizationMusicians([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [profile, user?.id]);

  const fetchMusicianTasks = useCallback(async () => {
    if (!profile || profile.role !== 'MUSICIAN' || !user?.id) {
        setIsLoadingTasks(false); setPendingTasks([]); setCompletedTasksForMusician([]); return;
    }
    setIsLoadingTasks(true); setError('');
    try {
      const { data, error: fetchError } = await supabase.from('task_assignments').select(`id, status, completed_at, response_data, task:tasks!inner (id, title, type, due_date, description, task_config, is_active)`).eq('assigned_to_user_id', user.id).in('status', ['PENDING', 'COMPLETED']);
      if (fetchError) throw fetchError;
      const allAssignments = data || [];
      setPendingTasks(allAssignments.filter(a => a.status === 'PENDING' && a.task.is_active && (!a.task.due_date || new Date(a.task.due_date + 'T23:59:59') >= new Date())).sort((a,b) => new Date(a.task.due_date || Infinity) - new Date(b.task.due_date || Infinity) ));
      setCompletedTasksForMusician(allAssignments.filter(a => a.status === 'COMPLETED').sort((a,b) => new Date(b.completed_at) - new Date(a.completed_at)));
    } catch (err) {
      console.error("Error fetching musician tasks:", err);
      setError(err.message || "Failed to fetch assigned tasks.");
      setPendingTasks([]); setCompletedTasksForMusician([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [profile, user?.id]);

  useEffect(() => {
    if (!authIsLoading && profile && user) {
      if (profile.role === 'ORGANIZER') {
        fetchOrganizerData();
      } else if (profile.role === 'MUSICIAN') {
        fetchMusicianTasks();
      } else { setIsLoadingTasks(false); setError("User role undefined.");}
    } else if (!authIsLoading && !profile) { setIsLoadingTasks(false); setError("Profile not loaded."); }
  }, [authIsLoading, profile, user, fetchOrganizerData, fetchMusicianTasks]);

  const toggleCreateTaskModal = () => { setIsCreateTaskModalOpen(!isCreateTaskModalOpen); setError(''); };
  const openAssignTaskModal = (task) => { setTaskToAssign(task); setIsAssignTaskModalOpen(true); setError(''); };
  const closeAssignTaskModal = () => { setTaskToAssign(null); setIsAssignTaskModalOpen(false); };
  const openEditTaskModal = (task) => { setEditingTask(task); setIsEditTaskModalOpen(true); setError(''); };
  const closeEditTaskModal = () => { setEditingTask(null); setIsEditTaskModalOpen(false); };

  const handleCreateTask = async (taskData) => {
    if (!user || !profile?.organization_id) {throw new Error("User/Org info missing.");}
    setIsSubmittingTask(true); setError('');
    try {
      const taskToInsert = { ...taskData, organization_id: profile.organization_id, created_by_user_id: user.id };
      const { data: newTask, error: insertError } = await supabase.from('tasks').insert([taskToInsert]).select().single();
      if (insertError) throw insertError;
      setCreatedTasks(prev => [newTask, ...prev].sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      toggleCreateTaskModal(); alert(`Task "${newTask.title}" created!`);
    } catch (err) { console.error("Err creating task:", err); setError(err.message); throw err; }
    finally { setIsSubmittingTask(false); }
  };

  const handleAssignTask = async (selectedMusicianIds) => {
    if (!taskToAssign || !selectedMusicianIds?.length) {throw new Error("Task/Musicians missing.");}
    if (!user) {throw new Error("Organizer not authenticated.");}
    setIsAssigningTask(true); setError('');
    const assignments = selectedMusicianIds.map(id => ({task_id: taskToAssign.id, assigned_to_user_id: id, status: 'PENDING'}));
    try {
      const { error } = await supabase.from('task_assignments').insert(assignments);
      if (error) { if (error.message.includes('unique constraint')) throw new Error("One or more already assigned."); throw error; }
      alert(`Task "${taskToAssign.title}" assigned.`); closeAssignTaskModal();
    } catch (err) { console.error("Err assigning task:", err); setError(err.message); throw err; }
    finally { setIsAssigningTask(false); }
  };

  const handleUpdateTask = async (updatedFormData) => {
    if (!editingTask?.id) { throw new Error("Task ID missing for update."); }
    setIsUpdatingTask(true); setError('');
    try {
      const payload = { title: updatedFormData.title, description: updatedFormData.description, due_date: updatedFormData.due_date, task_config: updatedFormData.task_config };
      const { data: updatedTask, error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id).select().single();
      if (error) throw error;
      alert(`Task "${updatedTask.title}" updated!`);
      setCreatedTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      closeEditTaskModal();
    } catch (err) { console.error("Err updating task:", err); setError(err.message); throw err; }
    finally { setIsUpdatingTask(false); }
  };

  const handleToggleTaskActiveStatus = async (taskId, taskTitle, currentIsActive) => {
    const newActive = !currentIsActive;
    const action = newActive ? "activate" : "deactivate";
    if (!window.confirm(`Sure you want to ${action} "${taskTitle}"?`)) return;
    setActionInProgress(true); setError('');
    try {
      const { data: updated, error } = await supabase.from('tasks').update({ is_active: newActive }).eq('id', taskId).select().single();
      if (error) throw error;
      setCreatedTasks(prev => prev.map(t => t.id === taskId ? updated : t).sort((a,b) => new Date(b.created_at) - new Date(a.created_at)));
      alert(`Task ${action}d.`);
    } catch (err) { console.error(`Err ${action}ing task:`, err); setError(err.message); }
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
    } catch (err) { console.error("Err deleting task:", err); setError(err.message); }
    finally { setActionInProgress(false); }
  };

  if (authIsLoading) return <p className="page-status">Loading user data...</p>;
  if (!profile) return <p className="page-status">User profile not available. Please try again.</p>;

  return (
    <div className="tasks-page-container">
      <div className="tasks-header">
        <h1>{profile.role === 'ORGANIZER' ? "Manage Tasks" : "Your Tasks"}</h1>
        {profile.role === 'ORGANIZER' && (
          <button onClick={toggleCreateTaskModal} className="create-new-task-btn" disabled={actionInProgress || isSubmittingTask || isAssigningTask || isUpdatingTask}>
            + Create New Task
          </button>
        )}
      </div>

      {error && <p className="form-error page-level-error">{error}</p>}

      {profile.role === 'ORGANIZER' && (
        <div className="organizer-tasks-view">
          {isLoadingTasks && <p className="page-status">Loading tasks...</p>}
          {!isLoadingTasks && createdTasks.length === 0 && !error && (
            <p>You haven't created any tasks yet. Click "Create New Task" to get started.</p>
          )}
          {!isLoadingTasks && createdTasks.length > 0 && (
            <ul className="tasks-list">
              {createdTasks.map(task => (
                <li key={task.id} className={`task-item-card ${!task.is_active ? 'task-inactive' : ''}`}>
                  <h3>{task.title} {!task.is_active && <span className="inactive-chip">(Inactive)</span>}</h3>
                  <p className="task-type">Type: {task.type.replace('_', ' ')}</p>
                  {task.description && <p className="task-description">Desc: {task.description}</p>}
                  {task.due_date && <p className="task-due-date">Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
                  {task.type === 'ACKNOWLEDGEMENT' && task.task_config?.body_text && (
                    <div className="task-details-preview">
                        <strong>Acknowledgement Text Preview:</strong>
                        <p className="preview-text">
                            {task.task_config.body_text.substring(0,100)}
                            {task.task_config.body_text.length > 100 ? '...' : ''}
                        </p>
                    </div>
                  )}
                  <div className="task-actions">
                    <button onClick={() => openAssignTaskModal(task)} className="assign-task-btn action-btn-placeholder" disabled={actionInProgress || !task.is_active}>Assign</button>
                    <button onClick={() => openEditTaskModal(task)} className="edit-task-btn action-btn-placeholder" disabled={actionInProgress}>Edit Task</button>
                    <Link to={`/task-results/${task.id}`} className="view-results-btn action-btn-placeholder">View Results</Link>
                    <button onClick={() => handleToggleTaskActiveStatus(task.id, task.title, task.is_active)} className={`action-btn-placeholder ${task.is_active ? 'deactivate-btn' : 'activate-btn'}`} disabled={actionInProgress}>
                      {task.is_active ? 'Deactivate' : 'Activate'}
                    </button>
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
          <div className="tasks-section">
            <h2>Pending Tasks</h2>
            {isLoadingTasks && pendingTasks.length === 0 && <p className="page-status">Loading pending tasks...</p>}
            {!isLoadingTasks && pendingTasks.length === 0 && !error && (<p>You have no pending tasks. Great job!</p>)}
            {!isLoadingTasks && pendingTasks.length > 0 && (
              <ul className="tasks-list">
                {pendingTasks.map(assignment => (
                  assignment.task && 
                  <li key={assignment.id} className="task-item-card">
                    <Link to={`/task/${assignment.id}`} className="task-link">
                      <h3>{assignment.task.title}</h3>
                      <p className="task-type">Type: {assignment.task.type.replace('_', ' ')}</p>
                      {assignment.task.due_date && <p className="task-due-date">Due: {new Date(assignment.task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="tasks-section completed-tasks-section">
            <h2>Completed Tasks</h2>
            {isLoadingTasks && completedTasksForMusician.length === 0 && <p className="page-status">Loading completed tasks...</p>}
            {!isLoadingTasks && completedTasksForMusician.length === 0 && !error && (<p>You have not completed any tasks yet.</p>)}
            {!isLoadingTasks && completedTasksForMusician.length > 0 && (
              <ul className="tasks-list">
                {completedTasksForMusician.map(assignment => (
                  assignment.task &&
                  <li key={assignment.id} className="task-item-card task-completed">
                    <Link to={`/task/${assignment.id}`} className="task-link">
                      <h3>{assignment.task.title}</h3>
                      <p className="task-type">Type: {assignment.task.type.replace('_', ' ')}</p>
                      {assignment.completed_at && <p className="task-completed-date">Completed: {new Date(assignment.completed_at).toLocaleDateString()}</p>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {isCreateTaskModalOpen && profile.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleCreateTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleCreateTaskModal}>&times;</button>
            <CreateTaskForm onCreateTask={handleCreateTask} onCancel={toggleCreateTaskModal} isSubmitting={isSubmittingTask} 
              // upcomingOrgEvents={upcomingOrgEvents} // Pass if CreateTaskForm needs it for EVENT_AVAILABILITY type creation
            />
          </div>
        </div>
      )}

      {isAssignTaskModalOpen && taskToAssign && profile.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={closeAssignTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeAssignTaskModal}>&times;</button>
            <AssignTaskForm
              task={taskToAssign}
              organizationMusicians={organizationMusicians}
              onAssignTask={handleAssignTask}
              onCancel={closeAssignTaskModal}
              isSubmitting={isAssigningTask}
            />
          </div>
        </div>
      )}

      {isEditTaskModalOpen && editingTask && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={closeEditTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeEditTaskModal}>&times;</button>
            <EditTaskForm
              taskToEdit={editingTask}
              onUpdateTask={handleUpdateTask}
              onCancel={closeEditTaskModal}
              isSubmitting={isUpdatingTask}
              // upcomingOrgEvents={upcomingOrgEvents} // Only if EditTaskForm needs to re-select events
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;