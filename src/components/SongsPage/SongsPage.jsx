// src/components/SongsPage/SongsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import SongForm from './SongForm';
import './SongsPage.css'; // Create this CSS file
import '../PlanPage/PlanPage.css'; // For modal styles

const SongsPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();

  const [primarySongs, setPrimarySongs] = useState([]);
  const [mySecondarySongs, setMySecondarySongs] = useState([]);

  const [isLoadingPrimary, setIsLoadingPrimary] = useState(false);
  const [isLoadingSecondary, setIsLoadingSecondary] = useState(false);
  const [error, setError] = useState('');

  // Modal state for adding/editing primary songs
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null); // null for new, song object for edit
  const [isSubmittingSong, setIsSubmittingSong] = useState(false);
  const [modalMode, setModalMode] = useState('createPrimary'); // 'createPrimary', 'editPrimary', 'createSecondary', 'editSecondary'

  const [organizationMusicians, setOrganizationMusicians] = useState([]); // Already fetched in fetchOrganizerData
  const [selectedMusicianIdForOrgView, setSelectedMusicianIdForOrgView] = useState('');
  const [viewingMusicianSecondarySongs, setViewingMusicianSecondarySongs] = useState([]);
  const [isLoadingViewingMusicianSongs, setIsLoadingViewingMusicianSongs] = useState(false);

  const fetchPrimarySongs = useCallback(async () => {
    if (!profile?.organization_id) {
      setPrimarySongs([]); setIsLoadingPrimary(false); return;
    }
    setIsLoadingPrimary(true); setError('');
    try {
      const { data, error: fetchError } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_primary', true)
        .order('title', { ascending: true });
      
      if (fetchError) throw fetchError;
      setPrimarySongs(data || []);
    } catch (err) {
      console.error("Error fetching primary songs:", err);
      setError(err.message || "Failed to fetch primary songs.");
      setPrimarySongs([]);
    } finally {
      setIsLoadingPrimary(false);
    }
  }, [profile?.organization_id]);

  const fetchMySecondarySongs = useCallback(async () => {
  if (!profile || profile.role !== 'MUSICIAN' || !profile.organization_id || !user?.id) {
    setMySecondarySongs([]); setIsLoadingSecondary(false); return;
  }
  setIsLoadingSecondary(true); setError('');
  try {
    const { data, error: fetchError } = await supabase
      .from('songs')
      .select('*')
      .eq('organization_id', profile.organization_id)
      .eq('added_by_user_id', user.id) // Key filter: only songs added by this user
      .eq('is_primary', false)          // Key filter: only secondary songs
      .order('title', { ascending: true });

    if (fetchError) throw fetchError;
    setMySecondarySongs(data || []);
    } catch (err) {
      console.error("Error fetching my secondary songs:", err);
      setError(err.message || "Failed to fetch your secondary songs.");
      setMySecondarySongs([]);
    } finally {
      setIsLoadingSecondary(false);
    }
  }, [profile?.organization_id, profile?.role, user?.id]);

  const fetchOrganizerData = useCallback(async () => {
    if (!profile || profile.role !== 'ORGANIZER' || !profile.organization_id || !user) {
      setIsLoadingPrimary(false); setPrimarySongs([]); 
      setOrganizationMusicians([]); setIsLoadingViewingMusicianSongs(false);
      return;
    }
    setIsLoadingPrimary(true); // For primary songs
    // setIsLoadingViewingMusicianSongs(true); // Set when a musician is selected
    setError('');
    try {
      // Fetch primary songs
      const { data: primaryData, error: primaryError } = await supabase
        .from('songs')
        .select('*')
        .eq('organization_id', profile.organization_id)
        .eq('is_primary', true)
        .order('title', { ascending: true });
      if (primaryError) throw primaryError;
      setPrimarySongs(primaryData || []);

      // Fetch all musicians in the organization (for the dropdown)
      const { data: membersData, error: membersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name') // Only need ID and name for dropdown
        .eq('organization_id', profile.organization_id)
        .eq('role', 'MUSICIAN')
        .order('last_name', {ascending: true});
      if (membersError) throw membersError;
      setOrganizationMusicians(membersData || []);

    } catch (err) {
      console.error("Error fetching organizer's song data:", err);
      setError(err.message || "Failed to fetch data.");
    } finally {
      setIsLoadingPrimary(false);
    }
  }, [profile, user?.id]);

  useEffect(() => {
    if (!authIsLoading && profile && user) {
      if (profile.organization_id) {
        fetchPrimarySongs(); // All users in an org see primary songs
        if (profile.role === 'MUSICIAN') {
          fetchMySecondarySongs();
        } else if (profile.role === 'ORGANIZER') {
          fetchOrganizerData(); // Organizer specific data (includes musicians list)
        }
      } else {
        setPrimarySongs([]); setMySecondarySongs([]);
        setError("You must be part of an organization to manage or view songs.");
      }
    }
  }, [authIsLoading, profile, user, fetchPrimarySongs, fetchMySecondarySongs, fetchOrganizerData]);

  useEffect(() => {
    const fetchSelectedMusicianSongs = async () => {
      if (!selectedMusicianIdForOrgView || profile?.role !== 'ORGANIZER' || !profile?.organization_id) {
        setViewingMusicianSecondarySongs([]);
        return;
      }
      setIsLoadingViewingMusicianSongs(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('songs')
          .select('*')
          .eq('organization_id', profile.organization_id)
          .eq('added_by_user_id', selectedMusicianIdForOrgView)
          .eq('is_primary', false)
          .order('title', { ascending: true });
        if (fetchError) throw fetchError;
        setViewingMusicianSecondarySongs(data || []);
      } catch (err) {
        console.error("Error fetching selected musician's secondary songs:", err);
        setError(err.message || "Failed to fetch selected musician's songs.");
        setViewingMusicianSecondarySongs([]);
      } finally {
        setIsLoadingViewingMusicianSongs(false);
      }
    };

    if (selectedMusicianIdForOrgView) {
      fetchSelectedMusicianSongs();
    } else {
      setViewingMusicianSecondarySongs([]); // Clear if no musician is selected
    }
  }, [selectedMusicianIdForOrgView, profile?.organization_id, profile?.role]);

  const openSongModal = (mode, song = null) => {
    setModalMode(mode); // e.g., 'createPrimary', 'editSecondary'
    setEditingSong(song); // null for create modes
    setIsSongModalOpen(true);
    setError('');
  };

  const closeSongModal = () => {
    setIsSongModalOpen(false);
    setEditingSong(null);
  };

   const handleSongSubmit = async (songDataFromForm) => {
    if (!profile?.organization_id || !user) {
      alert("Cannot save song: Organization or user information missing.");
      throw new Error("Auth/Org info missing");
    }
    setIsSubmittingSong(true); setError('');
    try {
      let responseError;
      let successMessage = '';
      let songToUpsert = {
        ...songDataFromForm, // title, artist, chord_chart_url, youtube_url, default_key
        organization_id: profile.organization_id,
        updated_at: new Date().toISOString(),
      };

      if (modalMode === 'editPrimary' || modalMode === 'editSecondary' || modalMode === 'editSecondaryByOrg') {
        if (!editingSong?.id) throw new Error("Editing song ID missing");
        // For edits, we don't change added_by_user_id or is_primary (unless it's a "promote" feature later)
        // These should be preserved from editingSong object.
        songToUpsert.added_by_user_id = editingSong.added_by_user_id;
        songToUpsert.is_primary = editingSong.is_primary;
        
        const { error } = await supabase.from('songs').update(songToUpsert).eq('id', editingSong.id);
        responseError = error;
        successMessage = `Song "${songDataFromForm.title}" updated successfully!`;
      } else { // 'createPrimary' or 'createSecondary'
        songToUpsert.added_by_user_id = user.id; // Current user is adding
        songToUpsert.is_primary = (modalMode === 'createPrimary');
        
        const { error } = await supabase.from('songs').insert([songToUpsert]);
        responseError = error;
        successMessage = `Song "${songDataFromForm.title}" added successfully!`;
      }

      if (responseError) throw responseError;
      
      // Refresh relevant lists
      if (modalMode.includes('Primary') || songToUpsert.is_primary) fetchPrimarySongs();
      if (modalMode.includes('Secondary') || !songToUpsert.is_primary) {
        if (profile.role === 'MUSICIAN' && songToUpsert.added_by_user_id === user.id) fetchMySecondarySongs();
        if (profile.role === 'ORGANIZER' && selectedMusicianIdForOrgView && songToUpsert.added_by_user_id === selectedMusicianIdForOrgView) {
          // Re-fetch the currently viewed musician's secondary songs
          const tempMusicianId = selectedMusicianIdForOrgView; // Capture before state might clear
          // Await this fetch if direct feedback needed, or let useEffect handle it
           const { data: updatedSecSongs, error: fetchError } = await supabase.from('songs').select('*')
            .eq('organization_id', profile.organization_id)
            .eq('added_by_user_id', tempMusicianId)
            .eq('is_primary', false).order('title', { ascending: true });
           if(!fetchError) setViewingMusicianSecondarySongs(updatedSecSongs || []);
        }
      }
      closeSongModal();
      alert(successMessage);
    } catch (err) {
      console.error("Error saving song:", err);
      setError(err.message || "Failed to save song.");
      throw err;
    } finally {
      setIsSubmittingSong(false);
    }
  };

  const handleDeleteSong = async (songId, songTitle, isPrimary, songAddedByUserIdIfSecondary) => {
    const listName = isPrimary ? "primary" : "secondary";
    if (!window.confirm(`Are you sure you want to delete the ${listName} song "${songTitle}"? This cannot be undone.`)) return;
    if (!profile?.organization_id || !user) return;

    setIsSubmittingSong(true); setError('');
    try {
      let query = supabase.from('songs').delete().eq('id', songId).eq('organization_id', profile.organization_id);
      let canDelete = false;

      if (profile.role === 'ORGANIZER') {
        // Organizers can delete any primary song in their org
        // Organizers can delete any secondary song in their org
        canDelete = true; // RLS will ultimately enforce this
        query = query.eq(isPrimary ? 'is_primary' : 'is_primary', isPrimary); // Target primary or secondary
      } else if (profile.role === 'MUSICIAN') {
        if (isPrimary) {
          throw new Error("Musicians cannot delete primary songs.");
        }
        if (songAddedByUserIdIfSecondary === user.id) {
          canDelete = true;
          query = query.eq('is_primary', false).eq('added_by_user_id', user.id);
        } else {
          throw new Error("Musicians can only delete their own secondary songs.");
        }
      } else {
        throw new Error("Unauthorized action.");
      }

      if (!canDelete) { // Should be caught by logic above, but as a safeguard
        throw new Error("You do not have permission to delete this song type.");
      }

      const { error } = await query;
      if (error) throw error;
      
      alert(`Song "${songTitle}" deleted.`);
      if (isPrimary) {
        fetchPrimarySongs();
      } else {
        if (profile.role === 'MUSICIAN') fetchMySecondarySongs();
        if (profile.role === 'ORGANIZER' && selectedMusicianIdForOrgView === songAddedByUserIdIfSecondary) {
          // Re-fetch the currently viewed musician's secondary songs
           const tempMusicianId = selectedMusicianIdForOrgView;
           const { data: updatedSecSongs, error: fetchError } = await supabase.from('songs').select('*')
            .eq('organization_id', profile.organization_id)
            .eq('added_by_user_id', tempMusicianId)
            .eq('is_primary', false).order('title', { ascending: true });
           if(!fetchError) setViewingMusicianSecondarySongs(updatedSecSongs || []);
        }
      }
    } catch (err) {
      console.error("Error deleting song:", err);
      setError(err.message || "Failed to delete song.");
    } finally {
      setIsSubmittingSong(false);
    }
  };

  const renderSongList = (songsToRender, listTitle, isMusicianViewingPrimaryList = false, isOrganizerViewingSpecificMusicianSecondary = false, musicianBeingViewedId = null) => {
    let isLoadingState = false;
    if (listTitle.includes("Primary")) isLoadingState = isLoadingPrimary;
    else if (listTitle.includes("My Secondary")) isLoadingState = isLoadingSecondary;
    else if (listTitle.includes("Selected Musician")) isLoadingState = isLoadingViewingMusicianSongs;

    if (isLoadingState) return <p>Loading {listTitle.toLowerCase()}...</p>;
    if (songsToRender.length === 0) {
        if (listTitle.includes("Selected Musician") && !selectedMusicianIdForOrgView && profile.role === 'ORGANIZER') return <p>Select a musician above to view their secondary songs.</p>;
        return <p>No {listTitle.toLowerCase()} found.</p>;
    }

    return (
      <ul className="songs-list">
        {songsToRender.map(song => {
          let canEditOrDelete = false;

          if (profile.role === 'ORGANIZER') {
            // Organizers can edit/delete their primary songs.
            // They can also edit/delete secondary songs IF they are viewing a specific musician's list.
            if (song.is_primary || isOrganizerViewingSpecificMusicianSecondary) {
              canEditOrDelete = true;
            }
          } else if (profile.role === 'MUSICIAN') {
            // Musicians can only edit/delete their own secondary songs.
            if (!song.is_primary && song.added_by_user_id === user.id && !isMusicianViewingPrimaryList) {
              canEditOrDelete = true;
            }
          }

          let editMode = 'editSecondary'; // Default for musician editing their own
          if (profile.role === 'ORGANIZER') {
              editMode = song.is_primary ? 'editPrimary' : 'editSecondaryByOrg';
          }


          return (
            <li key={song.id} className="song-item-card">
              <div className="song-info">
                <h3>{song.title}</h3>
                {song.artist && <p className="song-artist-display">Artist: {song.artist}</p>}
                {song.default_key && <p className="song-key-display">Key: {song.default_key}</p>}
                {isOrganizerViewingSpecificMusicianSecondary && song.added_by_user_id && organizationMusicians.length > 0 &&
                    (() => {
                        const adder = organizationMusicians.find(m => m.id === song.added_by_user_id);
                        return adder ? <p style={{fontSize: '0.8em', color: '#777'}}>Added by: {adder.first_name} {adder.last_name}</p> : null;
                    })()
                }
              </div>
              <div className="song-links">
                {song.chord_chart_url && <a href={song.chord_chart_url} target="_blank" rel="noopener noreferrer">Chart</a>}
                {song.youtube_url && <a href={song.youtube_url} target="_blank" rel="noopener noreferrer">Video</a>}
              </div>
              {canEditOrDelete && (
                <div className="song-actions">
                  <button onClick={() => openSongModal(editMode, song)} className="edit-btn-small" disabled={isSubmittingSong}>Edit</button>
                  <button onClick={() => handleDeleteSong(song.id, song.title, song.is_primary, song.added_by_user_id)} className="delete-btn-small" disabled={isSubmittingSong}>Delete</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  if (authIsLoading) return <p className="page-status">Loading authentication...</p>;
  if (!profile) return <p className="page-status">Loading user profile...</p>;
  if (!profile.organization_id && !authIsLoading) { // User is loaded but not in an org
    return (
        <div className="songs-page-container">
            <h1>Song Library</h1>
            <p className="page-status error">You must be part of an organization to view or manage songs.</p>
            {/* Optionally, link to Settings page to join/create org */}
            <Link to="/settings" className="submit-btn" style={{marginTop: '20px'}}>Go to Settings to Join/Create Organization</Link>
        </div>
    );
  }

  return (
    <div className="songs-page-container">
      <div className="songs-header">
        <h1>Song Library</h1>
        {/* Button for Organizers to add PRIMARY songs */}
        {profile.role === 'ORGANIZER' && (
          <button onClick={() => openSongModal('createPrimary')} className="add-song-btn" disabled={isSubmittingSong}>
            + Add Primary Song
          </button>
        )}
        {/* Button for Musicians to add SECONDARY songs */}
        {profile.role === 'MUSICIAN' && (
          <button onClick={() => openSongModal('createSecondary')} className="add-song-btn" disabled={isSubmittingSong}>
            + Add My Song
          </button>
        )}
      </div>

      {error && <p className="form-error page-level-error">{error}</p>}

      {/* Section for Primary Organization Songs (Viewable by all in org) */}
      <div className="songs-section">
        <h2>Primary Organization Songs</h2>
        {renderSongList(primarySongs, "Primary Organization Songs", profile.role === 'MUSICIAN')}
      </div>

      {/* Section for Musician's Secondary Songs (Only if user is Musician) */}
      {profile.role === 'MUSICIAN' && (
        <div className="songs-section">
          <h2>My Secondary Songs</h2>
          {renderSongList(mySecondarySongs, "Your Secondary Songs")}
        </div>
      )}
      
      {profile.role === 'ORGANIZER' && profile.organization_id && (
        <div className="songs-section organizer-view-secondary">
          <h2>View & Manage Musician's Secondary Song</h2>
          <div className="form-group" style={{maxWidth: '400px', marginBottom: '20px'}}>
            <label htmlFor="select-musician-view">Select a Musician:</label>
            <select 
              id="select-musician-view" 
              value={selectedMusicianIdForOrgView}
              onChange={(e) => setSelectedMusicianIdForOrgView(e.target.value)}
            >
              <option value="">-- Select Musician --</option>
              {organizationMusicians.map(musician => (
                <option key={musician.id} value={musician.id}>
                  {musician.first_name} {musician.last_name}
                </option>
              ))}
            </select>
          </div>
          {selectedMusicianIdForOrgView && (
            renderSongList(
                viewingMusicianSecondarySongs, 
                `Selected Musician's Secondary Songs`, 
                false, // isMusicianViewingPrimaryList
                true, // isOrganizerViewingSecondaryList
                organizationMusicians.find(m => m.id === selectedMusicianIdForOrgView) // Pass selected musician's profile for context
            )
          )}
        </div>
      )}

      {/* Add/Edit Song Modal */}
      {isSongModalOpen && (
        <div className="modal-overlay" onClick={closeSongModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeSongModal}>×</button>
            <SongForm
              initialData={editingSong || {}}
              onSubmit={handleSongSubmit}
              onCancel={closeSongModal}
              isSubmitting={isSubmittingSong}
              formType={editingSong ? "Edit" : (modalMode === 'createPrimary' || modalMode === 'createSecondary' ? "Create" : "Edit")}
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default SongsPage;