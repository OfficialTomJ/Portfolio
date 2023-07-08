import Image from 'next/image';
import FORBES from "../../public/ForbesLogo.png";
import TMC from "../../public/TMCLogo.png";
import FOUNDATION from "../../public/AppleFoundationLogo.png";

export default function PortfolioMedia() {
    return (
        <section className="pt-12 pb-12 mb-24">
  <h2 className="pb-6">Media</h2>
  <div className="flex gap-20">
    <a href="https://www.forbes.com/sites/elainepofeldt/2019/08/25/how-two-young-entrepreneurs-created-a-million-dollar-streetwear-brand/" target="_blank" rel="noopener noreferrer">
      <Image src={FORBES} className="h-20 w-auto" />
    </a>
    <a href="https://www.tradingmasterclass.com/interviews/tom-johnston" target="_blank" rel="noopener noreferrer">
      <Image src={TMC} className="h-20 w-auto" />
    </a>
    <a href="https://www.uts.edu.au/about/faculty-engineering-and-information-technology/apple-foundation-program-uts" target="_blank" rel="noopener noreferrer">
      <Image src={FOUNDATION} className="h-20 w-auto" />
    </a>
  </div>
</section>

    )
}