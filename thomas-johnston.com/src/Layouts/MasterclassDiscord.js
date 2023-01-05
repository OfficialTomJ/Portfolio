import MasterclassBtn from "../Components/MasterclassBtn";
import DiscordLogo from "../Assets/discord.png";

import FadeIn from 'react-fade-in';
import { useInView } from "react-intersection-observer";

function MasterclassDiscord() {

    const [layout, IsInView] = useInView({
    /* Optional options */
    triggerOnce: true,
    rootMargin: '0px 0px',
  });

    return(
        <div ref={layout} className="bg-zinc-800 pb-11 pt-11 lg:pb-20 lg:max-w-6xl lg:ml-auto lg:pt-20 lg:mr-auto">
            <FadeIn visible={IsInView}>
            <h2 className="text-white text-2xl md:text-3xl lg:text-4xl ml-8 mr-8 pb-8 text-center"><strong>A Community like No Other</strong></h2>
            
            <p className="text-white list-disc list-inside pl-8 pr-8 sm:pl-0 sm:pr-0 leading-relaxed text-center max-w-sm ml-auto mr-auto lg:max-w-lg 2xl:max-w-2xl">
                Join the <strong>free public Discord</strong> for updates and analysis shared for everyone. Get a feel for what a Pro subscription is like. Chat with everyone and share your ideas with like minded traders!
            </p>
                <img src={DiscordLogo} alt="Discord logo" className="w-12 mt-8 ml-auto mr-auto mb-4"></img>
            <div className="w-full flex justify-center">
                <MasterclassBtn weight="bold" size="sm" text="Join for free" link="https://discord.gg/8tK967YJ6y"></MasterclassBtn>
            </div>
            </FadeIn>
        </div>
    );
}

export default MasterclassDiscord;