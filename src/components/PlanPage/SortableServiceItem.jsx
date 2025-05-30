// src/components/PlanPage/SortableServiceItem.js
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './OrderOfService.css'; // Ensure this CSS file has all necessary styles

const MUSICAL_KEYS = [
  'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B',
  'Am', 'A#m/Bbm', 'Bm', 'Cm', 'C#m/Dbm', 'Dm', 'D#m/Ebm', 'Em', 'Fm', 'F#m/Gbm', 'Gm', 'G#m/Abm'
];

export const SortableServiceItem = ({ item, index, onDelete, onEdit, assignedPeople, onUpdateKey, userRole }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

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
    // onUpdateKey will only be defined for organizers
    if (onUpdateKey) {
        onUpdateKey(item.id, newKey === "none" ? null : newKey); 
    }
  };

  const getSingerNames = () => {
    if (item.type === 'Song' && item.assigned_singer_ids && item.assigned_singer_ids.length > 0 && assignedPeople) {
      return item.assigned_singer_ids.map(singerId => {
        const singer = assignedPeople.find(p => p.id === singerId); // p.id is user_id from event_assignments
        return singer ? singer.name : 'Unknown Singer';
      }).filter(Boolean).join(', '); // Filter out any "Unknown Singer" if ID not found, though ideally it should be.
    }
    return null;
  };

  const singerNames = getSingerNames();

  const getBibleLink = () => {
    if (item.bible_book && item.bible_chapter && item.bible_verse_range) {
      const passage = `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`;
      return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(passage)}&version=NIV`;
    }
    return null;
  };
  const bibleLink = item.type === 'Bible Verse' ? getBibleLink() : null;

// Inside SortableServiceItem.js, for item.type === 'Divider'
if (item.type === 'Divider') {
    const displayTitle = item.title && item.title.trim() !== '' && item.title !== '---' ? item.title.trim() : null;
    return (
      <li ref={setNodeRef} style={sortableStyle} // sortableStyle from useSortable
          className="service-item sortable-item item-type-divider">
        
        {/* This div is the main content for the divider, and it's draggable */}
        <div className="divider-draggable-content" {...attributes} {...listeners}>
          {displayTitle ? (
            <div className="divider-layout-titled"> {/* Contains line-text-line */}
              <hr className="divider-line-segment" />
              <span className="divider-title-text">{displayTitle}</span>
              <hr className="divider-line-segment" />
            </div>
          ) : (
            <hr className="divider-full-line" /> // Just a line if no title
          )}
        </div>

        {/* Actions for the divider (Edit Title, Delete) */}
        {(onEdit || onDelete) && (
            <div className="item-actions divider-actions">
                {onEdit && <button onClick={handleEditClick} className="item-action-btn edit-btn" title="Edit Divider Text">Edit</button>}
                {onDelete && <button onClick={handleDeleteClick} className="item-action-btn delete-btn" title="Delete Divider">Del</button>}
            </div>
        )}
      </li>
    );
  }

  return (
    <li ref={setNodeRef} style={sortableStyle} className={`service-item sortable-item item-type-${item.type?.toLowerCase()}`}>
      <div className="item-main-info">
        <div className="item-drag-handle" {...attributes} {...listeners}>
          <span className="item-number">{index + 1}.</span>
          <div className="item-content">
            <span className="item-title">
              <strong>{item.type === 'Song' || item.type === 'Bible Verse' || item.type === 'Generic' ? '' : `${item.type}: `}</strong>
              {item.type === 'Bible Verse' && bibleLink ? (
                <a href={bibleLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title={`View ${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range} on Bible Gateway`}>
                  {item.title || `${item.bible_book} ${item.bible_chapter}:${item.bible_verse_range}`}
                </a>
              ) : (
                item.title
              )}
              {item.type === 'Song' && item.artist && <em className="song-artist"> - {item.artist}</em>}
            </span>
            {(item.type !== 'Bible Verse' && item.duration) && <span className="item-duration"> ({item.duration})</span>}
          </div>
        </div>
        <div className="item-actions">
          {item.type === 'Song' && (
            userRole === 'ORGANIZER' && onUpdateKey ? ( // Organizer sees dropdown
              <div className="song-key-selector">
                <select value={item.musical_key || "none"} onChange={handleKeyChange} onClick={(e) => e.stopPropagation()} title="Select musical key">
                  <option value="none">Key</option>
                  {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
            ) : item.type === 'Song' && item.musical_key ? ( // Musician sees label
              <div className="song-key-label" title={`Musical Key: ${item.musical_key}`}>
                <span>{item.musical_key}</span>
              </div>
            ) : item.type === 'Song' ? ( // Musician sees N/A if no key
                 <div className="song-key-label" title="Musical Key: Not Set">
                    <span>N/A</span>
                 </div>
            ) : null
          )}
          {/* Conditionally show Edit/Delete based on role from PlanPage (onEdit/onDelete will be undefined for musicians) */}
          {onEdit && <button onClick={handleEditClick} className="item-action-btn edit-btn">Edit</button>}
          {onDelete && <button onClick={handleDeleteClick} className="item-action-btn delete-btn">Del</button>}
        </div>
      </div>

      {(item.details && item.type !== 'Bible Verse') && <p className="item-details general-details">{item.details}</p>}

      {item.type === 'Song' && (
        <div className="song-extra-details item-details">
          {singerNames && <p><strong>Singer(s):</strong> {singerNames}</p>}
          {item.chord_chart_url && (
            <p><strong>Chart:</strong> <a href={item.chord_chart_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{item.chord_chart_url.length > 30 ? item.chord_chart_url.substring(0, 27) + '...' : item.chord_chart_url}</a></p>
          )}
          {item.youtube_url && (
            <p><strong>Video:</strong> <a href={item.youtube_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{item.youtube_url.length > 30 ? item.youtube_url.substring(0, 27) + '...' : item.youtube_url}</a></p>
          )}
        </div>
      )}
    </li>
  );
};

export default SortableServiceItem; // If this is default export
// export { SortableServiceItem }; // Or named export