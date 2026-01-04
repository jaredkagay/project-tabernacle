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

  return (
    <form onSubmit={handleSubmit} className="create-plan-form song-form">
      <h3>{formType} {songType === 'primary' ? 'Primary' : 'Secondary'} Song</h3>
      <div className="form-group">
        <label htmlFor="song-title">Title:</label>
        <input type="text" id="song-title" value={title} onChange={(e) => setTitle(e.target.value)} required disabled={isSubmitting} />
      </div>
      <div className="form-group">
        <label htmlFor="song-artist">Artist (Optional):</label>
        <input type="text" id="song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} disabled={isSubmitting} />
      </div>
      {songType === 'secondary' && (
        <div className="form-group">
          <label htmlFor="song-default-key">Ideal Key (Optional):</label>
          {/* Changed to a dropdown select */}
          <select 
            id="song-default-key" 
            value={defaultKey} 
            onChange={(e) => setDefaultKey(e.target.value)} 
            disabled={isSubmitting}
          >
            <option value="">-- Select Key --</option>
            {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
      )}
      <div className="form-group">
        <label htmlFor="song-chord-chart-url">Chord Chart URL (Optional):</label>
        <input type="url" id="song-chord-chart-url" value={chordChartUrl} onChange={(e) => setChordChartUrl(e.target.value)} placeholder="https://..." disabled={isSubmitting} />
      </div>
      <div className="form-group">
        <label htmlFor="song-youtube-url">YouTube URL (Optional):</label>
        <input type="url" id="song-youtube-url" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/..." disabled={isSubmitting} />
      </div>
      <div className="form-actions">
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : (formType === "Edit" ? "Save Changes" : "Add Song")}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default SongForm;