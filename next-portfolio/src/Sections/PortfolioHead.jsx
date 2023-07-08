'use client'
import Image from 'next/image';
import dynamic from 'next/dynamic';
import ProfilePic from '../../public/profile.png';
import { TypeAnimation } from 'react-type-animation';

export default function PortfolioHead() {
  return (
    <section className="mt-12 pt-6 lg:mt-24 lg:pt-12 lg:pb-12">
      <Image src={ProfilePic} className="w-28 pb-4" alt="ProfilePic"/>
        <TypeAnimation
          sequence={[
            "I'm Tom - student and developer.",
            () => {
              // Additional logic if needed
            }
          ]}
          wrapper="h1"
          cursor={true}
          repeat={0}
          speed={75}
          className="text-white text-5xl leading-normal max-[375px]:text-4xl"
        />
      <p className="max-w-2xl text-lg">
        I started my career running an e-commerce brand. But have since delved into tech, building products and UIs for thousands of users and an alumni of the <strong>Apple Foundation Program.</strong>
      </p>
    </section>
  );
}
