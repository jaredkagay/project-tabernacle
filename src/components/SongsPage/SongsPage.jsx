// src/components/SongsPage/SongsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import SongForm from './SongForm';
import './SongsPage.css';
import '../PlanPage/PlanPage.css'; // For modal styles
import { Link } from 'react-router-dom';
import { FaMusic, FaYoutube, FaPencilAlt, FaTrashAlt } from 'react-icons/fa';

const SongsPage = () => {
  const { user, profile, loading: authIsLoading } = useAuth();

  const [primarySongs, setPrimarySongs] = useState([]);
  const [mySecondarySongs, setMySecondarySongs] = useState([]);
  const [isLoadingPrimary, setIsLoadingPrimary] = useState(false);
  const [isLoadingSecondary, setIsLoadingSecondary] = useState(false);
  const [error, setError] = useState('');
  const [isSongModalOpen, setIsSongModalOpen] = useState(false);
  const [editingSong, setEditingSong] = useState(null);
  const [isSubmittingSong, setIsSubmittingSong] = useState(false);
  const [modalMode, setModalMode] = useState('createPrimary');
  const [organizationMusicians, setOrganizationMusicians] = useState([]);
  const [selectedMusicianIdForOrgView, setSelectedMusicianIdForOrgView] = useState('');
  const [viewingMusicianSecondarySongs, setViewingMusicianSecondarySongs] = useState([]);
  const [isLoadingViewingMusicianSongs, setIsLoadingViewingMusicianSongs] = useState(false);
  const [isSecondaryEditMode, setIsSecondaryEditMode] = useState(false); // New state for edit mode

  const fetchPageData = useCallback(async () => {
    if (!profile?.organization_id) {
      if (!authIsLoading) setError("You must be part of an organization to manage or view songs.");
      return;
    }

    setError('');
    setIsLoadingPrimary(true);
    if (profile.role === 'MUSICIAN') setIsLoadingSecondary(true);
    if (profile.role === 'ORGANIZER') setIsLoadingViewingMusicianSongs(true);

    const { data: primaryData, error: primaryError } = await supabase.from('songs').select('*').eq('organization_id', profile.organization_id).eq('is_primary', true).order('title', { ascending: true });
    if (primaryError) setError(prev => prev + ' ' + primaryError.message);
    setPrimarySongs(primaryData || []);
    setIsLoadingPrimary(false);

    if (profile.role === 'MUSICIAN' && user?.id) {
      const { data: secondaryData, error: secondaryError } = await supabase.from('songs').select('*').eq('organization_id', profile.organization_id).eq('added_by_user_id', user.id).eq('is_primary', false).order('title', { ascending: true });
      if (secondaryError) setError(prev => prev + ' ' + secondaryError.message);
      setMySecondarySongs(secondaryData || []);
      setIsLoadingSecondary(false);
    } else if (profile.role === 'ORGANIZER') {
      const { data: membersData, error: membersError } = await supabase.from('profiles').select('id, first_name, last_name').eq('organization_id', profile.organization_id).eq('role', 'MUSICIAN').order('last_name', {ascending: true});
      if (membersError) setError(prev => prev + ' ' + membersError.message);
      setOrganizationMusicians(membersData || []);
      setIsLoadingViewingMusicianSongs(false);
    }
  }, [user?.id, profile?.organization_id, profile?.role, authIsLoading]);

  useEffect(() => {
    if (!authIsLoading && user && profile) {
      fetchPageData();
    }
  }, [authIsLoading, user, profile, fetchPageData]);

  useEffect(() => {
    const fetchSelectedMusicianSongs = async () => {
      if (!selectedMusicianIdForOrgView || profile?.role !== 'ORGANIZER' || !profile?.organization_id) {
        setViewingMusicianSecondarySongs([]);
        return;
      }
      setIsLoadingViewingMusicianSongs(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase.from('songs').select('*').eq('organization_id', profile.organization_id).eq('added_by_user_id', selectedMusicianIdForOrgView).eq('is_primary', false).order('title', { ascending: true });
        if (fetchError) throw fetchError;
        setViewingMusicianSecondarySongs(data || []);
      } catch (err) {
        setError(err.message || "Failed to fetch selected musician's songs.");
        setViewingMusicianSecondarySongs([]);
      } finally {
        setIsLoadingViewingMusicianSongs(false);
      }
    };
    fetchSelectedMusicianSongs();
  }, [selectedMusicianIdForOrgView, profile?.organization_id, profile?.role]);

  const openSongModal = (mode, song = null) => {
    setModalMode(mode);
    setEditingSong(song);
    setIsSongModalOpen(true);
    setError('');
  };

  const closeSongModal = () => {
    setIsSongModalOpen(false);
    setEditingSong(null);
  };

  const handleSongSubmit = async (songDataFromForm) => {
    if (!profile?.organization_id || !user) throw new Error("Auth/Org info missing");
    setIsSubmittingSong(true); setError('');
    try {
      let songToUpsert = { ...songDataFromForm, organization_id: profile.organization_id, updated_at: new Date().toISOString() };
      let successMessage = '';

      if (modalMode.startsWith('edit')) {
        if (!editingSong?.id) throw new Error("Editing song ID missing");
        songToUpsert.added_by_user_id = editingSong.added_by_user_id;
        songToUpsert.is_primary = editingSong.is_primary;
        const { error } = await supabase.from('songs').update(songToUpsert).eq('id', editingSong.id);
        if (error) throw error;
        successMessage = `Song "${songDataFromForm.title}" updated successfully!`;
      } else {
        songToUpsert.added_by_user_id = user.id;
        songToUpsert.is_primary = (modalMode === 'createPrimary');
        const { error } = await supabase.from('songs').insert([songToUpsert]);
        if (error) throw error;
        successMessage = `Song "${songDataFromForm.title}" added successfully!`;
      }
      
      closeSongModal();
      alert(successMessage);
      fetchPageData();
    } catch (err) {
      setError(err.message || "Failed to save song.");
      throw err;
    } finally {
      setIsSubmittingSong(false);
    }
  };

  const handleDeleteSong = async (songId, songTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${songTitle}"? This cannot be undone.`)) return;
    setIsSubmittingSong(true); setError('');
    try {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (error) throw error;
      alert(`Song "${songTitle}" deleted.`);
      fetchPageData();
    } catch (err) {
      setError(err.message || "Failed to delete song.");
    } finally {
      setIsSubmittingSong(false);
    }
  };
  
  const getSongTypeFromMode = (mode, song) => {
    if (mode.includes('Primary')) return 'primary';
    if (mode.includes('Secondary')) return 'secondary';
    if (song?.is_primary) return 'primary';
    return 'secondary';
  };

  const renderSongList = (songsToRender, listTitle, isOrganizerViewingSpecificMusicianSecondary = false) => {
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
            if (song.is_primary) canEditOrDelete = true;
            if (isOrganizerViewingSpecificMusicianSecondary && isSecondaryEditMode) canEditOrDelete = true;
          } else if (profile.role === 'MUSICIAN') {
            if (!song.is_primary && song.added_by_user_id === user.id) canEditOrDelete = true;
          }
          const editMode = song.is_primary ? 'editPrimary' : (profile.role === 'ORGANIZER' ? 'editSecondaryByOrg' : 'editSecondary');

          return (
            <li key={song.id} className="song-item-card">
              <div className="song-info">
                <h3>{song.title}</h3>
                {song.artist && <p className="song-artist-display">{song.artist}</p>}
              </div>
              <div className="song-actions-wrapper">
                {song.chord_chart_url && <a href={song.chord_chart_url} target="_blank" rel="noopener noreferrer" className="item-action-btn link-btn" title="Chord Chart"><FaMusic /></a>}
                {song.youtube_url && <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="item-action-btn link-btn" title="YouTube Video"><FaYoutube /></a>}
                {!song.is_primary && song.default_key && (<div className="song-key-label" title={`Default Key: ${song.default_key}`}><span>{song.default_key}</span></div>)}
                {canEditOrDelete && (
                  <>
                    <button onClick={() => openSongModal(editMode, song)} className="item-action-btn edit-btn" title="Edit Song" disabled={isSubmittingSong}><FaPencilAlt /></button>
                    <button onClick={() => handleDeleteSong(song.id, song.title)} className="item-action-btn delete-btn" title="Delete Song" disabled={isSubmittingSong}><FaTrashAlt /></button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  if (authIsLoading) return <p className="page-status">Loading authentication...</p>;
  if (!profile) return <p className="page-status">Loading user profile...</p>;
  if (!profile.organization_id && !authIsLoading) {
    return (
      <div className="songs-page-container">
        <h1>Song Library</h1>
        <p className="page-status error">You must be part of an organization to view or manage songs.</p>
        <Link to="/settings" className="submit-btn" style={{marginTop: '20px'}}>Go to Settings</Link>
      </div>
    );
  }

  return (
    <div className="songs-page-container">
      <div className="songs-header">
        <h1>Song Library</h1>
        {profile.role === 'ORGANIZER' && (<button onClick={() => openSongModal('createPrimary')} className="add-song-btn" disabled={isSubmittingSong}>+ Add Primary Song</button>)}
        {profile.role === 'MUSICIAN' && (<button onClick={() => openSongModal('createSecondary')} className="add-song-btn" disabled={isSubmittingSong}>+ Add My Song</button>)}
      </div>
      {error && <p className="form-error page-level-error">{error}</p>}
      <div className="songs-section">
        <h2>Primary Organization Songs</h2>
        {renderSongList(primarySongs, "Primary Organization Songs")}
      </div>
      {profile.role === 'MUSICIAN' && (
        <div className="songs-section">
          <h2>My Secondary Songs</h2>
          {renderSongList(mySecondarySongs, "My Secondary Songs")}
        </div>
      )}
      {profile.role === 'ORGANIZER' && (
        <div className="songs-section organizer-view-secondary">
          <div className="secondary-songs-header">
            <h2>View Musician's Secondary Songs</h2>
            {selectedMusicianIdForOrgView && (
              <div className="view-mode-toggle">
                <span>Edit Mode</span>
                <label className="switch">
                  <input type="checkbox" checked={isSecondaryEditMode} onChange={() => setIsSecondaryEditMode(!isSecondaryEditMode)} />
                  <span className="slider round"></span>
                </label>
              </div>
            )}
          </div>
          <div className="form-group" style={{maxWidth: '400px', marginBottom: '20px'}}>
            <label htmlFor="select-musician-view">Select a Musician:</label>
            <select id="select-musician-view" value={selectedMusicianIdForOrgView} onChange={(e) => setSelectedMusicianIdForOrgView(e.target.value)}>
              <option value="">-- Select Musician --</option>
              {organizationMusicians.map(musician => (<option key={musician.id} value={musician.id}>{musician.first_name} {musician.last_name}</option>))}
            </select>
          </div>
          {renderSongList(viewingMusicianSecondarySongs, `Selected Musician's Secondary Songs`, true)}
        </div>
      )}
      {isSongModalOpen && (
        <div className="modal-overlay" onClick={closeSongModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeSongModal}>×</button>
            <SongForm 
              initialData={editingSong || {}} 
              onSubmit={handleSongSubmit} 
              onCancel={closeSongModal} 
              isSubmitting={isSubmittingSong} 
              formType={editingSong ? "Edit" : "Create"}
              songType={getSongTypeFromMode(modalMode, editingSong)}
            />
          </div>
        </div>
      )}
    </div>
  );
};
export default SongsPage;