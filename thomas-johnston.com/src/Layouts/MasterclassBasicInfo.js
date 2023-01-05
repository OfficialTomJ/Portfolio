import MasterclassBtn from "../Components/MasterclassBtn";
import IMAC from "../Assets/iMac Pro Mockup.png";

import FadeIn from 'react-fade-in';
import { useInView } from "react-intersection-observer";

function MasterclassBasicInfo() {

    const [layout, IsInView] = useInView({
    /* Optional options */
    triggerOnce: true,
    rootMargin: '0px 0px',
  });

    return(
        <div ref={layout} className="bg-zinc-800 lg:bg-[#1E1E1E] pt-11 pb-11 lg:pt-20 lg:pb-20 lg:flex lg:flex-col lg:items-center">
            <FadeIn visible={IsInView}>
            <div className="lg:max-w-4xl 2xl:max-w-7xl">
                <h2 className="text-white text-center text-2xl md:text-3xl lg:text-4xl ml-8 mr-8 pb-8 md:text-center md:text-3xl"><strong>What is Masterclass Pro?</strong></h2>
                <div className=" lg:columns-1 md:flex md:items-center md:justify-center md:gap-8 lg:flex-col">
                    <div className="ml-8 mr-8 lg:ml-0 lg:max-w-3xl">
                    <div className="list-disc items-center list-inside text-white mb-2 flex flex-col lg:flex-row lg:gap-12 lg:mb-8 lg:list-none lg:text-center ">
                        <li className="pb-4 lg:pb-0 flex items-center">- Exclusive private group for quality analysis, updates and insights.</li>
                        <li className="pb-4 lg:pb-0 flex items-center">- Foundation program to get you started with no prior knowledge.</li>
                        <li className="pb-4 lg:pb-0 flex items-center">- Includes an active community to engage with and discuss ideas.</li>
                    </div>
                    <div className="flex justify-center md:justify-start lg:justify-center">
                        <MasterclassBtn weight="normal" size="sm" text="Sign up" link="MasterclassProduct"></MasterclassBtn>
                    </div>
                    </div>
                    <div className="ml-8 mr-8 mt-6 md:ml-0 md:mr-8 md:mt-0">
                        <img src={IMAC} alt="Masterclass IMac" className="h-full w-full md:w-auto object-cover object-left bg-left md:max-h-96 md:object-contain md:object-center md:mr-8 lg:mr-0 lg:max-h-[32rem]"></img>
                    </div>
            </div>
            </div>
            </FadeIn>
        </div>
    );
}

export default MasterclassBasicInfo;