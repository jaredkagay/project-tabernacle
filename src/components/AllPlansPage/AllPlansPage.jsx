// src/components/AllPlansPage/AllPlansPage.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import CreatePlanForm from './CreatePlanForm';
import './AllPlansPage.css';
import '../PlanPage/PlanPage.css'; // For modal styles

const DEFAULT_SERVICE_ITEMS = [
  { type: 'Generic', title: 'Welcome', duration: '5 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Announcements', duration: '5 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: 'Worship', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Song 1', duration: '4 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Song 2', duration: '4 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Song 3', duration: '4 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: '---', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Message', duration: '15 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: 'Response', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Song', title: 'Song 4', duration: '4 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Divider', title: '---', duration: null, details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Community Builder', duration: '20 min', details: null, artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, },
  { type: 'Generic', title: 'Dismissal', duration: '0 min', details: 'Go in Peace. Serve the Lord.', artist: null, chord_chart_url: null, youtube_url: null, assigned_singer_ids: [], musical_key: null, bible_book: null, bible_chapter: null, bible_verse_range: null, }
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
  
      console.log(`[AllPlansPage] fetchPlans: Started for User: ${user.id}, Role: ${profile.role}`);
      setPlansLoading(true);
      setError(null);
  
      try {
        let dataToSet = [];
        if (profile.role === 'ORGANIZER') {
          if (!profile.organization_id) {
            setError("Your organizer profile is not associated with an organization.");
            throw new Error("Organizer profile missing organization_id.");
          }
          const { data, error: fetchError } = await supabase
            .from('events')
            .select('id, title, date, theme')
            .eq('organization_id', profile.organization_id)
            .order('date', { ascending: false });
          if (fetchError) throw fetchError;
          dataToSet = data || [];
  
        } else if (profile.role === 'MUSICIAN') {
          const today = new Date().toISOString().split('T')[0];
          
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
            if (!a.events) {
              return null; 
            }
            return { 
              ...a.events,
              assignment_status: a.status
            };
          }).filter(Boolean);
          
          console.log('[AllPlansPage] fetchPlans (Musician): Processed assignments to plans:', dataToSet);
        } else {
          setError("Your user role is not configured to view plans.");
        }
        setFetchedData(dataToSet);
      } catch (err) {
        console.error("[AllPlansPage] fetchPlans: CATCH block. Error:", err.message);
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
      const upcoming = []; const archived = [];
      (fetchedData || []).forEach(plan => {
        const planDate = new Date(plan.date + 'T00:00:00'); planDate.setHours(0,0,0,0);
        if (planDate >= today) upcoming.push(plan);
        else archived.push(plan);
      });
      return { upcomingOrganizerPlans: upcoming, archivedOrganizerPlans: archived, pendingMusicianPlans: [], acceptedMusicianPlans: [] };
    } else if (profile.role === 'MUSICIAN') {
      const pending = (fetchedData || []).filter(plan => plan.assignment_status === 'PENDING');
      const accepted = (fetchedData || []).filter(plan => plan.assignment_status === 'ACCEPTED');
      return { pendingMusicianPlans: pending, acceptedMusicianPlans: accepted, upcomingOrganizerPlans: [], archivedOrganizerPlans: [] };
    }
    return { upcomingOrganizerPlans: [], archivedOrganizerPlans: [], pendingMusicianPlans: [], acceptedMusicianPlans: [] };
  }, [fetchedData, profile]);

  const toggleCreateModal = () => setIsCreateModalOpen(!isCreateModalOpen);

  const handleCreatePlan = async (newPlanData) => {
    if (!newPlanData.title || !newPlanData.date) {
        alert("Title and Date are required."); throw new Error("Title and Date are required.");
    }
    if (!user || !profile?.organization_id) {
        alert("User or organization information is missing. Cannot create plan.");
        throw new Error("User or organization information missing.");
    }
    let newEventId = null;
    try {
      const planToInsert = {
        ...newPlanData,
        checklist_status: {},
        organization_id: profile.organization_id,
      };
      const { data: newEvent, error: insertError } = await supabase.from('events').insert([planToInsert]).select('id').single();
      if (insertError) throw insertError;
      if (!newEvent?.id) throw new Error("Failed to retrieve new event ID.");
      newEventId = newEvent.id;

      const serviceItemsToInsert = DEFAULT_SERVICE_ITEMS.map((item, index) => ({ ...item, event_id: newEventId, sequence_number: index }));
      if (serviceItemsToInsert.length > 0) {
        const { error: itemsInsertError } = await supabase.from('service_items').insert(serviceItemsToInsert);
        if (itemsInsertError) {
          console.error('Error inserting default service items:', itemsInsertError.message);
          alert(`Plan created (ID: ${newEventId}), but failed to add default items. Error: ${itemsInsertError.message}`);
        }
      }
      setIsCreateModalOpen(false);
      navigate(`/plan/${newEventId}`);
    } catch (err) {
      console.error('Error in handleCreatePlan:', err);
      alert(`An error occurred: ${err.message}`);
      throw err; 
    }
  };

  const renderPlanListCards = (plansToRender, listTitleForEmpty) => {
    if (!plansToRender || plansToRender.length === 0) {
      return null; 
    }
    return (
      <ul className="plans-list">
        {plansToRender.map(plan => (
          <li key={plan.id} className="plan-item-card">
            <div className="plan-card-content">
              <Link to={`/plan/${plan.id}`} className="plan-link">
                <h2>{plan.title || 'Untitled Plan'}</h2>
                <p className="plan-date">Date: {plan.date ? new Date(plan.date + 'T00:00:00').toLocaleDateString() : 'Not set'}</p>
                {plan.theme && <p className="plan-theme">Theme: {plan.theme}</p>}
              </Link>
            </div>
          </li>
        ))}
      </ul>
    );
  };


  if (authIsLoading) { return <p className="page-status">Initializing authentication...</p>; }
  if (!user || !profile) { return <p className="page-status">User data not fully loaded. Try logging in again.</p>; }
  if (profile.role === 'ORGANIZER' && !profile.organization_id && !plansLoading) {
      return ( <div className="all-plans-container"><h1>Event Plans</h1><p className="page-status error">Your organizer profile is not associated with an organization.</p></div> );
  }
  if (error && !plansLoading) { return <p className="page-status error">{error}</p>; }
  if (plansLoading) { return <p className="page-status">Loading plans...</p>; }

  return (
    <div className="all-plans-container">
      <div className="all-plans-header">
        <h1>{profile.role === 'MUSICIAN' ? "Your Plan Invitations & Assignments" : "All Event Plans"}</h1>
        {profile.role === 'ORGANIZER' && (
          <button onClick={toggleCreateModal} className="create-new-plan-btn" disabled={!profile.organization_id}>
            + Create New Plan
          </button>
        )}
      </div>

      {profile.role === 'ORGANIZER' && (
        <>
          <div className="plans-section">
            <h2>Upcoming Plans</h2>
            {upcomingOrganizerPlans.length > 0 
                ? renderPlanListCards(upcomingOrganizerPlans) 
                : <p>No upcoming plans scheduled for your organization.</p>}
          </div>
          <div className="plans-section">
            <h2>Archived Plans</h2>
            {archivedOrganizerPlans.length > 0 
                ? renderPlanListCards(archivedOrganizerPlans) 
                : <p>No past plans found for your organization.</p>}
          </div>
        </>
      )}

      {profile.role === 'MUSICIAN' && (
        <>
          <div className="plans-section">
            <h2>Pending Invitations</h2>
            {pendingMusicianPlans.length > 0 
                ? renderPlanListCards(pendingMusicianPlans) 
                : <p>You have no pending invitations for upcoming events.</p>}
          </div>
          <div className="plans-section">
            <h2>Accepted Plans</h2>
            {acceptedMusicianPlans.length > 0 
                ? renderPlanListCards(acceptedMusicianPlans) 
                : <p>You have no accepted assignments for upcoming events.</p>}
          </div>
        </>
      )}
      
      {!profile.role && (
          <p className="page-status error">Your user role is not defined. Cannot display plans.</p>
      )}

      {isCreateModalOpen && profile.role === 'ORGANIZER' && (
        <div className="modal-overlay" onClick={toggleCreateModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={toggleCreateModal}>&times;</button>
            <CreatePlanForm onCreatePlan={handleCreatePlan} onCancel={toggleCreateModal} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AllPlansPage;