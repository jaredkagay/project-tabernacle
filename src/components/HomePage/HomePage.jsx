// src/components/HomePage/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { FaExclamationCircle, FaBible, FaChevronRight } from 'react-icons/fa';
import './HomePage.css';

const HomePage = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [musicianRequests, setMusicianRequests] = useState([]);
  const [upcomingPlans, setUpcomingPlans] = useState([]); 
  const [incompleteTasks, setIncompleteTasks] = useState([]); 
  const [activeTasks, setActiveTasks] = useState([]); // Organizer view
  const [recentActivity, setRecentActivity] = useState([]); // Activity Feed
  
  // New State for Verse
  const [verseData, setVerseData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !profile || !profile.organization_id) return;
      setLoading(true);

      try {
        const today = new Date().toISOString().split('T')[0];

        // --- 1. VERSE OF THE WEEK ---
        const { data: nextOrgEvent } = await supabase
            .from('events')
            .select('id, title')
            .eq('organization_id', profile.organization_id)
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(1)
            .single();

        if (nextOrgEvent) {
            const { data: serviceItems } = await supabase
                .from('service_items')
                .select('bible_book, bible_chapter, bible_verse_range')
                .eq('event_id', nextOrgEvent.id)
                .not('bible_book', 'is', null)
                .limit(1);

            if (serviceItems && serviceItems.length > 0) {
                const item = serviceItems[0];
                const reference = `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`;
                try {
                    const res = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}`);
                    const json = await res.json();
                    if (json.text) {
                        setVerseData({
                            reference: json.reference || reference,
                            text: json.text,
                            eventTitle: nextOrgEvent.title
                        });
                    }
                } catch (apiErr) {
                    console.error("Bible API fetch failed", apiErr);
                    setVerseData({ reference, text: null, eventTitle: nextOrgEvent.title });
                }
            }
        }

        // --- 2. MUSICIAN DATA ---
        if (profile.role === 'MUSICIAN') {
          // Fetch Requests & Upcoming Plans
          const { data: assignments, error: planError } = await supabase
            .from('event_assignments')
            .select(`status, events!inner (id, title, date, theme)`)
            .eq('user_id', user.id)
            .gte('events.date', today)
            .in('status', ['PENDING', 'ACCEPTED'])
            .order('date', { foreignTable: 'events', ascending: true });

          if (planError) throw planError;

          const requests = [];
          const upcoming = [];
          assignments.forEach(a => {
            if (a.status === 'PENDING') requests.push(a.events);
            else if (a.status === 'ACCEPTED') upcoming.push(a.events);
          });

          setMusicianRequests(requests);
          setUpcomingPlans(upcoming);

          // Fetch Tasks
          const { data: tasks, error: taskError } = await supabase
            .from('task_assignments')
            .select(`id, status, task:tasks!inner (id, title, is_active, due_date, type)`)
            .eq('assigned_to_user_id', user.id)
            .eq('status', 'PENDING')
            .eq('task.is_active', true);

          if (taskError) throw taskError;
          setIncompleteTasks(tasks || []);
        }

        // --- 3. ORGANIZER DATA ---
        if (profile.role === 'ORGANIZER') {
          // Fetch All Upcoming Plans
          const { data: events, error: eventError } = await supabase
            .from('events')
            .select('id, title, date, theme')
            .eq('organization_id', profile.organization_id)
            .gte('date', today)
            .order('date', { ascending: true });

          if (eventError) throw eventError;
          setUpcomingPlans(events || []);

          // Fetch Active Tasks Overview
          const { data: tasks, error: taskError } = await supabase
            .from('tasks')
            .select(`id, title, task_assignments (status)`)
            .eq('organization_id', profile.organization_id)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

          if (taskError) throw taskError;

          const processedTasks = tasks.map(t => {
            const pendingCount = t.task_assignments.filter(a => a.status === 'PENDING').length;
            return {
              ...t,
              pendingCount,
              hasAssignments: t.task_assignments.length > 0
            };
          });
          setActiveTasks(processedTasks);

          // Fetch Recent Activity
          const { data: logs } = await supabase
             .from('activity_logs')
             .select('*')
             .eq('organization_id', profile.organization_id)
             .order('created_at', { ascending: false })
             .limit(10);
          if (logs) setRecentActivity(logs);
        }

      } catch (err) {
        console.error("Error loading Home Page data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, profile]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 24) return 'Good evening';
    return 'Good night';
  };

  const formatDate = (dateStr) => {
    const options = { weekday: 'short', month: 'short', day: 'numeric' };
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', options);
  };
  
  const formatTaskType = (type) => {
     return type ? type.replace(/_/g, ' ').toLowerCase() : 'Task';
  };

  if (loading) return <div className="home-loading">Loading Dashboard...</div>;

  return (
    <div className="dashboard-page-wrapper">
      <div className="dashboard-content-container">
        
        <header className="dashboard-header">
          <div>
              <h1>{getGreeting()}, {profile?.first_name}.</h1>
              <p className="dashboard-subtitle">Here's what's going on in your organization.</p>
          </div>
          <div className="header-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </header>

        <div className="dashboard-grid">
            
          {/* LEFT COLUMN */}
          <div className="main-column">
              
              {/* 1. VERSE OF THE WEEK PANEL */}
              {verseData && (
                  <section className="dashboard-panel verse-panel">
                      <div className="verse-content">
                          <FaBible className="verse-icon" />
                          <div>
                              <p className="verse-text">"{verseData.text ? verseData.text.trim() : '...'}"</p>
                              <div className="verse-details">
                                  <span className="verse-ref">{verseData.reference}</span>
                                  <span className="verse-separator">•</span>
                                  <span className="verse-context">from {verseData.eventTitle}</span>
                              </div>
                          </div>
                      </div>
                  </section>
              )}

              {/* 2. Requests (Musician Only) */}
              {profile?.role === 'MUSICIAN' && musicianRequests.length > 0 && (
                <section className="dashboard-panel alert-panel">
                  <div className="panel-header">
                    <h2><FaExclamationCircle /> Pending Invitations</h2>
                  </div>
                  <div className="requests-list">
                    {musicianRequests.map(plan => (
                      <div key={plan.id} className="request-row">
                        <div className="request-info">
                          <span className="request-title">{plan.title}</span>
                          <span className="request-date">{formatDate(plan.date)}</span>
                        </div>
                        <Link to={`/plan/${plan.id}`} className="btn-primary-small">View Plan</Link>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* 3. Upcoming Plans */}
              <section className="dashboard-panel">
                  <div className="panel-header">
                      <h2>Upcoming Plans</h2>
                      {/* UPDATED: "See All" is now visible for everyone */}
                      <Link to="/plans" className="see-all-link">See All</Link>
                  </div>
                  {upcomingPlans.length === 0 ? (
                      <div className="empty-state">No upcoming plans.</div>
                  ) : (
                      <div className="card-grid-modern">
                          {upcomingPlans.slice(0, 6).map(plan => (
                              <Link to={`/plan/${plan.id}`} key={plan.id} className="modern-card">
                                  <div className="modern-card-date">{formatDate(plan.date)}</div>
                                  <div className="modern-card-title">{plan.title}</div>
                                  <div className="modern-card-theme">{plan.theme || ""}</div>
                              </Link>
                          ))}
                      </div>
                  )}
              </section>
              
              {/* 4. Active Tasks Table (Organizer View) */}
              {profile?.role === 'ORGANIZER' && (
                  <section className="dashboard-panel">
                      <div className="panel-header">
                          <h2>Assigned Tasks</h2>
                          {/* UPDATED: Added "See All" for Organizer Tasks */}
                          <Link to="/tasks" className="see-all-link">See All</Link>
                      </div>
                       {activeTasks.length === 0 ? (
                          <div className="empty-state">No active tasks.</div>
                      ) : (
                          <div className="status-table">
                              {activeTasks.map(task => (
                                  <Link to={`/task-results/${task.id}`} key={task.id} className="status-row">
                                      <span className="status-title">{task.title}</span>
                                      <span className={`status-pill ${task.pendingCount === 0 ? 'pill-success' : 'pill-warning'}`}>
                                          {task.pendingCount === 0 
                                              ? "Complete" 
                                              : `${task.pendingCount} Waiting`}
                                      </span>
                                  </Link>
                              ))}
                          </div>
                      )}
                  </section>
              )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="side-column">
               
              {/* Organizer: Recent Activity */}
              {profile?.role === 'ORGANIZER' && (
                  <section className="dashboard-panel">
                      <div className="panel-header">
                          <h2>Recent Activity</h2>
                      </div>
                      {recentActivity.length === 0 ? (
                          <div className="empty-state-small">No recent activity.</div>
                      ) : (
                          <div className="activity-feed">
                              {recentActivity.map(log => (
                                  <div key={log.id} className="activity-item">
                                      <div className="activity-dot"></div>
                                      <div className="activity-content">
                                          <p className="activity-text">{log.description}</p>
                                          <span className="activity-time">
                                          {new Date(log.created_at).toLocaleDateString()}
                                          </span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </section>
              )}

              {/* Musician: Tasks Widget */}
              {profile?.role === 'MUSICIAN' && (
                <section className="dashboard-panel task-widget">
                  <div className="panel-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h2>Pending Tasks</h2>
                      {incompleteTasks.length > 0 && <span className="count-badge">{incompleteTasks.length}</span>}
                    </div>
                    <Link to="/tasks" className="see-all-link">See All</Link>
                  </div>
                  {incompleteTasks.length === 0 ? (
                    <div className="empty-state-small">All caught up!</div>
                  ) : (
                    <div className="task-card-list">
                      {incompleteTasks.slice(0, 5).map(assignment => (
                        <Link 
                          to={`/task/${assignment.id}`} 
                          key={assignment.id} 
                          className="modern-card task-card-modern"
                        >
                          {/* 1. Date Header (Only if due date exists) */}
                          {assignment.task.due_date && (
                            <div className="modern-card-date">
                              Due {new Date(assignment.task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                          )}

                          {/* 2. Content Row: Left (Info) vs Right (Button) */}
                          <div className="task-content-row">
                            
                            {/* Left Col: Title & Type */}
                            <div className="task-info-col">
                              <div className="modern-card-title">
                                {assignment.task.title}
                              </div>
                              {/* Changed from Pill to subtle text */}
                              <div className="task-type-text">
                                {formatTaskType(assignment.task.type)}
                              </div>
                            </div>

                            {/* Right Col: Action Button */}
                            <div className="task-action-col">
                              <span className="btn-primary-small view-task-btn">
                                View Task
                              </span>
                            </div>

                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </section>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;