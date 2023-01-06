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

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBCgArQ5rnLIxyANLFZWwz006OqCxtIzVE",
  authDomain: "thomas-johnston-portfolio.firebaseapp.com",
  databaseURL: "https://thomas-johnston-portfolio-default-rtdb.firebaseio.com",
  projectId: "thomas-johnston-portfolio",
  storageBucket: "thomas-johnston-portfolio.appspot.com",
  messagingSenderId: "238682210593",
  appId: "1:238682210593:web:260cc74ee724e017947e60",
  measurementId: "G-4G9J657P59"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

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
