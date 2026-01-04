// src/components/AllPlansPage/AllPlansPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import CreatePlanForm from './CreatePlanForm';
import './AllPlansPage.css';
import { logActivity } from '../../utils/activityLogger';
import { FaPlus, FaExclamationCircle } from 'react-icons/fa'; // Added FaExclamationCircle

// Fallback items in case the organization hasn't set up a default plan yet
const DEFAULT_SERVICE_ITEMS = [
  { type: 'Generic', title: 'Welcome', duration: '5 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Game', duration: '5 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: 'Worship', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Worship Song', duration: '3 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Bible Verse', title: 'Scripture Reading', duration: '1 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Worship Song', duration: '3 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Worship Song', duration: '3 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: '---', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Message', duration: '15 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: 'Response', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Worship Song', duration: '3 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: '---', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Announcements', duration: '5 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Community Builder', duration: '20 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Dismissal', duration: '1 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, }
];

const AllPlansPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();
  const [fetchedData, setFetchedData] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      if (!user || !profile) {
        setFetchedData([]);
        setPlansLoading(false);
        return;
      }
  
      setPlansLoading(true);
      setError(null);
  
      try {
        let dataToSet = [];
        if (profile.role === 'ORGANIZER') {
          if (!profile.organization_id) {
            setError("Your organizer profile is not associated with an organization.");
            throw new Error("Organizer profile missing organization_id.");
          }
          // Fetch descending (Newest dates first) to easily handle Archives
          const { data, error: fetchError } = await supabase
            .from('events')
            .select('id, title, date, theme')
            .eq('organization_id', profile.organization_id)
            .order('date', { ascending: false });
          if (fetchError) throw fetchError;
          dataToSet = data || [];
  
        } else if (profile.role === 'MUSICIAN') {
          const today = new Date().toISOString().split('T')[0];
          
          // Fetch ascending (Oldest/Closest dates first) for Upcoming/Pending
          const { data: assignments, error: assignmentsError } = await supabase
            .from('event_assignments')
            .select(`
              status, 
              events!inner ( 
                id, 
                title, 
                date, 
                theme 
              )
            `)
            .eq('user_id', user.id)
            .in('status', ['PENDING', 'ACCEPTED'])
            .gte('events.date', today)
            .order('date', { foreignTable: 'events', ascending: true });
  
          if (assignmentsError) throw assignmentsError;
          
          dataToSet = (assignments || []).map(a => {
            if (!a.events) return null; 
            return { 
              ...a.events,
              assignment_status: a.status
            };
          }).filter(Boolean);
        } else {
          setError("Your user role is not configured to view plans.");
        }
        setFetchedData(dataToSet);
      } catch (err) {
        console.error("[AllPlansPage] fetchPlans error:", err.message);
        setError(err.message || "Failed to fetch plans.");
        setFetchedData([]);
      } finally {
        setPlansLoading(false);
      }
    };

    if (!authIsLoading && user && profile) {
        fetchPlans();
    } else if (!authIsLoading) {
        setPlansLoading(false);
    }
  }, [user?.id, profile?.role, profile?.organization_id, authIsLoading]);

  const {
    upcomingOrganizerPlans,
    archivedOrganizerPlans,
    pendingMusicianPlans,
    acceptedMusicianPlans
  } = useMemo(() => {
    if (!profile) return { upcomingOrganizerPlans: [], archivedOrganizerPlans: [], pendingMusicianPlans: [], acceptedMusicianPlans: [] };
    
    if (profile.role === 'ORGANIZER') {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const upcoming = []; 
      const archived = [];
      
      (fetchedData || []).forEach(plan => {
        const planDate = new Date(plan.date + 'T00:00:00'); planDate.setHours(0,0,0,0);
        if (planDate >= today) upcoming.push(plan);
        else archived.push(plan);
      });
      
      return { 
        upcomingOrganizerPlans: upcoming.reverse(), 
        archivedOrganizerPlans: archived, 
        pendingMusicianPlans: [], 
        acceptedMusicianPlans: [] 
      };

    } else if (profile.role === 'MUSICIAN') {
      const pending = (fetchedData || []).filter(plan => plan.assignment_status === 'PENDING');
      const accepted = (fetchedData || []).filter(plan => plan.assignment_status === 'ACCEPTED');
      
      return { 
        pendingMusicianPlans: pending, 
        acceptedMusicianPlans: accepted, 
        upcomingOrganizerPlans: [], 
        archivedOrganizerPlans: [] 
      };
    }
    return { upcomingOrganizerPlans: [], archivedOrganizerPlans: [], pendingMusicianPlans: [], acceptedMusicianPlans: [] };
  }, [fetchedData, profile]);

  const toggleCreateModal = () => setIsCreateModalOpen(!isCreateModalOpen);

  const handleCreatePlan = async (newPlanData) => {
    if (!newPlanData.title || !newPlanData.date) {
        alert("Title and Date are required."); 
        return;
    }
    if (!user || !profile?.organization_id) {
        alert("User or organization information is missing.");
        return;
    }
    
    try {
      const planToInsert = {
        ...newPlanData,
        checklist_status: {},
        organization_id: profile.organization_id,
      };
      const { data: newEvent, error: insertError } = await supabase.from('events').insert([planToInsert]).select('id').single();
      if (insertError) throw insertError;
      if (!newEvent?.id) throw new Error("Failed to retrieve new event ID.");
      const newEventId = newEvent.id;

      let itemsTemplate = DEFAULT_SERVICE_ITEMS;
      const { data: orgData } = await supabase
        .from('organizations')
        .select('default_service_items')
        .eq('id', profile.organization_id)
        .single();
        
      if (orgData?.default_service_items && orgData.default_service_items.length > 0) {
        itemsTemplate = orgData.default_service_items;
      }

      const serviceItemsToInsert = itemsTemplate.map((item, index) => ({ 
          event_id: newEventId, 
          sequence_number: index,
          type: item.type,
          title: item.title,
          duration: item.duration,
          details: item.details,
          artist: item.artist,
          chord_chart_url: item.chord_chart_url,
          youtube_url: item.youtube_url,
          assigned_singer_ids: item.assigned_singer_ids,
          musical_key: item.musical_key,
          bible_book: item.bible_book,
          bible_chapter: item.bible_chapter,
          bible_verse_range: item.bible_verse_range
      }));

      if (serviceItemsToInsert.length > 0) {
        const { error: itemsInsertError } = await supabase.from('service_items').insert(serviceItemsToInsert);
        if (itemsInsertError) {
          console.error('Error inserting default service items:', itemsInsertError.message);
          alert(`Plan created (ID: ${newEventId}), but failed to add default items. Error: ${itemsInsertError.message}`);
        }
      }

      setIsCreateModalOpen(false);
      logActivity(user, profile, 'PLAN_CREATED', `${profile.first_name} created a new plan: ${newPlanData.title}`);
      navigate(`/plan/${newEventId}`);
    } catch (err) {
      console.error('Error in handleCreatePlan:', err);
      alert(`An error occurred: ${err.message}`);
    }
  };

  const renderPlanListCards = (plansToRender) => {
    if (!plansToRender || plansToRender.length === 0) return null; 
    return (
      <div className="plans-grid">
        {plansToRender.map(plan => (
          <Link to={`/plan/${plan.id}`} key={plan.id} className="plan-card">
             <div className="plan-card-date">
                {plan.date ? new Date(plan.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' }) : 'Date Not Set'}
             </div>
             <div className="plan-card-title">{plan.title || 'Untitled Plan'}</div>
             <div className="plan-card-theme">{plan.theme || ""}</div>
          </Link>
        ))}
      </div>
    );
  };

  if (authIsLoading) { return <div className="all-plans-page-wrapper"><p className="page-status">Initializing...</p></div>; }
  if (!user || !profile) { return <div className="all-plans-page-wrapper"><p className="page-status">User data not fully loaded.</p></div>; }
  
  if (profile.role === 'ORGANIZER' && !profile.organization_id && !plansLoading) {
      return ( 
        <div className="all-plans-page-wrapper">
            <div className="all-plans-content-container">
                <h1>Event Plans</h1>
                <p className="page-status error">Your organizer profile is not associated with an organization.</p>
            </div>
        </div> 
      );
  }
  if (error && !plansLoading) { return <div className="all-plans-page-wrapper"><p className="page-status error">{error}</p></div>; }
  if (plansLoading) { return <div className="all-plans-page-wrapper"><p className="page-status">Loading plans...</p></div>; }

  const hasOrganizerPlans = upcomingOrganizerPlans.length > 0 || archivedOrganizerPlans.length > 0;
  const hasMusicianPlans = pendingMusicianPlans.length > 0 || acceptedMusicianPlans.length > 0;

  return (
    <div className="all-plans-page-wrapper">
      <div className="all-plans-content-container">
        
        {/* HEADER */}
        <div className="all-plans-header">
            <h1>{profile.role === 'MUSICIAN' ? "Your Schedule" : "All Events"}</h1>
            {profile.role === 'ORGANIZER' && (
            <button onClick={toggleCreateModal} className="create-new-plan-btn" disabled={!profile.organization_id}>
                Create Plan
            </button>
            )}
        </div>

        {/* ORGANIZER VIEW */}
        {profile.role === 'ORGANIZER' && (
            <>
            {!hasOrganizerPlans && (
                <p className="empty-state-text">No plans have been scheduled for your organization.</p>
            )}

            {upcomingOrganizerPlans.length > 0 && (
                <div className="plans-section-panel">
                <h2>Upcoming Plans</h2>
                {renderPlanListCards(upcomingOrganizerPlans)}
                </div>
            )}
            
            {archivedOrganizerPlans.length > 0 && (
                <div className="plans-section-panel">
                <h2>Past Plans</h2>
                {renderPlanListCards(archivedOrganizerPlans)}
                </div>
            )}
            </>
        )}

        {/* MUSICIAN VIEW */}
        {profile.role === 'MUSICIAN' && (
            <>
            {!hasMusicianPlans && (
                <p className="empty-state-text">You have not been placed on the schedule for your organization.</p>
            )}

            {pendingMusicianPlans.length > 0 && (
                <div className="plans-section-panel" style={{ borderColor: '#fecdd3' }}>
                  {/* UPDATED HEADER WITH ICON */}
                  <h2 style={{ color: '#be123c' }}>
                    <FaExclamationCircle /> Pending Invitations
                  </h2>
                  {renderPlanListCards(pendingMusicianPlans)}
                </div>
            )}
            
            {acceptedMusicianPlans.length > 0 && (
                <div className="plans-section-panel">
                <h2>Upcoming Plans</h2>
                {renderPlanListCards(acceptedMusicianPlans)}
                </div>
            )}
            </>
        )}
        
        {!profile.role && (
            <p className="page-status error">Your user role is not defined. Cannot display plans.</p>
        )}

        {/* MODAL */}
        {isCreateModalOpen && profile.role === 'ORGANIZER' && (
            <div className="modal-overlay" onClick={toggleCreateModal}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn" onClick={toggleCreateModal}>&times;</button>
                <CreatePlanForm onCreatePlan={handleCreatePlan} onCancel={toggleCreateModal} />
            </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default AllPlansPage;