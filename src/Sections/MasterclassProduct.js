import { useState } from "react";

import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from 'react-responsive-carousel';
import carouselImg1 from '../../public/logoWithText.png';
import carouselImg2 from '../../public/iMac Pro Mockup.png';
import carouselImg3 from '../../public/iPhoneCharts.png';
import Image from 'next/image';

import FadeIn from 'react-fade-in';
import { useInView } from "react-intersection-observer";

function MasterclassProduct() {
    let checkedStyle = "border-solid border-2 border-white pl-2 pr-2 pt-1 pb-1";
    let monthlyURL = 'https://buy.stripe.com/cN2dTWahy4Ij3jaeUU';
    let yearlyURL = 'https://buy.stripe.com/aEU0364Xe1w73jafZ0';

    const [checkedType, setCheckedType] = useState('Monthly');

    function typeClicked(e) {
      setCheckedType(e.target.value);
    }

    const [layout, IsInView] = useInView({
    /* Optional options */
    triggerOnce: true,
    rootMargin: '0px 0px',
  });

  return (
    <div ref={layout} className="bg-zinc-800 lg:bg-[#1E1E1E] pb-11 lg:pt-20 lg:pb-20 lg:flex lg:flex-col lg:items-center" id="MasterclassProduct">
      <FadeIn visible={IsInView}>
      <div className="lg:max-w-4xl">
      <h2 className="text-white text-2xl md:text-3xl lg:text-4xl ml-8 mr-8 pb-8 sm:pb-2 sm:text-center sm:pt-16 md:text-3xl lg:pt-0"><strong>Take your Trading to the Next Level</strong></h2>
      <p className="text-white ml-8 pb-8 text-center hidden sm:block">Sign up now. Limited spots.</p>
      <div className="bg-zinc-700 ml-8 mr-8 pl-6 pr-6 sm:pl-0 sm:pr-0 rounded-xl text-white min-w-min flex justify-center sm:max-w-lg sm:ml-auto sm:mr-auto">
        <div className="sm:max-w-sm">
          <Carousel showThumbs="" showStatus="" className="pt-8 sm:max-w-sm">
                <div>
                    <Image src={carouselImg1} alt="carousel-1" />
                </div>
                <div>
                    <Image src={carouselImg2} alt="carousel-2"/>
                </div>
                <div>
                    <Image src={carouselImg3} alt="carousel-3"/>
                </div>
            </Carousel>

        <div className="columns-2 flex justify-between items-center pt-6 pb-6">
          <h3 className="text-xl"><strong>Masterclass Pro Subscription</strong></h3>
          <label className="text-xl w-1/2 text-right">{checkedType === 'Monthly' ? '$98 p.m' : '$949/year'}</label>
        </div>

        <form>
            <label>Type:</label>
            <div className="flex gap-6 items-center mt-4 mb-4">
                <div className={checkedType === 'Monthly' ? checkedStyle : 'radio'}>
                    <label>
                    <input type="radio" value="Monthly" checked={checkedType === 'Monthly'} className="hidden" onChange={typeClicked} />
                    Monthly
                    </label>
                </div>
                <div className={checkedType === 'Yearly' ? checkedStyle : 'radio'}>
                    <label>
                    <input type="radio" value="Yearly" className="hidden" checked={checkedType === 'Yearly'} onChange={typeClicked}/>
                    Yearly - 20% off
                    </label>
                </div>
            </div>
          
        </form>

        <ul className="list-disc list-inside">
            <li>Access all Premium Channels.</li>
            <li>Renews Monthly.</li>
            <li>Cancel at anytime.</li>
        </ul>

      <div className="w-full mt-6 flex justify-center pb-8">
        <a href={checkedType === 'Monthly' ? monthlyURL : yearlyURL} className="bg-green-500 w-3/4 rounded-md pt-2 pb-2 w-full text-center"><strong>Subscribe</strong></a>
      </div>
        </div>

      </div>
      </div>
      </FadeIn>
    </div>
  );
}

export default MasterclassProduct;
