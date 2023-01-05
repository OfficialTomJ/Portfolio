import MasterclassBtn from "../Components/MasterclassBtn";
import mobileBG from "../Assets/landingBG-mobile.png";
import desktopBG from "../Assets/landingBG-desktop.png";

import React from "react";
import { TypeAnimation } from 'react-type-animation';

function MasterclassLanding() {

    const [BgImg, setBGImg] = React.useState('');

    React.useEffect(() => {
        if (window.innerWidth >= 1280) {
        setBGImg(desktopBG);
      } else {
        setBGImg(mobileBG);
      }

    function handleResize() {
      if (window.innerWidth >= 1280) {
        setBGImg(desktopBG);
      } else {
        setBGImg(mobileBG);
      }

        document.getElementById('TypeTextStatic').style.display = "block";
        let headingHeight = document.getElementById('TypeTextStatic').clientHeight;
        headingHeight !== 0 ? document.getElementById('TypeContainer').style.height = headingHeight + 'px' : document.getElementById('TypeContainer');
        document.getElementById('TypeTextStatic').style.display = "none";
    }
    window.addEventListener('resize', handleResize);
    }, []);

    React.useEffect(() => {
      let headingHeight = document.getElementById('TypeTextStatic').clientHeight;
      headingHeight !== 0 ? document.getElementById('TypeContainer').style.height = headingHeight + 'px' : document.getElementById('TypeContainer');
      document.getElementById('TypeTextStatic').style.display = "none";
    }, []);

    return(
        <div className="bg-black mx-auto h-screen flex bg-cover bg-left-bottom bg-no-repeat xl:pl-28" style={{ backgroundImage: `url(${BgImg})` }}>
        <div className="flex flex-col justify-center pl-10 pr-24 lg:pr-96 lg:max-w-4xl 2xl:max-w-7xl">
          <div id="TypeContainer" className="mb-6">
            <TypeAnimation
      sequence={[
        'Learn how to always be one step ahead of the Crypto Markets.',
        () => {
          
        }
      ]}
      wrapper="h1"
      cursor={true}
      repeat={0}
      speed={75}
      className="text-white text-5xl leading-normal max-[375px]:text-4xl"
    />
          </div>
          <h1 id="TypeTextStatic" className="text-white text-5xl leading-normal max-[375px]:text-4xl">Learn how to always be one step ahead of the Crypto Markets.</h1>
        <MasterclassBtn weight="bold" size="xl" text="Show me" link="MasterclassHistory"></MasterclassBtn>
    </div>
    </div>
    );
}
export default MasterclassLanding;