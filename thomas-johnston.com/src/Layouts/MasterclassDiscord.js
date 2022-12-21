import MasterclassBtn from "../Components/MasterclassBtn";
import Separator from "../Components/Separator";
import DiscordLogo from "../Assets/discord.png";

function MasterclassDiscord() {
    return(
        <div className="bg-zinc-800 pb-11">
            <h2 className="text-white text-2xl ml-8 mr-8 pb-8"><strong>A Community like No Other</strong></h2>
            
            <ul className="text-white list-disc list-inside ml-8 mr-8 leading-relaxed">
                <li>Join the <strong>free public Discord</strong> for updates and analysis shared for everyone.</li>
                <li>Get a feel for what a Pro subscription is like.</li>
                <li>Chat with everyone and share your ideas with like minded traders!</li>
            </ul>
                <img src={DiscordLogo} alt="Discord logo" className="w-12 mt-8 ml-auto mr-auto mb-4"></img>
            <a className="w-full flex justify-center">
                <MasterclassBtn weight="bold" size="sm" text="Join for free"></MasterclassBtn>
            </a>
        </div>
    );
}

export default MasterclassDiscord;