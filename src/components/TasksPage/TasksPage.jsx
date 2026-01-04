// src/components/TasksPage/TasksPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import CreateTaskForm from './CreateTaskForm';
import AssignTaskForm from './AssignTaskForm';
import EditTaskForm from './EditTaskForm';
import './TasksPage.css';
import { FaPencilAlt, FaTrashAlt, FaLock, FaUnlock, FaUserPlus, FaPlus } from 'react-icons/fa';

const formatTaskType = (type) => {
  if (!type) return '';
  return type
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const TasksPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();
  
  const [createdTasks, setCreatedTasks] = useState([]);
  const [musicianTasks, setMusicianTasks] = useState([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState('');
  
  // Modal States
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState(null);
  
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);

  // Task Actions
  const [organizationMusicians, setOrganizationMusicians] = useState([]);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
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
          const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('*, assignments:task_assignments(count)')
            .eq('organization_id', profile.organization_id)
            .order('created_at', { ascending: false });

          if (tasksError) throw tasksError;
          
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
          
          const activeTasks = (data || []).filter(assignment => assignment.task && assignment.task.is_active);

          const sortedTasks = activeTasks.sort((a, b) => {
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

  // Handlers
  const toggleCreateTaskModal = () => { setIsCreateTaskModalOpen(!isCreateTaskModalOpen); setError(''); };
  
  const openAssignTaskModal = (task) => { 
    setTaskToAssign(task); 
    setIsAssignTaskModalOpen(true); 
    setError(''); 
  };
  
  const closeAssignTaskModal = () => { 
    setTaskToAssign(null); 
    setIsAssignTaskModalOpen(false); 
  };
  
  const openEditTaskModal = (task) => { 
    setEditingTask(task); 
    setIsEditTaskModalOpen(true); 
    setError(''); 
  };
  
  const closeEditTaskModal = () => { 
    setEditingTask(null); 
    setIsEditTaskModalOpen(false); 
  };

  const handleCreateTask = async (taskData) => {
    if (!user || !profile?.organization_id) throw new Error("User/Org info missing.");
    setIsSubmittingTask(true); setError('');
    try {
      const taskToInsert = { ...taskData, organization_id: profile.organization_id, created_by_user_id: user.id };
      const { data: newTask, error: insertError } = await supabase.from('tasks').insert([taskToInsert]).select().single();
      if (insertError) throw insertError;
      fetchPageData(); 
      toggleCreateTaskModal(); alert(`Task "${newTask.title}" created!`);
    } catch (err) { setError(err.message); throw err; }
    finally { setIsSubmittingTask(false); }
  };

  const handleAssignTask = async (selectedMusicianIds, linkedEventId = null) => {
    if (!taskToAssign) throw new Error("Task missing.");
    setIsAssigningTask(true); setError('');
    try {
        const { data: existingAssignments, error: fetchError } = await supabase.from('task_assignments').select('id, assigned_to_user_id').eq('task_id', taskToAssign.id);
        if (fetchError) throw fetchError;

        const existingIds = existingAssignments.map(a => a.assigned_to_user_id);
        const toAdd = selectedMusicianIds.filter(id => !existingIds.includes(id));
        const toRemove = existingIds.filter(id => !selectedMusicianIds.includes(id));
        
        if (toRemove.length > 0) {
            const { error: deleteError } = await supabase.from('task_assignments').delete().eq('task_id', taskToAssign.id).in('assigned_to_user_id', toRemove);
            if (deleteError) throw deleteError;
        }

        if (toAdd.length > 0) {
             const assignments = toAdd.map(id => ({ task_id: taskToAssign.id, assigned_to_user_id: id, status: 'PENDING' }));
            const { error: insertError } = await supabase.from('task_assignments').insert(assignments);
            if (insertError) throw insertError;
        }
        
        if (taskToAssign.type === 'REHEARSAL_POLL' && linkedEventId) {
             const updatedConfig = { ...taskToAssign.task_config, linked_event_id: linkedEventId };
             const { error: configError } = await supabase.from('tasks').update({ task_config: updatedConfig }).eq('id', taskToAssign.id);
             if (configError) throw configError;
        }

        alert(`Task assignments updated for "${taskToAssign.title}".`);
        closeAssignTaskModal(); fetchPageData(); 
    } catch (err) { console.error("Assign Task Error:", err); setError(err.message); } 
    finally { setIsAssigningTask(false); }
  };

  const handleUpdateTask = async (updatedFormData) => {
    if (!editingTask?.id) throw new Error("Task ID missing for update.");
    setIsUpdatingTask(true); setError('');
    try {
      const payload = { title: updatedFormData.title, due_date: updatedFormData.due_date, task_config: updatedFormData.task_config };
      const { data: updatedTask, error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id).select().single();
      if (error) throw error;
      alert(`Task "${updatedTask.title}" updated!`); fetchPageData(); closeEditTaskModal();
    } catch (err) { setError(err.message); throw err; }
    finally { setIsUpdatingTask(false); }
  };

  const handleToggleTaskActiveStatus = async (taskId, taskTitle, currentIsActive) => {
    const newActive = !currentIsActive;
    if (!window.confirm(`Are you sure you want to ${newActive ? "activate" : "deactivate"} the task "${taskTitle}"?`)) return;
    setActionInProgress(true); setError('');
    try {
      const { error } = await supabase.from('tasks').update({ is_active: newActive }).eq('id', taskId);
      if (error) throw error;
      fetchPageData(); alert(`Task has been ${newActive ? "activated" : "deactivated"}.`);
    } catch (err) { setError(err.message); }
    finally { setActionInProgress(false); }
  };
  
  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE "${taskTitle}"? This cannot be undone.`)) return;
    setActionInProgress(true); setError('');
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      setCreatedTasks(prev => prev.filter(t => t.id !== taskId)); alert(`Task "${taskTitle}" has been deleted.`);
    } catch (err) { setError(err.message); }
    finally { setActionInProgress(false); }
  };

  const isMusicianTaskOpen = (assignment) => {
    if (!assignment || !assignment.task) return false;
    return assignment.task.is_active && (!assignment.task.due_date || new Date() <= new Date(assignment.task.due_date + 'T23:59:59.999'));
  };

  // --- RENDER ---
  if (authIsLoading) return <div className="tasks-page-wrapper"><p className="empty-state-message">Loading user data...</p></div>;
  if (!profile) return <div className="tasks-page-wrapper"><p className="page-level-error">User profile not available.</p></div>;

  return (
    <div className="tasks-page-wrapper">
      <div className="tasks-container">
        
        <div className="tasks-header">
          <h1>{profile.role === 'ORGANIZER' ? "Task Manager" : "Your Tasks"}</h1>
          {profile.role === 'ORGANIZER' && (
            <button 
              onClick={toggleCreateTaskModal} 
              className="create-new-task-btn" 
              disabled={actionInProgress || isSubmittingTask}
            >
              Create Task
            </button>
          )}
        </div>

        {error && <p className="page-level-error">{error}</p>}

        {/* ORGANIZER VIEW */}
        {profile.role === 'ORGANIZER' && (
          <div className="organizer-tasks-view">
            {isLoadingTasks && <p className="empty-state-message">Loading tasks...</p>}
            
            {!isLoadingTasks && createdTasks.length === 0 && !error && (
              <div className="empty-state-message">You haven't created any tasks yet.</div>
            )}
            
            {!isLoadingTasks && createdTasks.length > 0 && (
              <ul className="tasks-list">
                {createdTasks.map(task => (
                  <li key={task.id} className={`task-item-card ${!task.is_active ? 'task-inactive' : ''}`}>
                    <div className="task-info">
                      <h3>
                        {task.title} 
                        {!task.is_active && <span className="inactive-chip">Inactive</span>}
                      </h3>
                      <div className="task-meta">
                        <span className="task-type">{formatTaskType(task.type)}</span>
                        {task.due_date && <span>Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString()}</span>}
                      </div>
                    </div>
                    
                    <div className="task-actions">
                      <Link to={`/task-results/${task.id}`} className="view-results-btn">Results</Link>
                      
                      {/* ASSIGN BUTTON */}
                      <button onClick={() => openAssignTaskModal(task)} className="item-action-btn assign-btn" title="Assign" disabled={actionInProgress || !task.is_active}>
                        <FaUserPlus />
                      </button>
                      
                      {/* ACTIVATE/DEACTIVATE */}
                      <button onClick={() => handleToggleTaskActiveStatus(task.id, task.title, task.is_active)} className={`item-action-btn ${task.is_active ? 'lock-btn' : 'unlock-btn'}`} title={task.is_active ? 'Deactivate' : 'Activate'} disabled={actionInProgress}>
                        {task.is_active ? <FaUnlock /> : <FaLock />}
                      </button>
                      
                      {/* EDIT BUTTON */}
                      <button onClick={() => openEditTaskModal(task)} className="item-action-btn edit-btn" title="Edit" disabled={actionInProgress}>
                        <FaPencilAlt />
                      </button>
                      
                      {/* DELETE BUTTON */}
                      <button onClick={() => handleDeleteTask(task.id, task.title)} className="item-action-btn delete-btn" title="Delete" disabled={actionInProgress}>
                        <FaTrashAlt />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* MUSICIAN VIEW */}
        {profile.role === 'MUSICIAN' && (
          <div className="musician-tasks-view">
            {isLoadingTasks && <p className="empty-state-message">Loading your tasks...</p>}
            
            {!isLoadingTasks && musicianTasks.length === 0 && !error && (
              <div className="empty-state-message">You have no pending tasks. Great job!</div>
            )}
            
            {!isLoadingTasks && musicianTasks.length > 0 && (
              <ul className="tasks-list">
                {musicianTasks.map(assignment => {
                  if (!assignment.task) return null;
                  const isOpen = isMusicianTaskOpen(assignment);
                  return (
                    <li key={assignment.id} className={`task-item-card ${!assignment.task.is_active || !isOpen ? 'task-inactive' : ''}`}>
                      <div className="task-info">
                        <h3>{assignment.task.title}</h3>
                        <div className="task-meta">
                          <span className="task-type">{formatTaskType(assignment.task.type)}</span>
                          {assignment.task.due_date && <span>Due: {new Date(assignment.task.due_date + 'T00:00:00').toLocaleDateString()}</span>}
                        </div>
                      </div>
                      
                      <div className="task-status-and-action">
                          <span className={`status-badge-task status-${assignment.status === 'PENDING' ? 'incomplete' : 'complete'}`}>
                            {assignment.status}
                          </span>
                          <Link to={`/task/${assignment.id}`} className="task-action-btn">
                            {isOpen ? 'View Task' : 'View Details'}
                          </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* MODALS */}
        {isCreateTaskModalOpen && (
          <div className="modal-overlay" onClick={toggleCreateTaskModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={toggleCreateTaskModal}>&times;</button>
              <CreateTaskForm onCreateTask={handleCreateTask} onCancel={toggleCreateTaskModal} isSubmitting={isSubmittingTask} upcomingOrgEvents={upcomingOrgEvents} />
            </div>
          </div>
        )}
        
        {isAssignTaskModalOpen && taskToAssign && (
          <div className="modal-overlay" onClick={closeAssignTaskModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={closeAssignTaskModal}>&times;</button>
              <AssignTaskForm task={taskToAssign} organizationMusicians={organizationMusicians} upcomingOrgEvents={upcomingOrgEvents} onAssignTask={handleAssignTask} onCancel={closeAssignTaskModal} isSubmitting={isAssigningTask} />
            </div>
          </div>
        )}
        
        {isEditTaskModalOpen && editingTask && (
          <div className="modal-overlay" onClick={closeEditTaskModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={closeEditTaskModal}>&times;</button>
              <EditTaskForm taskToEdit={editingTask} onUpdateTask={handleUpdateTask} onCancel={closeEditTaskModal} isSubmitting={isUpdatingTask} upcomingOrgEvents={upcomingOrgEvents} />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default TasksPage;