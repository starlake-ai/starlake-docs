import React from 'react';
import clsx from 'clsx';
import config from './capabilities.json';
import styles from './styles.module.css';

type Props = {
  /** Heading rendered above the table. Pass null to render none. */
  heading?: React.ReactNode;
};

/**
 * What each Quack on Demand setup includes, rendered from capabilities.json.
 * The DuckDB column is what plain DuckDB serves to others, not what it can
 * read locally; see the caption.
 */
export default function QodCapabilityMatrix({
  heading = 'What each setup includes',
}: Props): JSX.Element {
  const { setups, capabilities, caption } = config;
  let lastGroup: string | null = null;

  return (
    <section className={styles.wrap}>
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
                <th key={setup.id} scope="col" className={styles.setupHead}>
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
                          className={clsx(covered && styles.yes)}
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
      <p className={styles.caption}>{caption}</p>
    </section>
  );
}
