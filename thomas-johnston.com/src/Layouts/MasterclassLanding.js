import MasterclassBtn from "../Components/MasterclassBtn";
import mobileBG from "../Assets/landingBG-mobile.png";
import desktopBG from "../Assets/landingBG-desktop.png";

import React from "react";

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
    }
    window.addEventListener('resize', handleResize);
    }, []);

    return(
        <div className="mx-auto h-screen flex bg-cover bg-left-bottom bg-no-repeat" style={{ backgroundImage: `url(${BgImg})` }}>
        <div className="flex flex-col justify-center pl-10 pr-24 lg:pr-96 lg:pl-28">
        <h1 className="text-white text-5xl leading-normal mb-6 max-[375px]:text-4xl">Learn how to always be one step ahead of the <strong>Crypto Markets.</strong></h1>
        <MasterclassBtn weight="bold" size="xl" text="Show me" link="MasterclassHistory"></MasterclassBtn>
    </div>
    </div>
    );
}
export default MasterclassLanding;