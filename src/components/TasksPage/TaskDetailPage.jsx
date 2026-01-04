// src/components/TasksPage/TaskDetailPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import './TaskDetailPage.css';
import { DAYS_OF_WEEK } from '../../constants';
import { logActivity } from '../../utils/activityLogger';

const formatTaskType = (type) => {
  if (!type) return '';
  return type.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    return `${h % 12 || 12}:${minutes} ${h >= 12 ? 'PM' : 'AM'}`;
};

const generateTimeSlots = (start, end, interval) => {
    const slots = [];
    if (!start || !end || !interval) return slots;
    let [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    let cur = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    while (cur < endMin) {
        slots.push(`${String(Math.floor(cur/60)).padStart(2,'0')}:${String(cur%60).padStart(2,'0')}`);
        cur += interval;
    }
    return slots;
};

// ... Helper functions summarizeSlots and renderSubmittedResponseData ...
const summarizeSlots = (selectedSlots, intervalMinutes = 30) => {
    if (!selectedSlots?.length) return {};
    const slotsByDay = {};
    selectedSlots.forEach(slot => {
        // Handle potential string vs object mismatch for resilience
        let d, t;
        if (typeof slot === 'string') { [d, t] = slot.split('-'); }
        else { d = slot.day; t = slot.time; }
        
        if (!slotsByDay[d]) slotsByDay[d] = [];
        const [h, m] = t.split(':').map(Number);
        slotsByDay[d].push(h * 60 + m);
    });
    const summary = {};
    for (const day in slotsByDay) {
        const mins = slotsByDay[day].sort((a,b)=>a-b);
        summary[day] = [];
        let s = mins[0], e = mins[0];
        for(let i=1; i<mins.length; i++){
            if(mins[i] === e + intervalMinutes) e = mins[i];
            else { summary[day].push({s, e: e+intervalMinutes}); s=mins[i]; e=mins[i]; }
        }
        summary[day].push({s, e: e+intervalMinutes});
    }
    const fmt = (tm) => `${(Math.floor(tm/60)%12||12)}${tm%60===0?'':':'+String(tm%60).padStart(2,'0')}${Math.floor(tm/60)>=12?'PM':'AM'}`;
    const ret = {};
    for(const d in summary) ret[d] = summary[d].map(r => `${fmt(r.s)} - ${fmt(r.e)}`);
    return ret;
};

const renderSubmittedResponseData = (responseData, taskType, taskConfig, eventDetails) => {
  if (!responseData) return <p className="no-response-display"><em>No response was recorded.</em></p>;
  if (taskType === 'ACKNOWLEDGEMENT') {
    return <p>You acknowledged this on: {responseData.acknowledged_at ? new Date(responseData.acknowledged_at).toLocaleString() : 'N/A'}</p>;
  }
  if (taskType === 'EVENT_AVAILABILITY') {
      const ids = taskConfig?.event_ids || Object.keys(responseData.availabilities || {});
      return (
        <div className="submitted-response-details">
          <h4>Availability:</h4>
          <ul className="availability-response-list view-only">
            {ids.map(id => {
               const ans = responseData.availabilities?.[id];
               const evt = eventDetails?.find(e => e.id === id);
               return <li key={id}><strong>{evt?.title || 'Event'}</strong>: {ans === 'YES' ? 'Available' : ans === 'NO' ? 'Unavailable' : 'Maybe'}</li>;
            })}
          </ul>
        </div>
      );
  }
  if (taskType === 'REHEARSAL_POLL' && responseData.selected_slots) {
      const sum = summarizeSlots(responseData.selected_slots, taskConfig?.interval_minutes || 30);
      return (
        <div className="submitted-response-details">
            {Object.entries(sum).map(([d, times]) => (
                <div key={d}><strong>{d}:</strong> {times.join(', ')}</div>
            ))}
        </div>
      );
  }
  return <pre>{JSON.stringify(responseData, null, 2)}</pre>;
};

const TaskDetailPage = () => {
  const { assignmentId } = useParams();
  const { user, profile, loading: authIsLoading } = useAuth();
  
  const [assignment, setAssignment] = useState(null);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCompletingOrEditing, setIsCompletingOrEditing] = useState(false);

  const [eventDetailsForTask, setEventDetailsForTask] = useState([]);
  const [availabilityResponses, setAvailabilityResponses] = useState({});
  const [allPossibleRehearsalSlots, setAllPossibleRehearsalSlots] = useState([]);
  const [selectedRehearsalSlots, setSelectedRehearsalSlots] = useState([]);
  const [isEditingResponse, setIsEditingResponse] = useState(false);
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartInfo, setDragStartInfo] = useState(null);
  const [slotsToUpdate, setSlotsToUpdate] = useState(new Set());

  const fetchTaskAssignmentDetails = useCallback(async () => {
    if (!assignmentId || !user?.id) return;
    setLoading(true); setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('task_assignments')
        .select(`id, status, response_data, assigned_to_user_id, task:tasks!inner ( id, title, type, task_config, due_date, is_active )`)
        .eq('id', assignmentId)
        .eq('assigned_to_user_id', user.id)
        .single();

      if (fetchError || !data) throw new Error("Task assignment not found.");
      setAssignment(data); setTask(data.task);

      if (data.response_data) {
        if (data.task.type === 'EVENT_AVAILABILITY') setAvailabilityResponses(data.response_data.availabilities || {});
        if (data.task.type === 'REHEARSAL_POLL') setSelectedRehearsalSlots((data.response_data.selected_slots || []).map(s => typeof s==='string'?s:`${s.day}-${s.time}`));
      }

      if (data.task.type === 'EVENT_AVAILABILITY' && data.task.task_config?.event_ids?.length) {
        const { data: evts } = await supabase.from('events').select('id, title, date, time').in('id', data.task.task_config.event_ids).order('date');
        setEventDetailsForTask(evts || []);
        if (!data.response_data?.availabilities) {
             const init = {}; (evts||[]).forEach(e => init[e.id] = ''); setAvailabilityResponses(init);
        }
      }

      if (data.task.type === 'REHEARSAL_POLL' && data.task.task_config) {
        const { days, time_start, time_end, interval_minutes } = data.task.task_config;
        if (days && time_start) {
            const times = generateTimeSlots(time_start, time_end, interval_minutes);
            const slots = [];
            days.forEach(d => times.forEach(t => slots.push({ day: d, time: t, id: `${d}-${t}` })));
            setAllPossibleRehearsalSlots(slots);
            // Default select all if no response yet
            if (!data.response_data?.selected_slots) setSelectedRehearsalSlots(slots.map(s => s.id));
        }
      }
    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  }, [assignmentId, user?.id]);

  useEffect(() => { if (!authIsLoading) fetchTaskAssignmentDetails(); }, [authIsLoading, assignmentId, fetchTaskAssignmentDetails]);

  const handleSlotSelection = (slotId, selectMode) => {
    setSelectedRehearsalSlots(prev => selectMode ? [...new Set([...prev, slotId])] : prev.filter(id => id !== slotId));
  };
  
  const handleMouseDownOnSlot = (slot) => {
      if (!slot || isCompletingOrEditing) return;
      setIsDragging(true);
      setDragStartInfo({ id: slot.id, initiallySelected: slot.selected });
      setSlotsToUpdate(new Set([slot.id]));
      document.body.style.userSelect = 'none';
  };
  const handleMouseEnterSlot = (slot) => { if (isDragging && slot) setSlotsToUpdate(prev => new Set(prev).add(slot.id)); };
  const handleMouseUpGlobal = useCallback(() => {
      if (!isDragging || !dragStartInfo) return;
      const selectMode = !dragStartInfo.initiallySelected;
      slotsToUpdate.forEach(id => handleSlotSelection(id, selectMode));
      setIsDragging(false); setDragStartInfo(null); setSlotsToUpdate(new Set());
      document.body.style.userSelect = '';
  }, [isDragging, dragStartInfo, slotsToUpdate]);

  useEffect(() => { window.addEventListener('mouseup', handleMouseUpGlobal); return () => { window.removeEventListener('mouseup', handleMouseUpGlobal); document.body.style.userSelect = ''; }; }, [handleMouseUpGlobal]);

  const completeTaskAssignment = async (responsePayload, taskTitle) => {
    setIsCompletingOrEditing(true);
    try {
        await supabase.from('task_assignments').update({ status: 'COMPLETED', completed_at: new Date().toISOString(), response_data: responsePayload }).eq('id', assignment.id);
        alert(`Response submitted!`);
        logActivity(user, profile, 'TASK_COMPLETED', `${profile.first_name} completed: ${taskTitle}`);
        setIsEditingResponse(false);
        fetchTaskAssignmentDetails();
    } catch (e) { alert(e.message); } finally { setIsCompletingOrEditing(false); }
  };

  const isTaskOpen = useMemo(() => task && task.is_active && (!task.due_date || new Date() <= new Date(task.due_date + 'T23:59:59')), [task]);
  const pollGrid = useMemo(() => {
    if (task?.type !== 'REHEARSAL_POLL' || !allPossibleRehearsalSlots.length) return { times: [], days: [], slots: {} };
    const { days, time_start, time_end, interval_minutes } = task.task_config;
    const times = generateTimeSlots(time_start, time_end, interval_minutes);
    const slots = {};
    times.forEach(t => { slots[t] = {}; days.forEach(d => { const id = `${d}-${t}`; slots[t][d] = { id, selected: selectedRehearsalSlots.includes(id) }; }); });
    return { times, days: days.sort((a,b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)), slots };
  }, [task, allPossibleRehearsalSlots, selectedRehearsalSlots]);

  if (authIsLoading || loading) return <div className="task-detail-wrapper"><p style={{color:'white', textAlign:'center'}}>Loading...</p></div>;
  if (error || !assignment) return <div className="task-detail-wrapper"><p className="page-level-error">{error || "Task not found"}</p></div>;

  const showForm = isTaskOpen && (assignment.status === 'PENDING' || isEditingResponse);

  return (
    <div className="task-detail-wrapper">
      <div className="task-detail-card">
        
        <Link to="/tasks" className="back-to-tasks-btn">&larr; Back to My Tasks</Link>

        <header className="task-detail-header">
          <h1>{task.title}</h1>
          <div className="task-detail-meta">
             <div className="meta-item">
                 <span className="meta-label">Type</span>
                 <span className="meta-value">{formatTaskType(task.type)}</span>
             </div>
             {task.due_date && (
                 <div className="meta-item">
                     <span className="meta-label">Due Date</span>
                     <span className="meta-value">
                        {new Date(task.due_date).toLocaleDateString()}
                        {!isTaskOpen && <span className="chip-status past-due" style={{marginLeft:'8px'}}>Closed</span>}
                     </span>
                 </div>
             )}
          </div>
        </header>

        <div className="task-completion-area">
          
          {assignment.status === 'COMPLETED' && !isEditingResponse && (
            <div className="task-already-completed">
              <h3>Task Completed</h3>
              <p>Submitted on: {new Date(assignment.completed_at).toLocaleString()}</p>
              {renderSubmittedResponseData(assignment.response_data, task.type, task.task_config, eventDetailsForTask)}
              
              {isTaskOpen && (
                  <button onClick={() => setIsEditingResponse(true)} className="submit-btn edit-response-btn" style={{marginTop:'1rem'}}>
                      Edit Response
                  </button>
              )}
            </div>
          )}

          {assignment.status === 'PENDING' && !isTaskOpen && (
              <div className="task-closed-message">
                  <h3>Task Closed</h3>
                  <p>The deadline has passed or this task is no longer active.</p>
              </div>
          )}

          {showForm && (
            <>
               {task.type === 'ACKNOWLEDGEMENT' && (
                 <div className="glass-form">
                    <h3>Please Acknowledge:</h3>
                    <div className="acknowledgement-text-box">
                        {task.task_config?.body_text?.split('\n').map((p,i)=><p key={i}>{p}</p>)}
                    </div>
                    <button onClick={() => { if(window.confirm('Confirm?')) completeTaskAssignment({ acknowledged: true, acknowledged_at: new Date() }, task.title)}} className="complete-task-btn" disabled={isCompletingOrEditing}>
                        {isCompletingOrEditing ? 'Submitting...' : 'I Acknowledge'}
                    </button>
                    {isEditingResponse && <button onClick={()=>setIsEditingResponse(false)} className="cancel-btn">Cancel</button>}
                 </div>
               )}

               {task.type === 'EVENT_AVAILABILITY' && (
                 <div className="glass-form">
                    <h3>Indicate Availability</h3>
                    {eventDetailsForTask.map(evt => (
                        <div key={evt.id} className="event-availability-item">
                            <h4>{evt.title} — {new Date(evt.date).toLocaleDateString()} {evt.time}</h4>
                            <div className="availability-options">
                                {['YES', 'NO', 'MAYBE'].map(opt => (
                                    <label key={opt} className="radio-label">
                                        <input type="radio" name={evt.id} checked={availabilityResponses[evt.id]===opt} onChange={()=>setAvailabilityResponses(prev=>({...prev, [evt.id]:opt}))} />
                                        {opt === 'YES' ? 'Available' : opt === 'NO' ? 'Unavailable' : 'Maybe'}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ))}
                    <button onClick={() => completeTaskAssignment({ availabilities: availabilityResponses }, task.title)} className="complete-task-btn" disabled={isCompletingOrEditing}>
                        {isCompletingOrEditing ? 'Submitting...' : 'Submit Availability'}
                    </button>
                    {isEditingResponse && <button onClick={()=>setIsEditingResponse(false)} className="cancel-btn">Cancel</button>}
                 </div>
               )}

               {task.type === 'REHEARSAL_POLL' && (
                   <div className="glass-form">
                       <h3>Select Available Times</h3>
                       <p style={{marginBottom:'1rem', color:'#64748b'}}>
                         <div><strong>Legend:</strong></div>
                          <span style={{display:'inline-block', width:'12px', height:'12px', background:'#2ecc71', marginRight:'4px', borderRadius:'2px'}}></span> Green slots indicate you are <strong>available</strong>.<br/>
                           <span style={{display:'inline-block', width:'12px', height:'12px', background:'#ffffffff', marginRight:'4px', borderRadius:'2px'}}></span> White slots indicate you are <strong>unavailable</strong>.
                       </p>
                       <p style={{marginBottom:'1rem', color:'#64748b'}}>Click and drag to select/deselect multiple slots.</p>
                       <div className="rehearsal-poll-grid-container">
                           <table className="rehearsal-poll-grid">
                               <thead>
                                   <tr>
                                       <th>Time</th>
                                       {pollGrid.days.map(d => <th key={d}>{d.substring(0,3)}</th>)}
                                   </tr>
                               </thead>
                               <tbody>
                                   {pollGrid.times.map(t => (
                                       <tr key={t}>
                                           <td>{formatTime(t)}</td>
                                           {pollGrid.days.map(d => {
                                               const s = pollGrid.slots[t][d];
                                               const dragSelect = isDragging && dragStartInfo && !dragStartInfo.initiallySelected;
                                               const dragging = isDragging && slotsToUpdate.has(s.id);
                                               return (
                                                   <td 
                                                    key={s.id} 
                                                    className={`poll-slot ${s.selected?'selected':''} ${dragging ? (dragSelect ? 'dragging-to-select' : 'dragging-to-deselect') : ''}`}
                                                    onMouseDown={()=>handleMouseDownOnSlot(s)}
                                                    onMouseEnter={()=>handleMouseEnterSlot(s)}
                                                   />
                                               );
                                           })}
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                       <button onClick={() => completeTaskAssignment({ selected_slots: selectedRehearsalSlots.map(id=>{const [d,t]=id.split('-'); return {day:d, time:t}}) }, task.title)} className="complete-task-btn" disabled={isCompletingOrEditing}>
                            {isCompletingOrEditing ? 'Submitting...' : 'Submit Availability'}
                       </button>
                       {isEditingResponse && <button onClick={()=>setIsEditingResponse(false)} className="cancel-btn">Cancel</button>}
                   </div>
               )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TaskDetailPage;