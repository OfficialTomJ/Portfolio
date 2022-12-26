import React from 'react';
import Separator from '../Components/Separator';
import timelapse from '../Assets/timelapse.mp4';

function MasterclassHistory() {
    return(
        <div className="bg-zinc-800 pt-11" id="MasterclassHistory">
            <h2 className="text-white text-2xl ml-8 mr-8 pb-8"><strong>Since 2015, </strong><br></br>I have been actively investing/trading crypto and mastering the skill set.</h2>
            <video height="200px" autoPlay loop muted>
                <source src={timelapse} type="video/mp4"></source>
            </video>
            <p className="text-white ml-8 mr-8 mt-8">The journey through countless bull and bear markets hasn’t been easy, but what has stayed true is those that have conviction and stay the course see results they can only dream of.
                <br></br><br></br>
                Having been successful over those years, <strong>I now want to package and share everything I’ve learned so that you can take advantage of this opportunity and transform your life.</strong>
            </p>
            <Separator></Separator>
        </div>
    );
}

export default MasterclassHistory;