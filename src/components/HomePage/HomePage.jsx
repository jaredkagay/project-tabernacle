// src/components/HomePage/HomePage.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import { FaCalendarPlus, FaClipboardList, FaMusic, FaCheckCircle, FaExclamationCircle, FaBible } from 'react-icons/fa';
import './HomePage.css';

const HomePage = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  
  // Data State
  const [musicianRequests, setMusicianRequests] = useState([]);
  const [upcomingPlans, setUpcomingPlans] = useState([]); 
  const [incompleteTasks, setIncompleteTasks] = useState([]); 
  const [activeTasks, setActiveTasks] = useState([]); 
  
  // New State for Verse
  const [verseData, setVerseData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!user || !profile) return;
      setLoading(true);

      try {
        const today = new Date().toISOString().split('T')[0];
        let fetchedEvents = [];

        // --- FETCH EVENTS (Shared Logic) ---
        // We need events for both roles to find the Verse of the Week
        const query = supabase
            .from('events')
            .select('id, title, date, theme, organization_id')
            .gte('date', today)
            .order('date', { ascending: true });

        // Filter by org if organizer, or verify access later if musician 
        // (Simpler here to just fetch broadly for the "Verse" feature, 
        // but for safety in production you'd rely on RLS)
        if (profile.role === 'ORGANIZER' && profile.organization_id) {
            query.eq('organization_id', profile.organization_id);
        } else if (profile.role === 'MUSICIAN') {
            // Musicians need to find events they are part of OR the org's public events.
            // For now, let's assume we find the Verse from the 'next' event the user is assigned to
            // OR we can fetch the org's next event if we knew the org ID. 
            // Let's rely on the assignments fetch below for the list, 
            // but we need ONE event for the verse.
        }

        // --- MUSICIAN SPECIFIC ---
        if (profile.role === 'MUSICIAN') {
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
          
          // Use the first upcoming accepted plan for the verse
          if (upcoming.length > 0) fetchedEvents = [upcoming[0]];
          else if (requests.length > 0) fetchedEvents = [requests[0]];

          const { data: tasks, error: taskError } = await supabase
            .from('task_assignments')
            .select(`id, status, task:tasks!inner (id, title, is_active, due_date)`)
            .eq('assigned_to_user_id', user.id)
            .eq('status', 'PENDING')
            .eq('task.is_active', true);

          if (taskError) throw taskError;
          setIncompleteTasks(tasks || []);
        }

        // --- ORGANIZER SPECIFIC ---
        if (profile.role === 'ORGANIZER' && profile.organization_id) {
          const { data: events, error: eventError } = await query;
          if (eventError) throw eventError;
          setUpcomingPlans(events || []);
          fetchedEvents = events || [];

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
        }

        // --- VERSE OF THE WEEK FETCH ---
        if (fetchedEvents.length > 0) {
            const nextEventId = fetchedEvents[0].id;
            
            // Find items with bible info
            const { data: serviceItems } = await supabase
                .from('service_items')
                .select('bible_book, bible_chapter, bible_verse_range')
                .eq('event_id', nextEventId)
                .not('bible_book', 'is', null) // Only items with books
                .limit(1);

            if (serviceItems && serviceItems.length > 0) {
                const item = serviceItems[0];
                const reference = `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`;
                
                // Fetch text from public API
                try {
                    const res = await fetch(`https://bible-api.com/${encodeURIComponent(reference)}`);
                    const json = await res.json();
                    if (json.text) {
                        setVerseData({
                            reference: json.reference || reference,
                            text: json.text,
                            eventTitle: fetchedEvents[0].title
                        });
                    }
                } catch (apiErr) {
                    console.error("Bible API fetch failed", apiErr);
                    // Fallback to just reference if API fails
                    setVerseData({ reference, text: null, eventTitle: fetchedEvents[0].title });
                }
            }
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

  if (loading) return <div className="home-loading">Loading Dashboard...</div>;

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
            <h1>{getGreeting()}, {profile?.first_name}.</h1>
            <p className="dashboard-subtitle">Here is your ministry overview.</p>
        </div>
        <div className="header-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </header>

      {/* --- DASHBOARD GRID --- */}
      <div className="dashboard-grid">
          
        {/* LEFT COLUMN */}
        <div className="main-column">
            
            {/* 1. VERSE OF THE WEEK PANEL (NEW) */}
            {verseData && (
                <section className="dashboard-panel verse-panel">
                    <div className="verse-content">
                        <FaBible className="verse-icon" />
                        <div>
                            <p className="verse-text">"{verseData.text ? verseData.text.trim() : '...'}"</p>
                            <p className="verse-ref">{verseData.reference} <span className="verse-context">• From {verseData.eventTitle}</span></p>
                        </div>
                    </div>
                </section>
            )}

            {/* 2. Requests (Musician Only) */}
            {profile?.role === 'MUSICIAN' && musicianRequests.length > 0 && (
              <section className="dashboard-panel alert-panel">
                <div className="panel-header">
                  <h2><FaExclamationCircle /> Action Required</h2>
                </div>
                <div className="requests-list">
                  {musicianRequests.map(plan => (
                    <div key={plan.id} className="request-row">
                      <div className="request-info">
                        <span className="request-title">{plan.title}</span>
                        <span className="request-date">{formatDate(plan.date)}</span>
                      </div>
                      <Link to={`/plan/${plan.id}`} className="btn-primary-small">View Invite</Link>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Upcoming Plans (Shared Logic for display, though data differs) */}
            <section className="dashboard-panel">
                <div className="panel-header">
                    <h2>Upcoming Plans</h2>
                    {profile?.role === 'ORGANIZER' && <Link to="/plans" className="see-all-link">See All</Link>}
                </div>
                {upcomingPlans.length === 0 ? (
                    <div className="empty-state">No upcoming plans.</div>
                ) : (
                     // Different layouts for Organizer vs Musician based on your preference?
                     // I'll stick to the "Modern Grid" for Organizer and "List" for Musician as discussed, 
                     // or unify them. Let's unify to the Card Grid for consistency.
                    <div className="card-grid-modern">
                        {upcomingPlans.slice(0, 6).map(plan => (
                            <Link to={`/plan/${plan.id}`} key={plan.id} className="modern-card">
                                <div className="modern-card-date">{formatDate(plan.date)}</div>
                                <div className="modern-card-title">{plan.title}</div>
                                <div className="modern-card-theme">{plan.theme || "No theme"}</div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>
            
            {/* 4. Active Tasks Table (Organizer Only) */}
            {profile?.role === 'ORGANIZER' && (
                <section className="dashboard-panel">
                    <div className="panel-header">
                        <h2>Active Tasks Status</h2>
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
             
            {/* Organizer Quick Actions */}
            {profile?.role === 'ORGANIZER' && (
                <section className="dashboard-panel quick-actions-panel">
                    <div className="panel-header">
                        <h2>Quick Actions</h2>
                    </div>
                    <div className="action-buttons-grid">
                        <Link to="/plans" className="action-btn">
                            <FaCalendarPlus />
                            <span>Plan</span>
                        </Link>
                        <Link to="/tasks" className="action-btn">
                            <FaClipboardList />
                            <span>Task</span>
                        </Link>
                        <Link to="/songs" className="action-btn">
                            <FaMusic />
                            <span>Song</span>
                        </Link>
                    </div>
                </section>
            )}

             {/* Musician Tasks Widget */}
             {profile?.role === 'MUSICIAN' && (
                <section className="dashboard-panel task-widget">
                    <div className="panel-header">
                        <h2>Your Tasks</h2>
                        <span className="count-badge">{incompleteTasks.length}</span>
                    </div>
                    {incompleteTasks.length === 0 ? (
                        <div className="empty-state-small">All caught up!</div>
                    ) : (
                        <div className="task-list-small">
                            {incompleteTasks.map(assignment => (
                                <Link to={`/task/${assignment.id}`} key={assignment.id} className="task-item-small">
                                    <div className="checkbox-visual"></div>
                                    <span>{assignment.task.title}</span>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
             )}
        </div>
      </div>
    </div>
  );
};

export default HomePage;