import './App.css';
import Masterclass from './Pages/masterclass';
import Page404 from './Pages/Page404';
import PageLinks from './Pages/PageLinks';

import React from "react";
import {
  BrowserRouter as Router,
  Route,
  Routes
} from "react-router-dom";

function App() {
  return (
    <div className="App" id="outer-container">
      <Router>
      <div>
        <Routes>
          <Route path="/" element={<Masterclass/>}/>
          <Route path="/masterclass" element={<Masterclass/>}/>
          <Route path="/links" element={<PageLinks/>}/>
          <Route path="*" element={<Page404/>}/>
        </Routes>
      </div>
    </Router>
    </div>
  );
}

export default App;
