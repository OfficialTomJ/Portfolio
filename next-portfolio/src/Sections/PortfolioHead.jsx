import Image from 'next/image'
import ProfilePic from '../../public/profile.png'

export default function PortfolioHead() {
    return (
        <section className="mt-24 pt-12 pb-12">
        <Image src={ProfilePic} className="w-28 pb-4"/>
        <h1 className="text-5xl pb-2">I'm Tom - student and developer.</h1>
        <p className="max-w-2xl text-lg">I started my career running an e-commerce brand. But have since delved into tech, building products and UIs for thousands of users and an alumni of the <strong>Apple Foundation Program.</strong></p>
        </section>
    )
}