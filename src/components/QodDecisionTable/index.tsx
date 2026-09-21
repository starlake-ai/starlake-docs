import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import config from './decision-table.json';
import { decide, defaultAnswers, readAnswers, toQuery } from './decide.mjs';
import CapabilityMatrix from './CapabilityMatrix';
import styles from './styles.module.css';

type Answers = Record<string, string>;

const DEFAULTS: Answers = defaultAnswers(config);

/** Best effort copy: the async API where it exists, a hidden textarea otherwise. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // falls through to the textarea below
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function track(event: string, props: Record<string, unknown>): void {
  const gtag = (window as any).gtag;
  if (typeof gtag === 'function') {
    gtag('event', event, props);
  }
}

function CopyButton({
  label,
  value,
  className,
  onCopied,
}: {
  label: string;
  value: string;
  className: string;
  onCopied?: () => void;
}): JSX.Element {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const timer = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(timer);
  }, [done]);
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        if (await copyText(value)) {
          setDone(true);
          onCopied?.();
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  );
}

/**
 * Five questions, one recommended setup, and the capability matrix underneath.
 * All logic is client side: see decide.mjs and decision-table.json.
 */
export default function QodDecisionTable(): JSX.Element {
  const [answers, setAnswers] = useState<Answers>(DEFAULTS);
  const hydrated = useRef(false);

  // Read the shared link on first paint. Rendering the defaults server side
  // keeps the markup stable for hydration.
  useEffect(() => {
    const fromUrl = readAnswers(config, window.location.search);
    hydrated.current = true;
    setAnswers(fromUrl);
  }, []);

  const verdict = decide(config, answers);
  const setup = config.setups.find((s) => s.id === verdict.setup)!;

  // Keep the query string in step, without stacking history entries.
  useEffect(() => {
    if (!hydrated.current) return;
    const url = `${window.location.pathname}?${toQuery(answers)}`;
    window.history.replaceState(null, '', url);
  }, [answers]);

  // One analytics event per settled verdict, debounced.
  useEffect(() => {
    if (!hydrated.current) return undefined;
    const timer = setTimeout(
      () => track('qod_choose_verdict', { setup: verdict.setup, ...answers }),
      1000,
    );
    return () => clearTimeout(timer);
  }, [answers, verdict.setup]);

  // Flash the card border when the answer changes. The element itself stays
  // mounted so the aria-live region keeps announcing.
  const [flash, setFlash] = useState(false);
  const previousSetup = useRef(verdict.setup);
  useEffect(() => {
    if (previousSetup.current === verdict.setup) return undefined;
    previousSetup.current = verdict.setup;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 500);
    return () => clearTimeout(timer);
  }, [verdict.setup]);

  const pick = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }, []);

  const shareUrl =
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}${window.location.pathname}?${toQuery(answers)}`;

  return (
    <div className={styles.wrap}>
      <div className={styles.top}>
        <form className={styles.questions}>
          {config.questions.map((question, index) => (
            <fieldset key={question.id} className={styles.question}>
              <legend className={styles.legend}>
                <span className={styles.num}>{index + 1}.</span>
                {question.label}
              </legend>
              <div className={styles.pills}>
                {question.options.map((option) => {
                  const checked = answers[question.id] === option.id;
                  return (
                    <label
                      key={option.id}
                      className={clsx(styles.pill, checked && styles.pillOn)}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option.id}
                        checked={checked}
                        onChange={() => pick(question.id, option.id)}
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}
          <p className={styles.reset}>
            <button
              type="button"
              className={styles.resetLink}
              onClick={() => setAnswers(DEFAULTS)}
            >
              Start over
            </button>
          </p>
        </form>

        <div className={styles.verdictCol}>
          <div
            className={clsx(styles.verdict, flash && styles.verdictFlash)}
            aria-live="polite"
          >
            <p className={styles.verdictKicker}>Recommended setup</p>
            <h2 className={styles.verdictTitle}>{setup.title}</h2>
            <p className={styles.verdictBody}>{setup.body}</p>

            <div className={styles.commands}>
              {setup.commands.map((command, i) => (
                <div key={command} className={styles.command}>
                  <pre className={styles.commandText}>
                    <code>{command}</code>
                  </pre>
                  <CopyButton
                    label="Copy"
                    value={command}
                    className={styles.copyBtn}
                    onCopied={() =>
                      track('qod_choose_copy_command', {
                        setup: verdict.setup,
                        command_index: i,
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <p className={styles.reason}>{verdict.reason}</p>

            {verdict.notes.length > 0 && (
              <ul className={styles.notes}>
                {verdict.notes.map((note) => (
                  <li key={note.id} className={styles.note}>
                    {note.text}
                  </li>
                ))}
              </ul>
            )}

            <div className={styles.verdictFoot}>
              <Link to={setup.link.to}>{setup.link.label}</Link>
              <CopyButton
                label="Copy link to this answer"
                value={shareUrl}
                className={styles.linkBtn}
              />
            </div>
          </div>
        </div>
      </div>

      <CapabilityMatrix recommended={verdict.setup} />
    </div>
  );
}
