import React from 'react';
import Separator from '../Components/Separator';
import DeskImg from '../Assets/desk-charts.jpg';

function MasterclassHistory() {
    return(
        <div className="bg-zinc-800 pt-11 lg:pb-20 lg:pt-20 lg:flex lg:flex-col lg:items-center" id="MasterclassHistory">
            <div className="md:columns-2 md:flex md:items-center lg:max-w-4xl 2xl:max-w-7xl">
             <div className="break-after-column">
                <h2 className="text-white text-2xl md:text-3xl lg:text-4xl lg:leading-[3rem] md:leading-relaxed ml-8 mr-8 pb-8"><strong>Since 2015, </strong><br></br>I have been actively investing/trading crypto and mastering the skill set.</h2>
                <img src={DeskImg} className="w-full md:pl-8 md:pr-8 md:hidden"></img>
                <p className="text-white ml-8 mr-8 mt-8 md:mt-0">The journey through countless bull and bear markets hasn’t been easy, but what has stayed true is those that have conviction and stay the course see results they can only dream of.
                <br></br><br></br>
                Having been successful over those years, <strong>I now want to package and share everything I’ve learned so that you can take advantage of this opportunity and transform your life.</strong>
                 </p>
              </div>
              <div className="flex h-full">
                <img src={DeskImg} className="w-full md:pl-8 sm:pr-8 hidden md:block"></img>
              </div>
            </div>
            
            <div className="lg:hidden">
              <Separator></Separator>
            </div>
        </div>
    );
}

export default MasterclassHistory;