import MasterclassBtn from "../Components/MasterclassBtn";
import forbes from "../Assets/forbes.svg"
import TMC from "../Assets/TMC.svg"

function Masterclass() {
  return (
    <>
    <div className="container mx-auto h-screen bg-black flex flex-col justify-center pl-10 pr-24">
        <h1 className="text-white text-5xl leading-normal mb-6">Learn how to always be one step ahead of the <strong>Crypto Markets.</strong></h1>
        <MasterclassBtn weight="bold" size="xl" text="Show me"></MasterclassBtn>
    </div>

    <div className="container bg-zinc-900 pt-6 pb-6">
        <h2 className="text-white text-center text-2xl">As featured on</h2>
        <div className="flex gap-10 justify-center items-center pt-5 pb-5">
            <a href="https://www.forbes.com/sites/elainepofeldt/2019/08/25/how-two-young-entrepreneurs-created-a-million-dollar-streetwear-brand" target="_blank" rel="noreferrer" className="h-min"><img src={forbes} alt="Forbes logo"></img></a>
           <a href="https://www.tradingmasterclass.com/interviews/tom-johnston" target="_blank" rel="noreferrer" className="h-min"><img src={TMC} alt="TMC logo"></img></a>
        </div>
    </div>


    </>
  );
}

export default Masterclass;