// src/components/TasksPage/TasksPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Import Link for navigation
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import CreateTaskForm from './CreateTaskForm';
import AssignTaskForm from './AssignTaskForm';
import EditTaskForm from './EditTaskForm';
import './TasksPage.css';
// Ensure modal CSS is available (e.g., from PlanPage.css or a shared file)
import '../PlanPage/PlanPage.css';

const TasksPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();
  
  // For Organizers: tasks they've created
  const [createdTasks, setCreatedTasks] = useState([]); 
  // For Musicians: tasks assigned to them that are pending
  const [pendingTasks, setPendingTasks] = useState([]); 
  const [completedTasksForMusician, setCompletedTasksForMusician] = useState([]); 
  
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState('');

  // Create Task Modal
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Assign Task Modal
  const [isAssignTaskModalOpen, setIsAssignTaskModalOpen] = useState(false);
  const [taskToAssign, setTaskToAssign] = useState(null);
  const [organizationMusicians, setOrganizationMusicians] = useState([]);
  const [isAssigningTask, setIsAssigningTask] = useState(false);

  const [upcomingOrgEvents, setUpcomingOrgEvents] = useState([]); // <--- NEW STATE for events list

// --- NEW State for Edit Task Modal ---
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null); // Task object to pass to edit modal
  const [isUpdatingTask, setIsUpdatingTask] = useState(false); // For edit task action

  const [actionInProgress, setActionInProgress] = useState(false); // General loading state for task actions

  // Note: isCompletingTask state and handleCompleteAcknowledgementTask are removed from this file.
  // That logic will be in TaskDetailPage.jsx

  const fetchOrganizerData = useCallback(async () => {
    if (!profile || profile.role !== 'ORGANIZER' || !profile.organization_id || !user) {
        setIsLoadingTasks(false);
        setCreatedTasks([]); // Clear tasks if conditions not met
        setOrganizationMusicians([]);
        return;
    }
    
    setIsLoadingTasks(true);
    setError('');
    try {
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, type, description, due_date, created_at, is_active, task_config')
        .eq('organization_id', profile.organization_id)
        .order('created_at', { ascending: false });
      if (tasksError) throw tasksError;
      setCreatedTasks(tasksData || []);

      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .eq('organization_id', profile.organization_id)
        .eq('role', 'MUSICIAN');
      if (membersError) throw membersError;
      setOrganizationMusicians(membersData || []);

      // --- NEW: Fetch upcoming events for this organization ---
      const today = new Date().toISOString().split('T')[0];
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, date') // Select what's needed for the form
        .eq('organization_id', profile.organization_id)
        .gte('date', today) // Only upcoming or today's events
        .order('date', { ascending: true });
      if (eventsError) throw eventsError;
      setUpcomingOrgEvents(eventsData || []);
      // console.log("Fetched upcoming org events:", eventsData);

    } catch (err) {
      console.error("Error fetching organizer data (tasks/musicians):", err);
      setError(err.message || "Failed to fetch organizer data.");
      setCreatedTasks([]);
      setOrganizationMusicians([]);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [profile, user?.id]); // user.id ensures user context

  const fetchMusicianTasks = useCallback(async () => {
    if (!profile || profile.role !== 'MUSICIAN' || !user?.id) {
        setIsLoadingTasks(false);
        setPendingTasks([]); // Clear tasks
        return;
    }
    setIsLoadingTasks(true);
    setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('task_assignments')
        .select(`
          id, 
          status, 
          task:tasks!inner (
            id, 
            title, 
            type, 
            due_date 
          )
        `) // Only select fields needed for the list view
        .eq('assigned_to_user_id', user.id)
        .in('status', ['PENDING', 'COMPLETED']); // Fetch both PENDING and COMPLETED

      if (fetchError) throw fetchError;
      
      const allAssignments = data || [];
      setPendingTasks(allAssignments.filter(a => a.status === 'PENDING').sort((a,b) => new Date(a.task.due_date || 0) - new Date(b.task.due_date || 0) )); // Soonest due first
      setCompletedTasksForMusician(allAssignments.filter(a => a.status === 'COMPLETED').sort((a,b) => new Date(b.completed_at) - new Date(a.completed_at))); // Most recently completed first
      
    } catch (err) {
      console.error("Error fetching musician tasks:", err);
      setError(err.message || "Failed to fetch assigned tasks.");
      setPendingTasks([]);
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
      } else {
        setError("User role not defined or not supported for tasks.");
        setIsLoadingTasks(false);
      }
    } else if (!authIsLoading && !profile) {
        setError("User profile not available.");
        setIsLoadingTasks(false);
    }
  }, [authIsLoading, profile, user, fetchOrganizerData, fetchMusicianTasks]);

  const toggleCreateTaskModal = () => {
    setIsCreateTaskModalOpen(!isCreateTaskModalOpen);
    setError(''); 
  };

   const handleToggleTaskActiveStatus = async (taskId, taskTitle, currentIsActive) => {
    const newActiveState = !currentIsActive;
    const actionVerb = newActiveState ? "activate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${actionVerb} the task "${taskTitle}"? ${!newActiveState ? 'Deactivated tasks cannot be newly assigned.' : ''}`)) {
      return;
    }

    setActionInProgress(true);
    setError('');
    try {
      const { data: updatedTask, error } = await supabase
        .from('tasks')
        .update({ is_active: newActiveState })
        .eq('id', taskId)
        .select() // Select the updated task to get its new state
        .single();

      if (error) throw error;

      // Update local state
      setCreatedTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === taskId ? updatedTask : task
        ).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)) // Maintain sort order
      );
      alert(`Task "${taskTitle}" ${actionVerb}d successfully.`);

    } catch (err) {
      console.error(`Error ${actionVerb}ing task:`, err);
      setError(err.message || `Failed to ${actionVerb} task.`);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCreateTask = async (taskData) => {
    if (!user || !profile?.organization_id) {
      alert("User or organization information is missing.");
      throw new Error("User or organization information missing.");
    }
    setIsSubmittingTask(true);
    setError('');
    try {
      const taskToInsert = {
        ...taskData,
        organization_id: profile.organization_id,
        created_by_user_id: user.id,
      };
      const { data: newTask, error: insertError } = await supabase
        .from('tasks')
        .insert([taskToInsert])
        .select()
        .single();
      if (insertError) throw insertError;
      setCreatedTasks(prevTasks => [newTask, ...prevTasks].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
      toggleCreateTaskModal();
      alert(`Task "${newTask.title}" created successfully!`);
    } catch (err) {
      console.error("Error creating task:", err);
      setError(err.message || "Failed to create task.");
      throw err; 
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const openAssignTaskModal = (task) => {
    setTaskToAssign(task);
    setIsAssignTaskModalOpen(true);
    setError('');
  };
  const closeAssignTaskModal = () => {
    setTaskToAssign(null);
    setIsAssignTaskModalOpen(false);
  };

  const handleAssignTask = async (selectedMusicianIds) => {
    if (!taskToAssign || !selectedMusicianIds || selectedMusicianIds.length === 0) {
      alert("No task or musicians selected for assignment.");
      throw new Error("Task and musician selection required.");
    }
    if (!user) {
        alert("Authentication error."); throw new Error("Organizer not authenticated.");
    }
    setIsAssigningTask(true); setError('');
    const assignmentsToInsert = selectedMusicianIds.map(musicianId => ({
      task_id: taskToAssign.id,
      assigned_to_user_id: musicianId,
      status: 'PENDING',
    }));
    try {
      const { error: insertError } = await supabase.from('task_assignments').insert(assignmentsToInsert);
      if (insertError) {
        if (insertError.message.includes('unique constraint')) throw new Error("One or more selected musicians are already assigned this task.");
        throw insertError;
      }
      alert(`Task "${taskToAssign.title}" assigned to ${selectedMusicianIds.length} musician(s).`);
      closeAssignTaskModal();
      // fetchOrganizerData(); // Optional: Refresh task list if it shows assignment counts
    } catch (err) {
      console.error("Error assigning task:", err);
      setError(err.message || "Failed to assign task.");
      throw err;
    } finally {
      setIsAssigningTask(false);
    }
  };

  // --- Edit Task Modal Handlers ---
  const openEditTaskModal = (task) => {
    setEditingTask(task);
    setIsEditTaskModalOpen(true);
    setError(''); // Clear page-level errors
  };
  const closeEditTaskModal = () => {
    setEditingTask(null);
    setIsEditTaskModalOpen(false);
  };

  const handleUpdateTask = async (updatedTaskDataFromForm) => {
    if (!editingTask || !editingTask.id) {
      alert("No task selected for update or task ID is missing.");
      throw new Error("Task ID missing for update.");
    }
    setIsUpdatingTask(true);
    setError('');
    try {
      const payload = {
        title: updatedTaskDataFromForm.title,
        description: updatedTaskDataFromForm.description,
        due_date: updatedTaskDataFromForm.due_date,
        task_config: updatedTaskDataFromForm.task_config,
        // type, organization_id, created_by_user_id are not changed here
      };

      const { data: updatedTask, error: updateError } = await supabase
        .from('tasks')
        .update(payload)
        .eq('id', editingTask.id)
        .select()
        .single();

      if (updateError) throw updateError;

      alert(`Task "${updatedTask.title}" updated successfully!`);
      setCreatedTasks(prevTasks => 
        prevTasks.map(t => t.id === updatedTask.id ? updatedTask : t)
                 .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      );
      closeEditTaskModal();

    } catch (err) {
      console.error("Error updating task:", err);
      setError(err.message || "Failed to update task.");
      throw err; // Re-throw for form to handle its isSubmitting state
    } finally {
      setIsUpdatingTask(false);
    }
  };

  const handleDeleteTask = async (taskId, taskTitle) => {
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE the task "${taskTitle}"? All its assignments and responses will also be deleted. This action cannot be undone.`)) {
      return;
    }

    setActionInProgress(true);
    setError('');
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      setCreatedTasks(prevTasks => prevTasks.filter(task => task.id !== taskId));
      alert(`Task "${taskTitle}" deleted successfully.`);

    } catch (err) {
      console.error("Error deleting task:", err);
      setError(err.message || "Failed to delete task.");
    } finally {
      setActionInProgress(false);
    }
  };

  if (authIsLoading) { return <p className="page-status">Loading user data...</p>; }
  if (!profile) { return <p className="page-status">User profile not available. Please try again.</p>; }

return (
    <div className="tasks-page-container">
      <div className="tasks-header">
        <h1>{profile.role === 'ORGANIZER' ? "Manage Tasks" : "Your Assigned Tasks"}</h1>
        {profile.role === 'ORGANIZER' && (
          <button 
            onClick={toggleCreateTaskModal} 
            className="create-new-task-btn" 
            disabled={actionInProgress || isSubmittingTask || isAssigningTask} // Use relevant loading states
          >
            + Create New Task
          </button>
        )}
      </div>

      {error && <p className="form-error page-level-error">{error}</p>}

      {profile?.role === 'ORGANIZER' && (
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
                        {task.task_config.body_text.substring(0, 100)}
                        {task.task_config.body_text.length > 100 ? '...' : ''}
                        </p>
                    </div>
                  )}
                                    
                  <div className="task-actions">
                    <button 
                      onClick={() => openAssignTaskModal(task)} 
                      className="assign-task-btn action-btn-placeholder"
                      disabled={actionInProgress || !task.is_active} // Cannot assign inactive tasks
                    > Assign
                    </button>
                    <button // Assuming you have openEditTaskModal and its state
                      onClick={() => openEditTaskModal(task)} 
                      className="edit-task-btn action-btn-placeholder"
                      disabled={actionInProgress}
                    > Edit Task
                    </button>
                    <Link 
                      to={`/task-results/${task.id}`} 
                      className="view-results-btn action-btn-placeholder"
                      // Optionally disable if task is inactive and results aren't relevant
                    >View Results</Link>
                    <button
                      onClick={() => handleToggleTaskActiveStatus(task.id, task.title, task.is_active)}
                      className={`action-btn-placeholder ${task.is_active ? 'deactivate-btn' : 'activate-btn'}`}
                      disabled={actionInProgress}
                    >
                      {task.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task.id, task.title)}
                      className="delete-task-btn action-btn-placeholder"
                      disabled={actionInProgress}
                    >
                      Delete
                    </button>
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
            {!isLoadingTasks && pendingTasks.length === 0 && !error && (
              <p>You have no pending tasks. Great job!</p>
            )}
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
            {!isLoadingTasks && completedTasksForMusician.length === 0 && !error && (
              <p>You have not completed any tasks yet.</p>
            )}
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
            <CreateTaskForm 
              onCreateTask={handleCreateTask} 
              onCancel={toggleCreateTaskModal} 
              isSubmitting={isSubmittingTask} 
              upcomingOrgEvents={upcomingOrgEvents}
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

      {/* --- NEW: Edit Task Modal --- */}
      {isEditTaskModalOpen && editingTask && profile?.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={closeEditTaskModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeEditTaskModal}>&times;</button>
            <EditTaskForm
              taskToEdit={editingTask}
              onUpdateTask={handleUpdateTask}
              onCancel={closeEditTaskModal}
              isSubmitting={isUpdatingTask}
              // upcomingOrgEvents={upcomingOrgEvents} // Only pass if EditTaskForm needs it (e.g. for editing event_ids in availability task, which we deferred)
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;