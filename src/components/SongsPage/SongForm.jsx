// src/components/SongsPage/SongForm.jsx
import React, { useState, useEffect } from 'react';
import { MUSICAL_KEYS } from '../../constants';

const SongForm = ({ initialData = {}, onSubmit, onCancel, isSubmitting, formType = "Create", songType }) => {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [chordChartUrl, setChordChartUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [defaultKey, setDefaultKey] = useState('');

  useEffect(() => {
    setTitle(initialData.title || '');
    setArtist(initialData.artist || '');
    setChordChartUrl(initialData.chord_chart_url || '');
    setYoutubeUrl(initialData.youtube_url || '');
    setDefaultKey(initialData.default_key || '');
  }, [initialData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Song title is required.");
      return;
    }
    onSubmit({
      title: title.trim(),
      artist: artist.trim() || null,
      chord_chart_url: chordChartUrl.trim() || null,
      youtube_url: youtubeUrl.trim() || null,
      default_key: songType === 'secondary' ? (defaultKey || null) : null,
    });
  };

  // Replaced "create-plan-form" with "glass-form" to match App.css styles
  return (
    <form onSubmit={handleSubmit} className="glass-form">
      <h3>{formType} {songType === 'primary' ? 'Organization' : 'Musician'} Song</h3>
      
      <div className="form-group">
        <label htmlFor="song-title">Name</label>
        <input type="text" id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting} />
      </div>

      <div className="form-group">
        <label htmlFor="song-artist">Artist</label>
        <input type="text" id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} disabled={isSubmitting}  />
      </div>

      {songType === 'secondary' && (
        <div className="form-group">
          <label htmlFor="song-default-key">Key</label>
          <select 
            id="song-default-key" 
            value={defaultKey} 
            onChange={(e) => setDefaultKey(e.target.value)} 
            disabled={isSubmitting}
          >
            <option value="">Select</option>
            {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="song-chord-chart-url">Chord Chart</label>
        <input type="url" id="song-chord-chart-url" value={chordChartUrl} onChange={(e) => setChordChartUrl(e.target.value)} disabled={isSubmitting} />
      </div>

      <div className="form-group">
        <label htmlFor="song-youtube-url">Music Video</label>
        <input type="url" id="song-youtube-url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} disabled={isSubmitting} />
      </div>

      <div className="form-actions">
        {/* Buttons now use App.css styles .submit-btn and .cancel-btn automatically inside glass-form */}
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (formType === "Edit" ? "Save Changes" : "Add Song")}
        </button>
      </div>
    </form>
  );
};

export default SongForm;