import forbes from '../../public/forbes.svg';
import TMC from '../../public/TMC.svg';
import Image from 'next/image';

function MasterclassInterviews() {
    return(
        <div className="container bg-zinc-900 pt-6 pb-6 sm:hidden">
        <h3 className="text-white text-center text-2xl">As featured on</h3>
        <div className="flex gap-10 justify-center items-center pt-5 pb-5">
            <a href="https://www.forbes.com/sites/elainepofeldt/2019/08/25/how-two-young-entrepreneurs-created-a-million-dollar-streetwear-brand" target="_blank" rel="noreferrer" className="h-min"><Image src={forbes} alt="Forbes logo"></Image></a>
           <a href="https://www.tradingmasterclass.com/interviews/tom-johnston" target="_blank" rel="noreferrer" className="h-min"><Image src={TMC} alt="TMC logo"></Image></a>
        </div>
    </div>
    );
}
export default MasterclassInterviews;