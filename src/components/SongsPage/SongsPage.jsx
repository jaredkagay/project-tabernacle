// src/components/SongsPage/SongsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../supabaseClient';
import SongForm from './SongForm';
import { Link } from 'react-router-dom';
import { FaMusic, FaYoutube, FaPencilAlt, FaTrashAlt, FaPlus, FaSearch } from 'react-icons/fa';
import { logActivity } from '../../utils/activityLogger';
import './SongsPage.css';

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
  const [isSecondaryEditMode, setIsSecondaryEditMode] = useState(false);

  // Search Filter State
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    document.title = 'tabernacle - Songs';
  }, []);

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
      }
      
      closeSongModal();
      logActivity(user, profile, 'SONG_ADDED', `${profile.first_name} added a new song: ${songDataFromForm.title}`);
      fetchPageData();
    } catch (err) {
      setError(err.message || "Failed to save song.");
      throw err;
    } finally {
      setIsSubmittingSong(false);
    }
  };

  const handleDeleteSong = async (songId, songTitle, isPrimary) => {
    if (!window.confirm(`Are you sure you want to delete "${songTitle}"? This cannot be undone.`)) return;
    setIsSubmittingSong(true); setError('');
    try {
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      if (error) throw error;
      
      if (isPrimary) {
        setPrimarySongs(prev => prev.filter(s => s.id !== songId));
      } else {
        if (profile.role === 'MUSICIAN') {
          setMySecondarySongs(prev => prev.filter(s => s.id !== songId));
        } else if (profile.role === 'ORGANIZER') {
          setViewingMusicianSecondarySongs(prev => prev.filter(s => s.id !== songId));
        }
      }
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

  const filterSongs = (songs) => {
      if(!searchTerm) return songs;
      return songs.filter(s => 
          s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
          (s.artist && s.artist.toLowerCase().includes(searchTerm.toLowerCase()))
      );
  }

  const renderSongList = (songsToRenderRaw, listTitle, isOrganizerViewingSpecificMusicianSecondary = false) => {
    let isLoadingState = false;
    if (listTitle.includes("Primary")) isLoadingState = isLoadingPrimary;
    else if (listTitle.includes("My Secondary")) isLoadingState = isLoadingSecondary;
    else if (listTitle.includes("Selected Musician")) isLoadingState = isLoadingViewingMusicianSongs;

    if (isLoadingState) return <div className="loading-spinner">Loading...</div>;

    const songsToRender = filterSongs(songsToRenderRaw);

    if (songsToRender.length === 0) {
      if (listTitle.includes("Selected Musician") && !selectedMusicianIdForOrgView && profile.role === 'ORGANIZER') 
          return <div className="empty-list-state">Select a musician above to view their song requests.</div>;
      if (searchTerm) return <div className="empty-list-state">No songs match your search.</div>;
      return <div className="empty-list-state">No songs in this collection yet.</div>;
    }

    return (
      <div className="glass-songs-grid">
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
            <div key={song.id} className="song-card-glass">
              <div className="song-card-main">
                <div className="song-info">
                  <h3>{song.title}</h3>
                  {song.artist && <p className="song-artist">{song.artist}</p>}
                </div>
              </div>
              
              <div className="song-card-footer">
                <div className="song-badges">
                    {!song.is_primary && song.default_key && (
                        <span className="key-badge" title="Default Key">{song.default_key}</span>
                    )}
                </div>
                <div className="song-actions">
                    {song.chord_chart_url && (
                        <a href={song.chord_chart_url} target="_blank" rel="noopener noreferrer" className="action-icon-btn link" title="Chord Chart">
                            <FaMusic />
                        </a>
                    )}
                    {song.youtube_url && (
                        <a href={song.youtube_url} target="_blank" rel="noopener noreferrer" className="action-icon-btn youtube" title="YouTube Video">
                            <FaYoutube />
                        </a>
                    )}
                    
                    {canEditOrDelete && (
                    <>
                        <div className="divider-vertical"></div>
                        <button onClick={() => openSongModal(editMode, song)} className="action-icon-btn edit" title="Edit">
                            <FaPencilAlt />
                        </button>
                        <button onClick={() => handleDeleteSong(song.id, song.title, song.is_primary)} className="action-icon-btn delete" title="Delete">
                            <FaTrashAlt />
                        </button>
                    </>
                    )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (authIsLoading) return <p className="page-status">Loading authentication...</p>;
  if (!profile) return <p className="page-status">Loading user profile...</p>;
  if (!profile.organization_id && !authIsLoading) {
    return (
      <div className="songs-page-wrapper">
        <div className="songs-content-container">
            <div className="glass-panel error-panel">
                <h1>Song Library</h1>
                <p>You must be part of an organization to view or manage songs.</p>
                <Link to="/settings" className="submit-btn" style={{marginTop: '20px', display: 'inline-block'}}>Go to Settings</Link>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="songs-page-wrapper">
      <div className="songs-content-container">
        
        {/* Header Section */}
        <div className="songs-page-header">
            <div className="header-left">
                <h1>Song Library</h1>
                <p>Manage your musical repertoire.</p>
            </div>
            <div className="header-actions">
                 {/* Search Input */}
                 <div className="glass-search-wrapper">
                    <FaSearch className="search-icon"/>
                    <input 
                        type="text" 
                        placeholder="Search songs..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>

                {profile.role === 'ORGANIZER' && (
                    <button onClick={() => openSongModal('createPrimary')} className="glass-add-btn">
                        Add Organization Song
                    </button>
                )}
                {profile.role === 'MUSICIAN' && (
                    <button onClick={() => openSongModal('createSecondary')} className="glass-add-btn">
                        Add Song Request
                    </button>
                )}
            </div>
        </div>

        {error && <div className="form-error page-level-error">{error}</div>}

        {/* Primary Songs Panel */}
        <div className="glass-panel">
            <div className="panel-header-simple">
                <h2>Organization Songs</h2>
                <span className="count-badge-glass">{primarySongs.length}</span>
            </div>
            {renderSongList(primarySongs, "Primary Organization Songs")}
        </div>

        {/* Musician's Personal Songs Panel */}
        {profile.role === 'MUSICIAN' && (
          <div className="glass-panel">
            <div className="panel-header-simple">
                <h2>My Song Requests</h2>
                <span className="count-badge-glass">{mySecondarySongs.length}</span>
            </div>
            {renderSongList(mySecondarySongs, "My Songs Requests")}
          </div>
        )}

        {/* Organizer View of Musician Songs */}
        {profile.role === 'ORGANIZER' && (
          <div className="glass-panel organizer-view-panel">
            <div className="panel-header-complex">
                <h2>Musician Songs</h2>
                
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
            
            <div className="musician-select-wrapper">
                <select 
                    id="select-musician-view" 
                    value={selectedMusicianIdForOrgView} 
                    onChange={(e) => setSelectedMusicianIdForOrgView(e.target.value)}
                    className="glass-select"
                >
                <option value="">Select</option>
                {organizationMusicians.map(musician => (
                    <option key={musician.id} value={musician.id}>{musician.first_name} {musician.last_name}</option>
                ))}
                </select>
            </div>
            {renderSongList(viewingMusicianSecondarySongs, `Selected Musician's Songs`, true)}
          </div>
        )}

      </div>

      {/* Modal - utilizing global glass styling */}
      {isSongModalOpen && (
        <div className="modal-overlay-glass" onClick={closeSongModal}>
          <div className="modal-content-glass" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-icon" onClick={closeSongModal}>×</button>
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