import Layout from '@theme/Layout';
import React, { useEffect, useState } from 'react';
import { FaArrowLeft, FaArrowRight, FaRegStar, FaStar } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import styles from './quick-start.module.css';

import quickstartData from '../data/quickstart-data.json';

export default function QuickStart() {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [filteredQuickstarts, setFilteredQuickstarts] = useState(quickstartData.quickstarts);
  const [currentView, setCurrentView] = useState('list'); 
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);

  const getQuickstartId = () => {
    const path = window.location.pathname;
    const match = path.match(/\/quick-start\/(.+)$/);
    return match ? match[1] : null;
  };

  const getCurrentStep = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const step = urlParams.get('step');
    return step ? parseInt(step) : 1;
  };

  const updateURL = (step) => {
    if (selectedGuide) {
      const url = new URL(window.location);
      url.searchParams.set('step', step.toString());
      window.history.pushState({}, '', url);
    }
  };

  useEffect(() => {
    const savedFavorites = localStorage.getItem('quickstart-favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('quickstart-favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    const id = getQuickstartId();
    if (id) {
      const guide = quickstartData.quickstarts.find(q => q.id === id);
      if (guide) {
        setSelectedGuide(guide);
        setCurrentView('guide');
        const step = getCurrentStep();
        setCurrentStep(step);
      } else {
        setCurrentView('list');
      }
    } else {
      setCurrentView('list');
    }
  }, []);

  useEffect(() => {
    if (selectedCategories.length === 0) {
      setFilteredQuickstarts(quickstartData.quickstarts);
    } else {
      const filtered = quickstartData.quickstarts.filter(quickstart =>
        quickstart.categories.some(category => selectedCategories.includes(category))
      );
      setFilteredQuickstarts(filtered);
    }
  }, [selectedCategories]);

  useEffect(() => {
    if (selectedGuide && currentView === 'guide') {
      updateURL(currentStep);
    }
  }, [currentStep, selectedGuide, currentView]);

  const toggleCategory = (category) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category]
    );
  };

  const toggleFavorite = (id) => {
    setFavorites(prev =>
      prev.includes(id)
        ? prev.filter(favId => favId !== id)
        : [...prev, id]
    );
  };

  const handleStartAction = (quickstart) => {
    setSelectedGuide(quickstart);
    setCurrentView('guide');
    setCurrentStep(1);
    const url = new URL(window.location);
    url.pathname = `/quick-start/${quickstart.id}`;
    url.searchParams.set('step', '1');
    window.history.pushState({}, '', url);
  };

  const goBackToList = () => {
    setCurrentView('list');
    setSelectedGuide(null);
    setCurrentStep(1);
    const url = new URL(window.location);
    url.pathname = '/quick-start';
    url.searchParams.delete('step');
    window.history.pushState({}, '', url);
  };

  const goToStep = (step) => {
    if (selectedGuide && step >= 1 && step <= selectedGuide.tabs.length) {
      setCurrentStep(step);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  };

  const goToNextStep = () => {
    if (selectedGuide && currentStep < selectedGuide.tabs.length) {
      goToStep(currentStep + 1);
    }
  };

  const renderListingView = () => (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <h3 className={styles.filterTitle}>Filter by</h3>
        
        <div className={styles.filterSection}>
          <h4 className={styles.filterSectionTitle}>Choose a category</h4>
          <div className={styles.filterOptions}>
            {quickstartData.categories.map(category => (
              <label key={category} className={styles.filterOption}>
                <input
                  type="checkbox"
                  checked={selectedCategories.includes(category)}
                  onChange={() => toggleCategory(category)}
                  className={styles.checkbox}
                />
                <span className={styles.checkboxLabel}>{category}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.content}>
        {favorites.length > 0 && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Favorites</h2>
            <div className={styles.cardGrid}>
              {filteredQuickstarts
                .filter(quickstart => favorites.includes(quickstart.id))
                .map(quickstart => (
                  <QuickstartCard
                    key={quickstart.id}
                    quickstart={quickstart}
                    isFavorite={favorites.includes(quickstart.id)}
                    onToggleFavorite={toggleFavorite}
                    onStartAction={handleStartAction}
                  />
                ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            {favorites.length > 0 ? 'Guides' : 'Guides'}
          </h2>
          <div className={styles.cardGrid}>
            {filteredQuickstarts.map(quickstart => (
              <QuickstartCard
                key={quickstart.id}
                quickstart={quickstart}
                isFavorite={favorites.includes(quickstart.id)}
                onToggleFavorite={toggleFavorite}
                onStartAction={handleStartAction}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGuideView = () => {
    if (!selectedGuide) return null;

    const currentTab = selectedGuide.tabs.find(tab => tab.id === currentStep);
    const isFavorite = favorites.includes(selectedGuide.id);

    return (
      <div className={styles.guideContainer}>
        <div className={styles.guideHeader}>
          <div className={styles.guideHeaderLeft}>
            <button onClick={goBackToList} className={styles.backLink}>
              ← Back to guides
            </button>
            <div className={styles.tags}>
              {selectedGuide.tags.slice(0, 3).map(tag => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => toggleFavorite(selectedGuide.id)}
            className={styles.favoriteButton}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? (
              <FaStar className={styles.favoriteIcon} />
            ) : (
              <FaRegStar className={styles.favoriteIcon} />
            )}
          </button>
        </div>

        <div className={styles.guideContent}>
          <div className={styles.guideSidebar}>
            <h1 className={styles.guideTitle}>{selectedGuide.title}</h1>
            <div className={styles.tabs}>
              {selectedGuide.tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => goToStep(tab.id)}
                  className={`${styles.tab} ${currentStep === tab.id ? styles.activeTab : ''}`}
                >
                  <span className={styles.tabNumber}>{tab.id}</span>
                  <span className={styles.tabLabel}>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.stepContent}>
            {currentTab && (
              <>
                <div className={styles.stepHeader}>
                  <h2 className={styles.stepTitle}>{currentTab.label}</h2>
                  <div className={styles.stepIndicator}>
                    Step {currentStep} of {selectedGuide.tabs.length}
                  </div>
                </div>
                
                <div className={styles.stepBody}>
                  <ReactMarkdown>{currentTab.content}</ReactMarkdown>
                </div>

                <div className={styles.navigation}>
                  <button
                    onClick={goToPreviousStep}
                    disabled={currentStep === 1}
                    className={`${styles.navButton} ${styles.prevButton}`}
                  >
                    <FaArrowLeft /> Back
                  </button>
                  
                  <button
                    onClick={goToNextStep}
                    disabled={currentStep === selectedGuide.tabs.length}
                    className={`${styles.navButton} ${styles.nextButton}`}
                  >
                    Next <FaArrowRight />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout
      title={currentView === 'guide' && selectedGuide ? `${selectedGuide.title} - Quick Start Guide` : "Quick Start"}
      description={currentView === 'guide' && selectedGuide ? selectedGuide.description : "Get started with Starlake quickly"}>
      <main className={styles.main}>
        {currentView === 'list' ? renderListingView() : renderGuideView()}
      </main>
    </Layout>
  );
}

function QuickstartCard({ quickstart, isFavorite, onToggleFavorite, onStartAction }) {
  const handleCardClick = () => {
    onStartAction(quickstart);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onToggleFavorite(quickstart.id);
  };

  return (
    <div className={styles.card} onClick={handleCardClick}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <img 
            src={quickstart.icon} 
            alt={`${quickstart.title} icon`}
            width="32"
            height="32"
          />
        </div>
        <button
          onClick={handleFavoriteClick}
          className={styles.favoriteButton}
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorite ? (
            <FaStar className={styles.favoriteIcon} />
          ) : (
            <FaRegStar className={styles.favoriteIcon} />
          )}
        </button>
      </div>
      
      <div className={styles.cardContent}>
        <h3 className={styles.cardTitle}>{quickstart.title}</h3>
        <p className={styles.cardDescription}>{quickstart.description}</p>
        <p className={styles.cardSummary}>{quickstart.summary}</p>
      </div>
      
      <div className={styles.cardFooter}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartAction(quickstart);
          }}
          className={styles.startButton}
        >
          Start
        </button>
      </div>
    </div>
  );
}
