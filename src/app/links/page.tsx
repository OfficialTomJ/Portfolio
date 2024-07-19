import LinksLayout from './LinksLayout';
import Image from "next/image";
import Link from "next/link";
import ProfilePic from "../../../public/profile.jpg";
import LinkBox from '@/Components/LinkBox';

export default function Links() {
  
  return (
    <main className="bg-zinc-800 min-h-screen flex flex-col align-middle items-center justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0 pt-24 pb-12">
      <div className="max-w-lg">
        <div className="container max-w-2xl flex flex-col items-center">
          <Image
            src={ProfilePic}
            className="w-28 pb-4 items-center rounded-full"
            alt="ProfilePic"
          />
          <p>
            Hey there, I'm Tom!{" "}
            <span className="inline-block animate-wave">👋</span>
          </p>
          <p className="font-semibold text-center">@officialtomj</p>
          <p className="text-center pb-12 pt-4">
            🇦🇺 25 | Sydney Australia <br></br>
            💰 Crypto since 2015
          </p>
        </div>
        <LinkBox
          title="SUBSCRIBE TO THE CRYPTO CHRONICLES NEWSLETTER 📬"
          href="https://crypto-chronicles.beehiiv.com/"
        />
        <div className="bg-slate-50 h-px w-full opacity-30 mb-6"></div>
        <LinkBox
          title="Join the Trading Discord! 📈"
          href="https://discord.gg/8tK967YJ6y"
        />
        <LinkBox
          title="Follow me on Instagram! 📸"
          href="https://www.instagram.com/officialtomj"
        />
        <LinkBox
          title="Follow me on TikTok! 🤳"
          href="https://www.tiktok.com/@officialtomj"
        />

        <LinkBox
          title="Subscribe to me on YouTube! 🎥"
          href="https://www.youtube.com/@OfficialTomJ"
        />
        <div className="bg-slate-50 h-px w-full opacity-30 mb-6"></div>
        <LinkBox
          title="Personal Portfolio 👔"
          href="https://www.thomas-johnston.com/personal"
        />
      </div>
    </main>
  );
}
