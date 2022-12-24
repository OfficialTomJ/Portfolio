import { useState } from "react";
import Separator from "../Components/Separator";
import "react-responsive-carousel/lib/styles/carousel.min.css";
import { Carousel } from 'react-responsive-carousel';
import carouselImg1 from '../Assets/logo.png'
import carouselImg2 from '../Assets/aboutIMac.png'
import carouselImg3 from '../Assets/masterclassiPhone.png'

function MasterclassProduct() {
    let checkedStyle = "border-solid border-2 border-white pl-2 pr-2 pt-1 pb-1";
    let monthlyURL = 'https://buy.stripe.com/cN2dTWahy4Ij3jaeUU';
    let yearlyURL = 'https://buy.stripe.com/aEU0364Xe1w73jafZ0';

    const [checkedType, setCheckedType] = useState('Monthly');

    function typeClicked(e) {
      if (e.target.value === 'monthly') {
        setCheckedType('Monthly');
      } else {
        setCheckedType('Yearly');
      }
    }

  return (
    <div className="bg-zinc-800 pb-11">
      <h2 className="text-white text-2xl ml-8 mr-8 pb-8"><strong>Take your Trading to the Next Level</strong></h2>
      <div className="bg-zinc-700 ml-8 mr-8 pl-6 pr-6 rounded-xl text-white">

        <Carousel showThumbs="" showStatus="" className="pt-6">
                <div>
                    <img src={carouselImg1} />
                </div>
                <div>
                    <img src={carouselImg2} />
                </div>
                <div>
                    <img src={carouselImg3} />
                </div>
            </Carousel>

        <div className="columns-2 flex justify-between items-center pt-6 pb-6">
          <h3 className="text-xl"><strong>Masterclass Pro Subscription</strong></h3>
          <label className="text-xl w-1/2">{checkedType === 'Monthly' ? '$98 p.m' : '$949/year'}</label>
        </div>

        <form>
            <label>Type:</label>
            <div className="flex gap-6 items-center mt-4 mb-4">
                <div className={checkedType === 'Monthly' ? checkedStyle : 'radio'}>
                    <label>
                    <input type="radio" value="monthly" checked={true} className="hidden" onClick={typeClicked} />
                    Monthly
                    </label>
                </div>
                <div className={checkedType === 'Yearly' ? checkedStyle : 'radio'}>
                    <label>
                    <input type="radio" value="yearly" className="hidden" onClick={typeClicked}/>
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

      <div className="w-full mt-4 flex justify-center pb-6">
        <a href={checkedType === 'Monthly' ? monthlyURL : yearlyURL} className="bg-green-500 w-3/4 rounded-md pt-2 pb-2 w-full text-center"><strong>Subscribe</strong></a>
      </div>

      </div>
      <Separator></Separator>
    </div>
  );
}

export default MasterclassProduct;
