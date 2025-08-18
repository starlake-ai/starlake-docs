import Layout from '@theme/Layout';
import React, { useEffect, useState } from 'react';
import { FaArrowLeft, FaArrowRight, FaRegStar, FaStar } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import { useHistory, useLocation } from '@docusaurus/router';
import styles from './guides.module.css';

import guidesData from '../data/guides-data.json';

export default function Guides() {
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [filteredGuides, setFilteredGuides] = useState(guidesData.guides);
  const [currentView, setCurrentView] = useState('list');
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const history = useHistory();
  const location = useLocation();



  useEffect(() => {
    const savedFavorites = localStorage.getItem('guides-favorites');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('guides-favorites', JSON.stringify(favorites));
  }, [favorites]);

  // Parse URL parameters on component mount
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const guideId = urlParams.get('guide');
    const step = urlParams.get('step');
    
    if (guideId) {
      const guide = guidesData.guides.find(g => g.id === guideId);
      if (guide) {
        setSelectedGuide(guide);
        setCurrentView('guide');
        setCurrentStep(step ? parseInt(step) : 1);
        return;
      }
    }
    
    setCurrentView('list');
    setSelectedGuide(null);
    setCurrentStep(1);
  }, [location.search]);

  useEffect(() => {
    if (selectedCategories.length === 0) {
        setFilteredGuides(guidesData.guides);
    } else {
      const filtered = guidesData.guides.filter(guide =>
        guide.categories.some(category => selectedCategories.includes(category))
      );
      setFilteredGuides(filtered);
    }
  }, [selectedCategories]);

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

  const handleStartAction = (guide) => {
    setSelectedGuide(guide);
    setCurrentView('guide');
    setCurrentStep(1);
    history.push(`/guides?guide=${guide.id}&step=1`);
  };

  const goBackToList = () => {
    setCurrentView('list');
    setSelectedGuide(null);
    setCurrentStep(1);
    history.push('/guides');
  };

  const goToStep = (step) => {
    if (selectedGuide && step >= 1 && step <= selectedGuide.tabs.length) {
      setCurrentStep(step);
      history.push(`/guides?guide=${selectedGuide.id}&step=${step}`);
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
            {guidesData.categories.map(category => (
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
                  {filteredGuides
                .filter(guide => favorites.includes(guide.id))
                .map(guide => (
                  <GuideCard
                    key={guide.id}
                    guide={guide}
                    isFavorite={favorites.includes(guide.id)}
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
            {filteredGuides.map(guide => (
              <GuideCard  
                key={guide.id}
                guide={guide}
                isFavorite={favorites.includes(guide.id)}
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
      title={currentView === 'guide' && selectedGuide ? `${selectedGuide.title} - Guide` : "Guides"}
      description={currentView === 'guide' && selectedGuide ? selectedGuide.description : "Get started with Starlake guides"}>
      <main className={styles.main}>
        {currentView === 'list' ? renderListingView() : renderGuideView()}
      </main>
    </Layout>
  );
}

function GuideCard({ guide, isFavorite, onToggleFavorite, onStartAction }) {
  const handleCardClick = () => {
    onStartAction(guide);
  };

  const handleFavoriteClick = (e) => {
    e.stopPropagation();
    onToggleFavorite(guide.id);
  };

  return (
    <div className={styles.card} onClick={handleCardClick}>
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          <img 
            src={guide.icon} 
            alt={`${guide.title} icon`}
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
        <h3 className={styles.cardTitle}>{guide.title}</h3>
        <p className={styles.cardDescription}>{guide.description}</p>
        <p className={styles.cardSummary}>{guide.summary}</p>
      </div>
      
      <div className={styles.cardFooter}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStartAction(guide);
          }}
          className={styles.startButton}
        >
          Start
        </button>
      </div>
    </div>
  );
}
