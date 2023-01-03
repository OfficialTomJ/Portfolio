import MasterclassBtn from "../Components/MasterclassBtn";

function MasterclassLanding() {
    return(
        <div className="mx-auto h-screen bg-black flex flex-col justify-center pl-10 pr-24 lg:pr-96 lg:pl-28">
        <h1 className="text-white text-5xl leading-normal mb-6 max-[375px]:text-4xl">Learn how to always be one step ahead of the <strong>Crypto Markets.</strong></h1>
        <MasterclassBtn weight="bold" size="xl" text="Show me" link="MasterclassHistory"></MasterclassBtn>
    </div>
    );
}
export default MasterclassLanding;