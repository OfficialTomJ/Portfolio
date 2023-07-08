import Image from 'next/image';
import APPLE from "../../public/ForbesLogo.png";
import TMC from "../../public/TMCLogo.png";
import FOUNDATION from "../../public/AppleFoundationLogo.png";

export default function PortfolioMedia() {
    return (
        <section className="pt-12 pb-12 mb-24">
        <h2 className="pb-6">Media</h2>
        <div className="flex gap-20">
        <Image src={APPLE} className="h-20 w-auto"/>
        <Image src={TMC} className="h-20 w-auto"/>
        <Image src={FOUNDATION} className="h-20 w-auto"/>
        </div>
        </section>
    )
}