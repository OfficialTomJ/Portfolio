import LinksLayout from './LinksLayout';
import Image from "next/image";
import Link from "next/link";
import ProfilePic from "../../../public/profile.png";

export default function Links() {
  
  return (
    <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
      <div className="container max-w-2xl">
        <Image src={ProfilePic} className="w-28 pb-4" alt="ProfilePic" />
        <p className="font-semibold">@officialtomj</p>
        <p>
          24 | Sydney based developer and crypto trader since 2015. <br></br>
          <br></br>
          Learn more about me below!
        </p>
        <h1 className="text-4xl mt-6">My Links</h1>
        <div className="space-y-6 flex flex-col items-center">
          <div className="bg-slate-50 rounded-full pt-3 pb-3 w-full">
            <p className="text-black text-center font-semibold">
              SUBSCRIBE TO CRYPTO CHRONICLES FREE NEWSLETTER 📬
            </p>
          </div>
          <div className="bg-slate-50 h-px w-1/2 opacity-30"></div>
          
        </div>
      </div>
    </main>
  );
}
