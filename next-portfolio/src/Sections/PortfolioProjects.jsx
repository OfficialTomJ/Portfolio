import Card from '../Components/Card.tsx'
import VISION from "../../public/VISION-BG.png";
import BLVCK from "../../public/BLVCK-BG.png";
import OVERBOOKD from "../../public/OVERBOOKD-BG.png";

export default function PortfolioProjects() {
    return (
        <section className="pt-12">
        <h2 className="pb-6">My projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card image={VISION} title="VISION iOS App" subheading="Application" link="/blog/vision-ios" />
            <Card image={BLVCK} title="BLVCK Paris" subheading="E-Commerce" link="/blog/blvck-paris" />
            <Card image={OVERBOOKD} title="Overbookd" subheading="Application" link="/blog/overbookd" />

        </div>
        </section>
    )
}