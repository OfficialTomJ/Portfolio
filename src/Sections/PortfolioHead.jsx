'use client'
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import ProfilePic from '../../public/profile.png';
import { TypeAnimation } from 'react-type-animation';
import { FaGithub } from 'react-icons/fa'

export default function PortfolioHead() {
  return (
    <section className="mt-12 pt-6 lg:mt-24 lg:pt-12 lg:pb-12">
      <Image src={ProfilePic} className="w-28 pb-4" alt="ProfilePic" />
      <TypeAnimation
        sequence={[
          "I'm Tom - student and developer.",
          () => {
            // Additional logic if needed
          },
        ]}
        wrapper="h1"
        cursor={true}
        repeat={0}
        speed={75}
        className="text-white text-5xl leading-normal max-[375px]:text-4xl"
      />
      <p className="max-w-2xl text-lg">
        I began my career by running an e-commerce brand, but I have since delved into the world of technology, where I have
        been involved in building products and user interfaces for thousands of users. Additionally, I am proud to be an
        alumni of the <strong>Apple Foundation Program.</strong>
      </p>
      <div className="flex items-center mt-4">
        <Link href="https://github.com/OfficialTomJ" className="flex items-center text-white underline" target="_none">
          <FaGithub className="w-6 h-6 mr-2" alt="GitHub Logo" />
          GitHub
        </Link>
      </div>
    </section>
  );
}
