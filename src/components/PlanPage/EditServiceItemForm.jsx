// src/components/PlanPage/EditServiceItemForm.jsx
import React, { useState, useEffect } from 'react';
import './AddItemForm.css'; // Reusing styles, or create EditServiceItemForm.css

const EditServiceItemForm = ({ itemToEdit, onUpdateItem, onCancel, assignedPeople }) => {
  // Common fields
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [details, setDetails] = useState('');

  // Song-specific fields
  const [artist, setArtist] = useState('');
  const [chordChartUrl, setChordChartUrl] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedSingerId, setSelectedSingerId] = useState('');

  // Bible Verse-specific fields
  const [bibleBook, setBibleBook] = useState('');
  const [bibleChapter, setBibleChapter] = useState('');
  const [bibleVerseRange, setBibleVerseRange] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (itemToEdit) {
      setTitle(itemToEdit.title || (itemToEdit.type === 'Divider' ? '---' : ''));
      setDuration(itemToEdit.duration || '');
      setDetails(itemToEdit.details || '');

      // Populate type-specific fields
      setArtist(itemToEdit.type === 'Song' ? itemToEdit.artist || '' : '');
      setChordChartUrl(itemToEdit.type === 'Song' ? itemToEdit.chord_chart_url || '' : '');
      setYoutubeUrl(itemToEdit.type === 'Song' ? itemToEdit.youtube_url || '' : '');
      setSelectedSingerId(itemToEdit.type === 'Song' ? itemToEdit.assigned_singer_person_id || '' : '');

      setBibleBook(itemToEdit.type === 'Bible Verse' ? itemToEdit.bible_book || '' : '');
      setBibleChapter(itemToEdit.type === 'Bible Verse' ? itemToEdit.bible_chapter || '' : '');
      setBibleVerseRange(itemToEdit.type === 'Bible Verse' ? itemToEdit.bible_verse_range || '' : '');
    }
  }, [itemToEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (itemToEdit.type !== 'Divider' && !title.trim()) {
      alert('Please enter a title for the item.');
      return;
    }
    if (itemToEdit.type === 'Bible Verse' && (!bibleBook.trim() || !bibleChapter.trim() || !bibleVerseRange.trim())) {
      alert('Please fill in Book, Chapter, and Verse(s) for a Bible Verse item.');
      return;
    }
    setIsSubmitting(true);

    let payload = {
      // Common fields
      title: itemToEdit.type === 'Divider' ? (title.trim() || '---') : title.trim(),
      duration: itemToEdit.type === 'Divider' || itemToEdit.type === 'Bible Verse' ? null : duration.trim() || null,
      details: itemToEdit.type === 'Divider' || itemToEdit.type === 'Bible Verse' ? null : details.trim() || null,

      // Type-specific fields, ensure they are nulled out if not applicable to current item.type
      artist: itemToEdit.type === 'Song' ? (artist.trim() || null) : null,
      chord_chart_url: itemToEdit.type === 'Song' ? (chordChartUrl.trim() || null) : null,
      youtube_url: itemToEdit.type === 'Song' ? (youtubeUrl.trim() || null) : null,
      assigned_singer_person_id: itemToEdit.type === 'Song' ? (selectedSingerId || null) : null,
      
      bible_book: itemToEdit.type === 'Bible Verse' ? (bibleBook.trim() || null) : null,
      bible_chapter: itemToEdit.type === 'Bible Verse' ? (bibleChapter.trim() || null) : null,
      bible_verse_range: itemToEdit.type === 'Bible Verse' ? (bibleVerseRange.trim() || null) : null,

      // Preserve existing musical_key as it's edited inline, and other fields not in this form
      musical_key: itemToEdit.musical_key,
      type: itemToEdit.type, // Type is not changed here
      event_id: itemToEdit.event_id, // Preserve original event_id
      sequence_number: itemToEdit.sequence_number, // Preserve original sequence_number
    };

    try {
      await onUpdateItem(payload); // onUpdateItem in PlanPage receives this payload
    } catch (error) {
      // Error alert is typically handled by the calling component (PlanPage)
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!itemToEdit) return null;

  const showTitleInput = itemToEdit.type !== 'Divider';
  const showDurationAndDetails = itemToEdit.type !== 'Divider' && itemToEdit.type !== 'Bible Verse';

  return (
    <form onSubmit={handleSubmit} className="add-item-form edit-item-form">
      <h3>Edit: {itemToEdit.title || itemToEdit.type}</h3>
      <p style={{ marginBottom: '15px', color: '#555', fontSize: '0.9em' }}>
        Type: <strong>{itemToEdit.type}</strong> (Cannot be changed during edit)
      </p>

      {showTitleInput && (
        <div className="form-group">
          <label htmlFor="edit-item-title">
            {itemToEdit.type === 'Song' ? 'Song Title:' : 
            (itemToEdit.type === 'Bible Verse' ? 'Reading Title (e.g., Gospel Reading, optional):' : 'Title:')}
          </label>
          <input type="text" id="edit-item-title" value={title} onChange={(e) => setTitle(e.target.value)} required={itemToEdit.type !== 'Bible Verse'}/>
        </div>
      )}
      {itemToEdit.type === 'Divider' && (
         <div className="form-group">
            <label htmlFor="edit-item-title">Divider Text (Optional):</label>
            <input type="text" id="edit-item-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., ---, Transition"/>
        </div>
      )}

      {itemToEdit.type === 'Song' && (
        <>
          <div className="form-group">
            <label htmlFor="edit-song-artist">Artist:</label>
            <input type="text" id="edit-song-artist" value={artist} onChange={(e) => setArtist(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="edit-song-chord-chart">Chord Chart URL:</label>
            <input type="url" id="edit-song-chord-chart" value={chordChartUrl} onChange={(e) => setChordChartUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="edit-song-youtube">YouTube URL:</label>
            <input type="url" id="edit-song-youtube" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="edit-song-singer">Assign Singer:</label>
            <select id="edit-song-singer" value={selectedSingerId} onChange={(e) => setSelectedSingerId(e.target.value)}>
              <option value="">-- Select a singer --</option>
              {assignedPeople && assignedPeople.map(person => (
                <option key={person.id} value={person.id}>
                  {person.name} ({person.role})
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {itemToEdit.type === 'Bible Verse' && (
        <>
          <div className="form-group">
            <label htmlFor="edit-bible-book">Book:</label>
            <input type="text" id="edit-bible-book" value={bibleBook} onChange={(e) => setBibleBook(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="edit-bible-chapter">Chapter:</label>
            <input type="text" id="edit-bible-chapter" value={bibleChapter} onChange={(e) => setBibleChapter(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="edit-bible-verse-range">Verse(s):</label>
            <input type="text" id="edit-bible-verse-range" value={bibleVerseRange} onChange={(e) => setBibleVerseRange(e.target.value)} required />
          </div>
        </>
      )}

      {showDurationAndDetails && (
        <>
          <div className="form-group">
            <label htmlFor="edit-item-duration">Duration (optional):</label>
            <input type="text" id="edit-item-duration" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="form-group">
            <label htmlFor="edit-item-details">Details (optional):</label>
            <textarea id="edit-item-details" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
        </>
      )}

      <div className="form-actions" style={{ marginTop: '20px' }}>
        <button type="submit" className="submit-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save Changes'}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </button>
      </div>
    </form>
  );
};

export default EditServiceItemForm;