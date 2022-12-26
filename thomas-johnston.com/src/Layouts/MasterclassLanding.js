import MasterclassBtn from "../Components/MasterclassBtn";

function MasterclassLanding() {
    return(
        <div className="container mx-auto h-screen bg-black flex flex-col justify-center pl-10 pr-24">
        <h1 className="text-white text-5xl leading-normal mb-6">Learn how to always be one step ahead of the <strong>Crypto Markets.</strong></h1>
        <MasterclassBtn weight="bold" size="xl" text="Show me" link="MasterclassHistory"></MasterclassBtn>
    </div>
    );
}
export default MasterclassLanding;