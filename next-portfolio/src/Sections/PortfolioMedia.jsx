import Image from 'next/image';
import FORBES from "../../public/ForbesLogo.png";
import TMC from "../../public/TMCLogo.png";
import FOUNDATION from "../../public/AppleFoundationLogo.png";

export default function PortfolioMedia() {
    return (
        <section className="pt-12 pb-12 mb-12 lg:mb-24">
  <h2 className="pb-6">Media</h2>
  <div className="flex flex-col sm:flex-row gap-8 sm:gap-20">
    <a href="https://www.forbes.com/sites/elainepofeldt/2019/08/25/how-two-young-entrepreneurs-created-a-million-dollar-streetwear-brand/" target="_blank" rel="noopener noreferrer">
      <Image alt="Forbes Logo" src={FORBES} className="h-16 lg:h-20 w-auto transition-all duration-300 hover:scale-[1.05]" />
    </a>
    <a href="https://www.tradingmasterclass.com/interviews/tom-johnston" target="_blank" rel="noopener noreferrer">
      <Image alt="TMC Logo" src={TMC} className="h-20 w-auto transition-all duration-300 hover:scale-[1.05]" />
    </a>
    <a href="https://www.uts.edu.au/about/faculty-engineering-and-information-technology/apple-foundation-program-uts" target="_blank" rel="noopener noreferrer">
      <Image alt="Apple Foundation Logo" src={FOUNDATION} className="h-20 w-auto transition-all duration-300 hover:scale-[1.05]" />
    </a>
  </div>
</section>

    )
}