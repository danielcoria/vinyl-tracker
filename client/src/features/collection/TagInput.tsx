// ============================================================================
// TagInput.tsx: A BOX FOR ADDING TAGS (genres, styles)
//
// Type a tag and press Enter (or click Add, or just move to another field) to
// add it. Each tag shows as a chip with an × to remove it.
// We don't split on commas because some real genres contain them
// (Discogs has "Folk, World, & Country").
// ============================================================================

import { useState, type KeyboardEvent } from 'react';

type Props = {
  id: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  describedBy?: string;
};

export function TagInput({ id, tags, onChange, placeholder, describedBy }: Props) {
  // The text being typed, before it becomes a tag.
  const [text, setText] = useState('');

  function addTag() {
    const tag = text.trim();
    if (tag === '') return;
    const exists = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
    if (!exists) onChange([...tags, tag]);
    setText('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Without this, Enter would submit the whole form.
      event.preventDefault();
      addTag();
    }
  }

  return (
    <div className="tag-input">
      {tags.length > 0 && (
        <ul className="tags">
          {tags.map((tag) => (
            <li key={tag} className="tag">
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(tags.filter((t) => t !== tag))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="list-input-row">
        <input
          id={id}
          value={text}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addTag}
        />
        <button type="button" className="button" onClick={addTag}>
          Add
        </button>
      </div>
    </div>
  );
}
