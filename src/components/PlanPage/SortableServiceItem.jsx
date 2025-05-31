// src/components/PlanPage/SortableServiceItem.jsx
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './OrderOfService.css'; // All styles will be in this file
import { FaMusic, FaYoutube, FaBookOpen, FaPencilAlt, FaTrashAlt } from 'react-icons/fa'; // Example from Font Awesome via react-icons

const MUSICAL_KEYS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
];

export const SortableServiceItem = ({ item, index, onDelete, onEdit, assignedPeople, onUpdateKey, userRole }) => {
  const isOrganizer = userRole === 'ORGANIZER';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: !isOrganizer
  });

  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDeleteClick = (e) => { 
    e.stopPropagation(); 
    if (window.confirm(`Are you sure you want to delete "${item.title || item.type}"?`)) {
      onDelete(item.id);
    }
  };
  
  const handleEditClick = (e) => { 
    e.stopPropagation(); 
    onEdit(item); 
  };

  const handleKeyChange = (e) => { 
    e.stopPropagation(); 
    const newKey = e.target.value; 
    if (onUpdateKey) { // onUpdateKey is only passed for Organizers
        onUpdateKey(item.id, newKey === "none" ? null : newKey); 
    }
  };

  const getSingerNames = () => {
    if (item.type === 'Song' && item.assigned_singer_ids && item.assigned_singer_ids.length > 0 && assignedPeople) {
      return item.assigned_singer_ids.map(singerId => {
        const singer = assignedPeople.find(p => p.id === singerId);
        return singer ? singer.firstName : null;
      }).filter(Boolean).join(', ');
    }
    return null;
  };
  const singerNames = getSingerNames();

  const bibleReferenceText = (item.type === 'Bible Verse' && item.bible_book && item.bible_chapter && item.bible_verse_range)
    ? `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`
    : null;

  const getBibleLink = () => {
    if (bibleReferenceText) {
      return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(bibleReferenceText)}&version=NIV`;
    }
    return null;
  };
  const bibleLink = getBibleLink();

  // --- DIVIDER RENDERING ---
  if (item.type === 'Divider') {
    const displayTitle = item.title && item.title.trim() !== '' && item.title !== '---' ? item.title.trim() : null;
    return (
      <li ref={setNodeRef} style={sortableStyle} className="service-item sortable-item item-type-divider">
        <div 
          className={`divider-draggable-content ${isOrganizer ? 'is-draggable' : ''}`}
          {...(isOrganizer ? attributes : {})} // Only spread drag attributes if organizer
          {...(isOrganizer ? listeners : {})}  // Only spread drag listeners if organizer
        >
          {displayTitle ? (
            <div className="divider-layout-titled">
              <hr className="divider-line-segment" />
              <span className="divider-title-text">{displayTitle}</span>
              <hr className="divider-line-segment" />
            </div>
          ) : (
            <hr className="divider-full-line" />
          )}
        </div>
        {(onEdit || onDelete) && (
            <div className="item-actions divider-actions">
                {onEdit && <button onClick={handleEditClick} className="item-action-btn edit-btn" title="Edit Divider Text"><FaPencilAlt /></button>}
                {onDelete && <button onClick={handleDeleteClick} className="item-action-btn delete-btn" title="Delete Divider"><FaTrashAlt /></button>}
            </div>
        )}
      </li>
    );
  }

  // --- DEFAULT/SONG/BIBLE VERSE RENDERING ---
  return (
    <li ref={setNodeRef} style={sortableStyle} className={`service-item sortable-item item-type-${item.type?.toLowerCase()}`}>
      <div className="item-main-info">
        <div 
          className={`item-drag-handle ${isOrganizer ? 'is-draggable' : ''}`}
          {...(isOrganizer ? attributes : {})} // Only spread drag attributes if organizer
          {...(isOrganizer ? listeners : {})}  // Only spread drag listeners if organizer
        >
          <div className="item-content">
            <span className="item-title">
              <strong>{item.type === 'Song' || item.type === 'Generic' ? '' : (item.type === 'Bible Verse' ? '' : `${item.type}: `)}</strong>
              <strong className={item.type === 'Song' ? 'song-title' : ''}>{item.title || 'Untitled Item'}</strong>
              {item.type === 'Song' && item.artist && <em className="song-artist">- {item.artist}</em>}
              {item.type === 'Bible Verse' && bibleReferenceText && <em className="song-artist">- {bibleReferenceText}</em>}
            </span>
          </div>
        </div>
        <div className="item-actions-and-time">
          <div className="item-actions">
            {item.type === 'Song' && item.chord_chart_url && (
              <a href={item.chord_chart_url} target="_blank" rel="noopener noreferrer" className="item-action-btn link-btn" title="Chord Chart" onClick={(e) => e.stopPropagation()}>
                <FaMusic />
              </a>
            )}
            {item.type === 'Song' && item.youtube_url && (
              <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" className="item-action-btn link-btn" title="YouTube Video" onClick={(e) => e.stopPropagation()}>
                <FaYoutube />
              </a>
            )}
            {item.type === 'Bible Verse' && bibleLink && (
              <a href={bibleLink} target="_blank" rel="noopener noreferrer" className="item-action-btn link-btn bible-link-btn" title={`Read ${bibleReferenceText} on Bible Gateway`} onClick={(e) => e.stopPropagation()}>
                <FaBookOpen />
              </a>
            )}
            {item.type === 'Song' && (
              userRole === 'ORGANIZER' && onUpdateKey ? (
                <div className="song-key-selector">
                  <select value={item.musical_key || "none"} onChange={handleKeyChange} onClick={(e) => e.stopPropagation()} title="Select musical key">
                    <option value="none">Key</option>
                    {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
              ) : item.type === 'Song' && item.musical_key ? (
                <div className="song-key-label" title={`Musical Key: ${item.musical_key}`}>
                  <span>{item.musical_key}</span>
                </div>
              ) : item.type === 'Song' ? (
                  <div className="song-key-label na-key" title="Musical Key: Not Set">
                      <span>N/A</span>
                  </div>
              ) : null
            )}
            {onEdit && <button onClick={handleEditClick} className="item-action-btn edit-btn"><FaPencilAlt /></button>}
            {onDelete && <button onClick={handleDeleteClick} className="item-action-btn delete-btn"><FaTrashAlt /></button>}
          </div>
          {/* Calculated Start Timestamp - only if not a divider */}
            {item.type !== 'Divider' && item.calculatedStartTimeFormatted && (
                <span className="item-start-time">{item.calculatedStartTimeFormatted}</span>
            )}
        </div>
      </div>

      {/* Scripture Reference Subtitle (if item.title exists for a Bible Verse)
      {item.type === 'Bible Verse' && item.title && bibleReferenceText && (
        <p className="item-details general-details">{bibleReferenceText}</p>
      )} */}

      {/* General Details (for Generic items and Songs, not for Bible Verse with separate subtitle or Dividers) */}
      {(item.details && (item.type === 'Generic' || item.type === 'Song' || item.type === 'Bible Verse')) &&
        <p className="item-details general-details">{item.details}</p>
      }

      {/* Song Specific Extra Details (Singers) */}
      {item.type === 'Song' && singerNames && (
        <div className="song-extra-details item-details">
          <p>Led by <strong>{singerNames}</strong></p>
        </div>
      )}
    </li>
  );
};

export default SortableServiceItem;