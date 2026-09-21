import React from 'react';
import clsx from 'clsx';
import config from './decision-table.json';
import styles from './styles.module.css';

type Props = {
  /** Setup id whose column is tinted green. Omit for a neutral table. */
  recommended?: string;
  /** Heading rendered above the table. Pass null to render none. */
  heading?: React.ReactNode;
};

/**
 * The capability matrix on its own, driven by the same decision-table.json as
 * the questions, so a docs page can embed it without the widget around it.
 */
export default function CapabilityMatrix({
  recommended,
  heading = 'What each setup includes',
}: Props): JSX.Element {
  const { setups, capabilities, matrixCaption } = config;
  let lastGroup: string | null = null;

  return (
    <section className={clsx(styles.wrap, styles.matrix)}>
      {heading ? <h2 className={styles.matrixTitle}>{heading}</h2> : null}
      <div
        className={styles.scroller}
        role="region"
        aria-label="Capability matrix"
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col" className={styles.capHead}>
                Capability
              </th>
              {setups.map((setup) => (
                <th
                  key={setup.id}
                  scope="col"
                  className={clsx(
                    styles.setupHead,
                    setup.id === recommended && styles.recommendedHead,
                  )}
                >
                  {setup.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {capabilities.map((capability) => {
              const groupRow = capability.group !== lastGroup ? capability.group : null;
              lastGroup = capability.group;
              return (
                <React.Fragment key={capability.id}>
                  {groupRow ? (
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={setups.length + 1}
                        className={styles.groupCell}
                      >
                        {groupRow}
                      </th>
                    </tr>
                  ) : null}
                  <tr>
                    <th scope="row" className={styles.capCell}>
                      {capability.label}
                    </th>
                    {setups.map((setup) => {
                      const covered = capability.coveredBy.includes(setup.id);
                      return (
                        <td
                          key={setup.id}
                          aria-label={covered ? 'covered' : 'not covered'}
                          className={clsx(
                            setup.id === recommended && styles.recommended,
                            covered && styles.yes,
                          )}
                        >
                          {covered ? '✓' : ''}
                        </td>
                      );
                    })}
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.caption}>{matrixCaption}</p>
    </section>
  );
}
