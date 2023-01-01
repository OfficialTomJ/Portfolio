import MasterclassBtn from "../Components/MasterclassBtn";
import IMAC from "../Assets/aboutIMac.png";

function MasterclassBasicInfo() {
    return(
        <div className="bg-zinc-800 pt-11 pb-11">
            <h2 className="text-white text-2xl ml-8 mr-8 pb-8 md:text-center md:text-3xl"><strong>What is Masterclass Pro?</strong></h2>
                <div className="columns-2 md:flex md:items-center md:justify-center md:gap-8">
                    <div className="ml-8">
                    <ul className="list-disc list-inside text-white mb-2">
                        <li className="pb-4">Exclusive private group for quality analysis, updates and insights.</li>
                        <li className="pb-4">Foundation program to get you started with no prior knowledge.</li>
                        <li className="pb-4">Includes an active community to engage with and discuss ideas.</li>
                    </ul>
                    <MasterclassBtn weight="bold" size="sm" text="Sign up" link="MasterclassProduct"></MasterclassBtn>
                    </div>
                <img src={IMAC} alt="Masterclass IMac" className="h-full w-full md:w-auto object-cover object-left bg-left md:max-h-72 md:object-contain md:object-center md:mr-8"></img>
            </div>
        </div>
    );
}

export default MasterclassBasicInfo;