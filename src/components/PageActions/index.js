import React, {useEffect, useRef, useState} from 'react';
import {LuCheck, LuChevronDown, LuCopy, LuFileText} from 'react-icons/lu';
import {SiClaude, SiOpenai} from 'react-icons/si';
import styles from './styles.module.css';

// Fetch from the current origin: markdownUrl is absolute for crawlers and
// chat links, but a cross-origin fetch would fail on localhost and previews.
function fetchMarkdown(markdownUrl) {
  return fetch(new URL(markdownUrl).pathname).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  });
}

// Safari only allows clipboard writes inside the click handler, so the
// fetch is handed to ClipboardItem as a promise instead of awaited first.
function copyMarkdown(markdownUrl) {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    const blob = fetchMarkdown(markdownUrl).then(
      (text) => new Blob([text], {type: 'text/plain'}),
    );
    return navigator.clipboard.write([new ClipboardItem({'text/plain': blob})]);
  }
  return fetchMarkdown(markdownUrl).then((text) => navigator.clipboard.writeText(text));
}

function chatPrompt(markdownUrl) {
  return encodeURIComponent(`Read ${markdownUrl} so I can ask questions about it.`);
}

export default function PageActions({markdownUrl}) {
  const [status, setStatus] = useState('idle'); // idle | copied | error
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (status === 'idle') return undefined;
    const timer = setTimeout(() => setStatus('idle'), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const onCopy = () => {
    copyMarkdown(markdownUrl).then(
      () => setStatus('copied'),
      () => setStatus('error'),
    );
  };

  const prompt = chatPrompt(markdownUrl);
  const items = [
    {
      href: markdownUrl,
      icon: <LuFileText />,
      label: 'View as Markdown',
      hint: 'Plain text for LLMs',
    },
    {
      href: `https://chatgpt.com/?hints=search&q=${prompt}`,
      icon: <SiOpenai />,
      label: 'Open in ChatGPT',
      hint: 'Ask questions about this page',
    },
    {
      href: `https://claude.ai/new?q=${prompt}`,
      icon: <SiClaude />,
      label: 'Open in Claude',
      hint: 'Ask questions about this page',
    },
  ];

  return (
    <div className={styles.bar}>
      <div className={styles.group} ref={rootRef}>
        <button type="button" className={styles.copy} onClick={onCopy}>
          {status === 'copied' ? <LuCheck /> : <LuCopy />}
          <span aria-live="polite">
            {status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : 'Copy page'}
          </span>
        </button>
        <button
          type="button"
          className={styles.toggle}
          aria-label="More page actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}>
          <LuChevronDown />
        </button>
        {open && (
          <ul className={styles.menu} role="menu">
            {items.map((item) => (
              <li key={item.label} role="none">
                <a
                  role="menuitem"
                  className={styles.item}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}>
                  <span className={styles.icon}>{item.icon}</span>
                  <span>
                    <span className={styles.label}>{item.label}</span>
                    <span className={styles.hint}>{item.hint}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
