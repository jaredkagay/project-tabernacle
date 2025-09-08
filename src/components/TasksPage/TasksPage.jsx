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
import { FaPencilAlt, FaTrashAlt, FaLock, FaUnlock, FaCaretRight } from 'react-icons/fa';


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

  const fetchPageData = useCallback(async () => {
      if (!profile || !user) {
        setIsLoadingTasks(false);
        setError("User profile not loaded.");
        return;
      }
      
      setIsLoadingTasks(true);
      setError('');

      if (profile.role === 'ORGANIZER' && profile.organization_id) {
        try {
          // Fetch tasks and a count of their assignments
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('*, assignments:task_assignments(count)')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

          if (tasksError) throw tasksError;
          
          // Check if any assignments have responses
          const tasksWithResponseInfo = tasksData.map(t => ({
              ...t,
              has_responses: t.assignments[0]?.count > 0,
          }));

          setCreatedTasks(tasksWithResponseInfo || []);

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
    }, [user, profile]);

  useEffect(() => {
    if (!authIsLoading) {
      fetchPageData();
    }
  }, [authIsLoading, fetchPageData]);

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
      fetchPageData(); // Re-fetch all data
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
      if (error) { if (error.message.includes('unique constraint')) throw new Error("One or more of the selected musicians has already been assigned this task."); throw error; }
      alert(`Task "${taskToAssign.title}" assigned.`); closeAssignTaskModal();
    } catch (err) { setError(err.message); throw err; }
    finally { setIsAssigningTask(false); }
  };

  const handleUpdateTask = async (updatedFormData) => {
    if (!editingTask?.id) throw new Error("Task ID missing for update.");
    setIsUpdatingTask(true); setError('');
    try {
      const payload = { title: updatedFormData.title, due_date: updatedFormData.due_date, task_config: updatedFormData.task_config };
      const { data: updatedTask, error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id).select().single();
      if (error) throw error;
      alert(`Task "${updatedTask.title}" updated!`);
      fetchPageData();
      closeEditTaskModal();
    } catch (err) { setError(err.message); throw err; }
    finally { setIsUpdatingTask(false); }
  };

  const handleToggleTaskActiveStatus = async (taskId, taskTitle, currentIsActive) => {
    const newActive = !currentIsActive;
    if (!window.confirm(`Are you sure you want to ${newActive ? "activate" : "deactivate"} the task "${taskTitle}"?`)) return;
    setActionInProgress(true); setError('');
    try {
      const { data: updated, error } = await supabase.from('tasks').update({ is_active: newActive }).eq('id', taskId).select().single();
      if (error) throw error;
      fetchPageData();
      alert(`Task has been ${newActive ? "activated" : "deactivated"}.`);
    } catch (err) { setError(err.message); }
    finally { setActionInProgress(false); }
  };
  
  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE the task "${taskTitle}" and all of its assignments and responses? This action cannot be undone.`)) return;
    setActionInProgress(true); setError('');
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setCreatedTasks(prev => prev.filter(t => t.id !== taskId));
      alert(`Task "${taskTitle}" has been deleted.`);
    } catch (err) { setError(err.message); }
    finally { setActionInProgress(false); }
  };

  const isMusicianTaskOpen = (assignment) => {
    if (!assignment || !assignment.task) return false;
    return assignment.task.is_active && (!assignment.task.due_date || new Date() <= new Date(assignment.task.due_date + 'T23:59:59.999'));
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
                  <div className="task-info">
                    <h3>{task.title} {!task.is_active && <span className="inactive-chip">(Inactive)</span>}</h3>
                    <p className="task-type">Type: {task.type.replace('_', ' ')}</p>
                    {task.due_date && <p className="task-due-date">Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
                  </div>
                  <div className="task-actions">
                    <Link to={`/task-results/${task.id}`} className="view-results-btn">View</Link>
                    <button onClick={() => openAssignTaskModal(task)} className="item-action-btn assign-btn" title="Assign Task" disabled={actionInProgress || !task.is_active}><FaCaretRight /></button>
                    <button onClick={() => handleToggleTaskActiveStatus(task.id, task.title, task.is_active)} className={`item-action-btn ${task.is_active ? 'lock-btn' : 'unlock-btn'}`} title={task.is_active ? 'Deactivate Task' : 'Activate Task'} disabled={actionInProgress}>{task.is_active ? <FaUnlock /> : <FaLock />}</button>
                    <button onClick={() => openEditTaskModal(task)} className="item-action-btn edit-btn" title="Edit Task" disabled={actionInProgress}><FaPencilAlt /></button>
                    <button onClick={() => handleDeleteTask(task.id, task.title)} className="item-action-btn delete-btn" title="Delete Task" disabled={actionInProgress}><FaTrashAlt /></button>
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
                const isOpen = isMusicianTaskOpen(assignment);
                return (
                  <li key={assignment.id} className={`task-item-card ${!assignment.task.is_active || !isOpen ? 'task-closed-display' : ''}`}>
                    <div className="task-info-musician">
                      <h3>{assignment.task.title}</h3>
                      <p className="task-type">{assignment.task.type.replace('_', ' ')}</p>
                      {assignment.task.due_date && <p className="task-due-date">Due: {new Date(assignment.task.due_date + 'T00:00:00').toLocaleDateString()}</p>}
                    </div>
                    <div className="task-status-and-action">
                        <span className={`status-badge-task status-${assignment.status?.toLowerCase()}`}>{assignment.status === 'PENDING' ? 'INCOMPLETE' : 'COMPLETE'}</span>
                        <Link to={`/task/${assignment.id}`} className={`task-action-btn ${!isOpen && assignment.status === 'PENDING' ? 'disabled' : ''}`}>View</Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {isCreateTaskModalOpen && profile.role === 'ORGANIZER' && ( <div className="modal-overlay" onClick={toggleCreateTaskModal}> <div className="modal-content" onClick={(e) => e.stopPropagation()}> <button className="modal-close-btn" onClick={toggleCreateTaskModal}>&times;</button> <CreateTaskForm onCreateTask={handleCreateTask} onCancel={toggleCreateTaskModal} isSubmitting={isSubmittingTask} upcomingOrgEvents={upcomingOrgEvents} /> </div> </div> )}
      {isAssignTaskModalOpen && taskToAssign && profile.role === 'ORGANIZER' && ( <div className="modal-overlay" onClick={closeAssignTaskModal}> <div className="modal-content" onClick={(e) => e.stopPropagation()}> <button className="modal-close-btn" onClick={closeAssignTaskModal}>&times;</button> <AssignTaskForm task={taskToAssign} organizationMusicians={organizationMusicians} onAssignTask={handleAssignTask} onCancel={closeAssignTaskModal} isSubmitting={isAssigningTask} /> </div> </div> )}
      {isEditTaskModalOpen && editingTask && profile?.role === 'ORGANIZER' && ( <div className="modal-overlay" onClick={closeEditTaskModal}> <div className="modal-content" onClick={(e) => e.stopPropagation()}> <button className="modal-close-btn" onClick={closeEditTaskModal}>&times;</button> <EditTaskForm taskToEdit={editingTask} onUpdateTask={handleUpdateTask} onCancel={closeEditTaskModal} isSubmitting={isUpdatingTask} upcomingOrgEvents={upcomingOrgEvents} /> </div> </div> )}
    </div>
  );
};

export default TasksPage;