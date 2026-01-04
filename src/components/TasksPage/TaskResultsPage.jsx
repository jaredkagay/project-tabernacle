// src/components/TasksPage/TaskResultsPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import './TaskResultsPage.css';
import { DAYS_OF_WEEK } from '../../constants';
import { FaArrowLeft, FaChartBar, FaUsers, FaCalendarCheck, FaCheckDouble, FaStar } from 'react-icons/fa';

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

// Helper to group raw slots into readable ranges (e.g., "Mon: 5:00 PM - 6:00 PM")
const summarizeSlots = (selectedSlots, intervalMinutes = 30) => {
    if (!selectedSlots?.length) return {};
    const slotsByDay = {};
    selectedSlots.forEach(slot => {
        let d, t;
        if (typeof slot === 'string') {
            [d, t] = slot.split('-');
        } else {
            d = slot.day; t = slot.time;
        }
        
        if (!slotsByDay[d]) slotsByDay[d] = [];
        const [h, m] = t.split(':').map(Number);
        slotsByDay[d].push(h * 60 + m);
    });

    const summary = {};
    const fmt = (tm) => `${(Math.floor(tm/60)%12||12)}${tm%60===0?'':':'+String(tm%60).padStart(2,'0')}${Math.floor(tm/60)>=12?'PM':'AM'}`;

    for (const day in slotsByDay) {
        const mins = slotsByDay[day].sort((a,b)=>a-b);
        summary[day] = [];
        let s = mins[0], e = mins[0];
        for(let i=1; i<mins.length; i++){
            if(mins[i] === e + intervalMinutes) e = mins[i];
            else { 
                summary[day].push(`${fmt(s)} - ${fmt(e + intervalMinutes)}`); 
                s=mins[i]; e=mins[i]; 
            }
        }
        summary[day].push(`${fmt(s)} - ${fmt(e + intervalMinutes)}`);
    }
    return summary;
};

const renderIndividualResponseData = (data, type, taskConfig, eventDetails) => {
    if (!data) return <span className="no-response">Pending...</span>;
    
    if (type === 'ACKNOWLEDGEMENT') {
        return (
            <span className="response-ack">
                <FaCheckDouble /> Acknowledged {data.acknowledged_at ? new Date(data.acknowledged_at).toLocaleDateString() : ''}
            </span>
        );
    }

    if (type === 'EVENT_AVAILABILITY') {
        const entries = Object.entries(data.availabilities || {});
        if (entries.length === 0) return <span className="no-response">No selections</span>;
        return (
            <div className="response-detail-list">
                {entries.map(([eid, status]) => {
                    const evt = eventDetails.find(e => e.id === eid);
                    const label = evt ? evt.title : 'Event';
                    const statusClass = status === 'YES' ? 'avail-yes' : status === 'NO' ? 'avail-no' : 'avail-maybe';
                    return (
                        <div key={eid} className="response-row">
                            <span className="response-label">{label}:</span> 
                            <span className={statusClass}>{status === 'YES' ? 'Available' : status === 'NO' ? 'Unavailable' : 'Maybe'}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    if (type === 'REHEARSAL_POLL') {
        const slots = data.selected_slots || [];
        if (slots.length === 0) return <span className="no-response">Unavailable</span>;
        
        const summary = summarizeSlots(slots, taskConfig?.interval_minutes || 30);
        return (
            <div className="response-detail-list">
                {Object.entries(summary).map(([day, ranges]) => (
                    <div key={day} className="response-row">
                        <span className="response-label">{day}:</span>
                        <span>{ranges.join(', ')}</span>
                    </div>
                ))}
            </div>
        );
    }
    return <pre style={{fontSize:'0.8em'}}>{JSON.stringify(data)}</pre>;
};

const TaskResultsPage = () => {
  const { taskId } = useParams();
  const { user } = useAuth();
  
  const [task, setTask] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [eventDetailsForTask, setEventDetailsForTask] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Aggregation States
  const [pollGrid, setPollGrid] = useState({ times: [], days: [], counts: {} });
  const [eventBreakdown, setEventBreakdown] = useState({});

  const fetchData = useCallback(async () => {
    if (!taskId || !user) return;
    setLoading(true); setError('');
    try {
        // 1. Fetch Task
        const { data: taskData, error: taskError } = await supabase.from('tasks').select('*').eq('id', taskId).single();
        if (taskError) throw taskError;
        setTask(taskData);

        // 2. Fetch Assignments
        const { data: assignData, error: assignError } = await supabase
            .from('task_assignments')
            .select(`*, assignee:profiles!assigned_to_user_id(first_name, last_name)`)
            .eq('task_id', taskId);
        if (assignError) throw assignError;
        setAssignments(assignData || []);

        // 3. Process Event Availability
        if (taskData.type === 'EVENT_AVAILABILITY' && taskData.task_config?.event_ids?.length) {
            const { data: evts } = await supabase.from('events').select('id, title, date').in('id', taskData.task_config.event_ids).order('date');
            setEventDetailsForTask(evts || []);
            
            const breakdown = {};
            (evts || []).forEach(e => { breakdown[e.id] = { YES: [], NO: [], MAYBE: [] }; });
            
            (assignData || []).forEach(a => {
                const name = `${a.assignee?.first_name || 'Unknown'} ${a.assignee?.last_name || ''}`.trim();
                if(a.response_data?.availabilities) {
                    Object.entries(a.response_data.availabilities).forEach(([eid, status]) => {
                        if(breakdown[eid] && breakdown[eid][status]) {
                            breakdown[eid][status].push(name);
                        }
                    });
                }
            });
            setEventBreakdown(breakdown);
        }

        // 4. Process Rehearsal Poll
        if (taskData.type === 'REHEARSAL_POLL' && taskData.task_config) {
            const { days, time_start, time_end, interval_minutes } = taskData.task_config;
            const times = generateTimeSlots(time_start, time_end, interval_minutes);
            
            const counts = {}; 
            (assignData || []).forEach(a => {
                if (a.response_data?.selected_slots) {
                    a.response_data.selected_slots.forEach(slot => {
                        const key = typeof slot === 'string' ? slot : `${slot.day}-${slot.time}`;
                        counts[key] = (counts[key] || 0) + 1;
                    });
                }
            });
            
            setPollGrid({ 
                times, 
                days: days.sort((a,b) => DAYS_OF_WEEK.indexOf(a) - DAYS_OF_WEEK.indexOf(b)), 
                counts 
            });
        }

    } catch (err) { setError(err.message); } 
    finally { setLoading(false); }
  }, [taskId, user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- DERIVED STATE: Perfect Matches (All assigned musicians are available) ---
  const perfectMatchSummary = useMemo(() => {
    if (!task || task.type !== 'REHEARSAL_POLL' || assignments.length === 0) return {};
    
    const perfectMatchSlots = [];
    Object.entries(pollGrid.counts).forEach(([key, count]) => {
        if (count === assignments.length) {
            perfectMatchSlots.push(key);
        }
    });
    
    return summarizeSlots(perfectMatchSlots, task.task_config?.interval_minutes || 30);
  }, [task, pollGrid, assignments]);


  if (loading) return <div className="task-results-wrapper"><div className="task-results-card">Loading results...</div></div>;
  if (!task) return <div className="task-results-wrapper"><div className="task-results-card page-error">Task not found.</div></div>;

  return (
    <div className="task-results-wrapper">
      <div className="task-results-card">
        
        <Link to="/tasks" className="back-btn"><FaArrowLeft /> Back to Tasks</Link>

        <header className="results-header">
            <h1>{task.title}</h1>
            <div className="results-subtitle">Results & Responses</div>
        </header>

        {error && <div className="page-error">{error}</div>}

        {/* --- ACKNOWLEDGEMENT BLURB --- */}
        {task.type === 'ACKNOWLEDGEMENT' && task.task_config?.body_text && (
            <div className="special-result-box">
                <h4>Acknowledgement:</h4>
                <div className="acknowledgement-text-content">
                    {task.task_config.body_text}
                </div>
            </div>
        )}

        {/* --- REHEARSAL POLL: PERFECT MATCH SUMMARY --- */}
        {task.type === 'REHEARSAL_POLL' && Object.keys(perfectMatchSummary).length > 0 && (
            <div className="special-result-box perfect-match">
                 <h4><FaStar className="gold-star-icon" /> Suggested Times:</h4>
                 <div className="response-detail-list">
                     {Object.entries(perfectMatchSummary).map(([day, ranges]) => (
                        <div key={day} className="response-row">
                            <span className="response-label">{day}:</span>
                            <span>{ranges.join(', ')}</span>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* --- EVENT AVAILABILITY BREAKDOWN --- */}
        {task.type === 'EVENT_AVAILABILITY' && eventDetailsForTask.length > 0 && (
            <div className="aggregation-section">
                <h3 className="section-title"><FaCalendarCheck /> Availability Breakdown</h3>
                
                {eventDetailsForTask.map(evt => {
                    const data = eventBreakdown[evt.id] || { YES: [], NO: [], MAYBE: [] };
                    return (
                        <div key={evt.id} className="event-detail-card">
                            <div className="event-detail-header">
                                <h4>{evt.title}</h4>
                                <div className="event-detail-date">{new Date(evt.date).toLocaleDateString()}</div>
                            </div>
                            <div className="event-detail-body">
                                <div className="response-group group-yes">
                                    <h5>Available <span className="count-bubble">{data.YES.length}</span></h5>
                                    {data.YES.length > 0 ? (
                                        <ul className="person-list">{data.YES.map((name, i) => <li key={i}>{name}</li>)}</ul>
                                    ) : <span className="empty-list-text">None</span>}
                                </div>
                                <div className="response-group group-no">
                                    <h5>Unavailable <span className="count-bubble">{data.NO.length}</span></h5>
                                    {data.NO.length > 0 ? (
                                        <ul className="person-list">{data.NO.map((name, i) => <li key={i}>{name}</li>)}</ul>
                                    ) : <span className="empty-list-text">None</span>}
                                </div>
                                <div className="response-group group-maybe">
                                    <h5>Maybe <span className="count-bubble">{data.MAYBE.length}</span></h5>
                                    {data.MAYBE.length > 0 ? (
                                        <ul className="person-list">{data.MAYBE.map((name, i) => <li key={i}>{name}</li>)}</ul>
                                    ) : <span className="empty-list-text">None</span>}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}

        {/* --- REHEARSAL POLL HEATMAP --- */}
        {task.type === 'REHEARSAL_POLL' && pollGrid.times.length > 0 && (
            <div className="aggregation-section">
                <h3 className="section-title"><FaChartBar /> Availability Heatmap</h3>
                <p className="section-help-text">
                    Numbers indicate how many musicians are available.
                </p>
                <div className="summary-grid-container">
                    <table className="summary-table">
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
                                        const count = pollGrid.counts[`${d}-${t}`] || 0;
                                        const isAllAvailable = assignments.length > 0 && count === assignments.length;
                                        
                                        return (
                                            <td key={d}>
                                                <span className={`slot-count ${count === 0 ? 'zero' : ''} ${isAllAvailable ? 'all-avail-badge' : ''}`}>
                                                    {count} {isAllAvailable && <FaStar style={{fontSize:'0.6rem', marginLeft:'2px'}} />}
                                                </span>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        )}

        {/* --- INDIVIDUAL RESPONSES TABLE --- */}
        <div className="individual-section">
            <h3 className="section-title"><FaUsers /> Individual Responses</h3>
            
            {assignments.length === 0 ? (
                <div className="empty-state">No users assigned to this task yet.</div>
            ) : (
                <div className="results-table-container">
                    <table className="results-table">
                        <thead>
                            <tr>
                                <th style={{width: '25%'}}>Musician</th>
                                <th style={{width: '15%'}}>Status</th>
                                <th>Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {assignments.map(a => (
                                <tr key={a.id}>
                                    <td style={{fontWeight:'600'}}>{a.assignee?.first_name} {a.assignee?.last_name}</td>
                                    <td>
                                        <span className={`status-pill status-${a.status.toLowerCase()}`}>
                                            {a.status}
                                        </span>
                                    </td>
                                    <td>
                                        {a.status === 'COMPLETED' 
                                            ? renderIndividualResponseData(a.response_data, task.type, task.task_config, eventDetailsForTask)
                                            : <span className="no-response">-</span>
                                        }
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>

      </div>
    </div>
  );
};

export default TaskResultsPage;