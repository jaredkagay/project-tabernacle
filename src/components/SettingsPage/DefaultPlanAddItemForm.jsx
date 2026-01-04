import React, { useState, useEffect } from 'react';

const DefaultPlanAddItemForm = ({ onAddItem }) => {
  const [type, setType] = useState('Generic');
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');

  // Reset fields when type changes
  useEffect(() => {
    setTitle('');
    setDuration('');
    
    if (type === 'Divider') {
        setTitle('---');
    }
  }, [type]);

  const handleSubmit = (e) => {
    e.preventDefault();

    let finalTitle = title.trim();
    let finalDuration = duration.trim();

    // Apply constraints
    if (type === 'Song') {
        finalTitle = 'Worship Song';
        finalDuration = '3 min';
    } else if (type === 'Bible Verse') {
        finalTitle = 'Scripture Reading';
        finalDuration = '1 min';
    }

    if (!finalTitle && type !== 'Divider') {
      alert('Please enter a title.');
      return;
    }

    const newItem = {
      type,
      title: finalTitle,
      duration: type === 'Divider' ? null : (finalDuration || null),
      // All other fields null
      details: null, artist: null, chord_chart_url: null, youtube_url: null, 
      assigned_singer_ids: [], musical_key: null, 
      bible_book: null, bible_chapter: null, bible_verse_range: null
    };

    onAddItem(newItem);
    setTitle('');
    setDuration('');
  };

  return (
    <form onSubmit={handleSubmit} className="add-item-form">
      <h3>Add Template Item</h3>
      <div className="form-group">
        <label>Type:</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="Generic">Service Item (Generic)</option>
          <option value="Song">Song (Template)</option>
          <option value="Bible Verse">Bible Verse (Template)</option>
          <option value="Divider">Divider</option>
        </select>
      </div>

      {(type === 'Generic') && (
        <>
            <div className="form-group">
                <label>Title:</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="form-group">
                <label>Duration:</label>
                <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="e.g. 5 min" />
            </div>
        </>
      )}

      {type === 'Divider' && (
        <div className="form-group">
            <label>Divider Title:</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      )}

      {(type === 'Song' || type === 'Bible Verse') && (
          <p className="form-help-text">
              {type} items in the default plan are placeholders. 
              {type === 'Song' ? ' Duration defaults to 3 min.' : ' Duration defaults to 1 min.'}
          </p>
      )}

      <div className="form-actions">
        <button type="submit" className="submit-btn">Add Item</button>
      </div>
    </form>
  );
};

export default DefaultPlanAddItemForm;