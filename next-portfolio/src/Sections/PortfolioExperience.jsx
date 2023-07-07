import Card from '../Components/CardExp.tsx'
import RECT from "../../public/GreyRect.png";
import APPLE from "../../public/AppleLogo.png";
import PROPEX from "../../public/PropexLogo.png";
import BLVCK from "../../public/BlvckLogo.png";
import HYPERLAX from "../../public/HyperlaxLogo.png";

export default function PortfolioExperience() {
    return (
        <section className="pt-12">
        <h2 className="pb-6">My experience</h2>
        <div className="grid grid-cols-2 gap-4">
            <Card image={RECT} logo={APPLE} title="Apple Foundation" subheading="Program"/>
            <Card image={RECT} logo={PROPEX} title="Propex" subheading="Trading"/>
            <Card image={RECT} logo={BLVCK} title="BLVCK Paris" subheading="E-Commerce"/>
            <Card image={RECT} logo={HYPERLAX} title="Hyperlax" subheading="Creative Agency"/>
        </div>
        </section>
    )
}