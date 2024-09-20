import "../styles/Diagram.css";
import sunburst from "/sunburst.png";

import React from "react";

const Diagram = () => {
  return <div className="diagram-image-container">
    <img src = {sunburst} alt="sunburst-image" className="sunburst-image"></img>
  </div>;
};

export default Diagram;
