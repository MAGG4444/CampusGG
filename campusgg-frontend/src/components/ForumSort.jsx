import { useState } from 'react'

const options = [['new', 'Newest'], ['followed', 'Most Followed']]

export default function ForumSort({ value, onChange }) {
  const [open, setOpen] = useState(false)
  return <div className="forum-sort-menu" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); event.currentTarget.querySelector('button')?.focus() } }}>
    <button className="lobby-filters-toggle forum-sort-toggle" type="button" aria-label={`Sort posts: ${options.find(([key]) => key === value)?.[1]}`} aria-expanded={open} aria-controls="forum-sort-options" onClick={() => setOpen((current) => !current)}>{options.find(([key]) => key === value)?.[1]}</button>
    {open && <div className="forum-sort-options" id="forum-sort-options" aria-label="Sort posts">{options.map(([key, label]) => <button type="button" key={key} aria-pressed={value === key} onClick={() => { onChange(key); setOpen(false) }}>{label}</button>)}</div>}
  </div>
}
