// src/components/PlanPage/SortableServiceItem.js
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './OrderOfService.css'; // Ensure this has all necessary styles

const MUSICAL_KEYS = [
  'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B',
  'Am', 'A#m/Bbm', 'Bm', 'Cm', 'C#m/Dbm', 'Dm', 'D#m/Ebm', 'Em', 'Fm', 'F#m/Gbm', 'Gm', 'G#m/Abm'
];

export const SortableServiceItem = ({ item, index, onDelete, onEdit, assignedPeople, onUpdateKey }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  };

  const handleDelete = (e) => { e.stopPropagation(); if (window.confirm(`Are you sure you want to delete "${item.title || item.type}"?`)) onDelete(item.id); };
  const handleEdit = (e) => { e.stopPropagation(); onEdit(item); };
  const handleKeyChange = (e) => { e.stopPropagation(); const newKey = e.target.value; onUpdateKey(item.id, newKey === "none" ? null : newKey); };

  // Helper to find singer name
  const getSingerName = () => {
    if (item.assigned_singer_person_id && assignedPeople) {
      const singer = assignedPeople.find(p => p.id === item.assigned_singer_person_id);
      return singer ? singer.name : 'N/A';
    }
    return null;
  };

  // Helper to create Bible link
  const getBibleLink = () => {
    if (item.bible_book && item.bible_chapter && item.bible_verse_range) {
      const passage = `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`;
      return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(passage)}&version=NIV`; // Default to NIV or choose another
    }
    return null;
  };

  const bibleLink = item.type === 'Bible Verse' ? getBibleLink() : null;
  const singerName = item.type === 'Song' ? getSingerName() : null;

  // Divider specific rendering
  if (item.type === 'Divider') {
    return (
      <li ref={setNodeRef} style={style} className="service-item sortable-item item-type-divider">
        <div className="item-main-info">
          <div className="item-drag-handle divider-drag-handle" {...attributes} {...listeners}>
            <span className="divider-title">{item.title === '---' ? '' : item.title}</span>
            <hr className="divider-line" />
          </div>
          <div className="item-actions">
            <button onClick={handleEdit} className="item-action-btn edit-btn">Edit Title</button>
            <button onClick={handleDelete} className="item-action-btn delete-btn">Delete</button>
          </div>
        </div>
      </li>
    );
  }

  // Common rendering for other types
  return (
    <li ref={setNodeRef} style={style} className={`service-item sortable-item item-type-${item.type?.toLowerCase()}`}>
      <div className="item-main-info">
        <div className="item-drag-handle" {...attributes} {...listeners}>
          <span className="item-number">{index + 1}.</span>
          <div className="item-content">
            <span className="item-title">
              <strong>{item.type === 'Song' || item.type === 'Bible Verse' ? '' : `${item.type}: `}</strong>
              {item.type === 'Bible Verse' && bibleLink ? (
                <a href={bibleLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                  {item.title || `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`}
                </a>
              ) : (
                item.title
              )}
              {item.type === 'Song' && item.artist && <em className="song-artist"> - {item.artist}</em>}
            </span>
            {item.duration && <span className="item-duration"> ({item.duration})</span>}
          </div>
        </div>
        <div className="item-actions">
          {item.type === 'Song' && (
            <div className="song-key-selector">
              <select value={item.musical_key || "none"} onChange={handleKeyChange} onClick={(e) => e.stopPropagation()}>
                <option value="none">-- Key --</option>
                {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          )}
          <button onClick={handleEdit} className="item-action-btn edit-btn">Edit</button>
          <button onClick={handleDelete} className="item-action-btn delete-btn">Delete</button>
        </div>
      </div>

      {/* General Details - show if not a special type that hides it */}
      {item.details && (item.type !== 'Bible Verse') && <p className="item-details general-details">{item.details}</p>}

      {/* Song Specific Details */}
      {item.type === 'Song' && (
        <div className="song-extra-details item-details">
          {singerName && <p><strong>Singer:</strong> {singerName}</p>}
          {item.chord_chart_url && (
            <p><strong>Chord Chart:</strong> <a href={item.chord_chart_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{item.chord_chart_url}</a></p>
          )}
          {item.youtube_url && (
            <p><strong>YouTube:</strong> <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{item.youtube_url}</a></p>
          )}
        </div>
      )}

      {/* Bible Verse Specific Details (if title is separate) - already part of the main title link now */}
      {item.type === 'Bible Verse' && (
        <div className="bible-verse-details item-details">
          <p>
            <strong>Reference:</strong>&nbsp;
            {bibleLink ? (
              <a href={bibleLink} target="_blank" rel="noopener noreferrer" onClick={(e)=> e.stopPropagation()}>
                {item.bible_book} {item.bible_chapter}:{item.bible_verse_range}
              </a>
            ) : (
              `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`
            )}
          </p>
        </div>
      )}
    </li>
  );
};