import { useState, useEffect } from "react";
import { SubjectForm } from './components/SubjectForm';
import { credit_to_maxbunks, defaultSubjectConfig } from './settings';
import "./App.css";
import { SpeedInsights } from "@vercel/speed-insights/react"
export default function App() {
  const [showPopup, setShowPopup] = useState(false);
  const [subjectConfig, setSubjectConfig] = useState(() => {
    const stored = localStorage.getItem("subjectConfig");
    return stored ? JSON.parse(stored) : defaultSubjectConfig;
  });

  const [activeButton, setActiveButton] = useState(null);

  const [bunkCounts, setBunkCounts] = useState(() => {
    const storedBunkCounts = localStorage.getItem("bunkCounts");
    if (storedBunkCounts) {
      const parsed = JSON.parse(storedBunkCounts);
      // Ensure all subjects have a count, defaulting to 0
      return Object.keys(subjectConfig).reduce((acc, key) => ({
        ...acc,
        [key]: parsed[key] || 0
      }), {});
    }
    // Initialize all subjects with 0 if no stored data
    return Object.keys(subjectConfig).reduce((acc, key) => ({
      ...acc,
      [key]: 0
    }), {});
  });

  useEffect(() => {
    const metaTag = document.createElement("meta");
    metaTag.name = "viewport";
    metaTag.content =
      "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.head.appendChild(metaTag);
    return () => {
      document.head.removeChild(metaTag);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("bunkCounts", JSON.stringify(bunkCounts));
  }, [bunkCounts]);

  const handleClick = (subjectKey) => {
    setActiveButton(subjectKey);
    // document.querySelector(".board").scrollIntoView({ behavior: "smooth" });
  };

  const handleBunkCountChange = (event) => {
    const newBunkCount = parseInt(event.target.value, 10);
    setBunkCounts((prevBunkCounts) => ({
      ...prevBunkCounts,
      [activeButton]: newBunkCount,
    }));
  };

  const incrementBunkCount = () => {
    setBunkCounts((prevBunkCounts) => ({
      ...prevBunkCounts,
      [activeButton]: prevBunkCounts[activeButton] + 1,
    }));
  };

  const handleAddSubject = (newConfig) => {
    setSubjectConfig(newConfig);
    localStorage.setItem("subjectConfig", JSON.stringify(newConfig));
    // Initialize bunk counts for new subjects
    setBunkCounts(prev => {
      const updatedCounts = { ...prev };
      Object.keys(newConfig).forEach(key => {
        if (!(key in updatedCounts)) {
          updatedCounts[key] = 0;
        }
      });
      return updatedCounts;
    });
    setShowPopup(false);
  };

  return (
    <div className="container">
      <SpeedInsights/>
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup">
            <SubjectForm onSubmit={handleAddSubject} onClose={() => setShowPopup(false)} />
          </div>
        </div>
      )}

      <div className="hero">
        <div className="heroText">
        <p>BUNKIALO</p>

        </div>
        <button
            className="config-button"
            onClick={() => setShowPopup(true)}
          >
            Edit
          </button>
        {/* <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
          
        </div> */}
      </div>




      <div className="subjects-container">
        {Object.keys(subjectConfig)
          .sort()
          .map(key => (
            <div
              key={key}
              className={`subject-button ${activeButton === key ? "active" : ""}`}
              style={{ backgroundColor: subjectConfig[key].color }}
              onClick={() => handleClick(key)}
            >
              {subjectConfig[key].name}
            </div>
          ))}
      </div>

      <div className="board">
        {/* <div className="course-button">
          {activeButton ? subjectConfig[activeButton].name : "Select a course"}
        </div> */}
        <div className="bunks-section">
          <div className="bunks-text">
            Bunks:<br />
            <p className="available"> (available)</p>
          </div>
          <div className="bunks-count">
            {activeButton
              ? !isNaN(bunkCounts[activeButton])
                ? credit_to_maxbunks(subjectConfig[activeButton].subject_credit, subjectConfig[activeButton].lab) - bunkCounts[activeButton]
                : credit_to_maxbunks(subjectConfig[activeButton].subject_credit, subjectConfig[activeButton].lab)
              : "?"}
          </div>
        </div>

      </div>
      <div className="bunk-button-row">
        <div className="top-section">
          <div className="title">Classes bunked</div>
          <div className="input-box-div">
            <input
              type="number"
              className="count-box"
              value={bunkCounts[activeButton]}
              onChange={handleBunkCountChange}
            />
          </div>
          <div className="count-description">
            (Data stored locally)
          </div>
        </div>
        <div className="bunk-button"
          onClick={incrementBunkCount}
          style={{ userSelect: 'none' }}>
          BUNK
        </div>
      </div>
      <div className="dev-info">
        Developed by <a href="https://www.linkedin.com/in/noel-georgi-22521a303/" target="_blank" rel="noopener noreferrer">Noel Georgi</a> and <a href="https://www.linkedin.com/in/mathewmanachery/" target="_blank" rel="noopener noreferrer">Mathew Manachery</a>
        <br />
        Idea of <a href="https://www.linkedin.com/in/srimoneyshankar-ajith-a5a6831ba/" target="_blank" rel="noopener noreferrer">Srimoneyshankar Ajith</a>
      </div>
    </div>
  );
}
