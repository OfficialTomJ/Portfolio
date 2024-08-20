import OneCTAButton from "@/Components/OneCTAButton";
import Image from 'next/image';
import Link from "next/link";
import Members1 from "../../public/Members1.jpg";
import Members2 from "../../public/Members2.jpg";
import profileImg from "../../public/profile.jpg";
import tradingImg from "../../public/trading.jpg";

export default function OneAbout() {
  return (
    <div className="pt-12">
      <h2 className="text-xl">
        <strong>First of all. Who am I?</strong>
      </h2>
      <p>
        I’m Thomas Johnston (or just Tom). An Ex Professional Cryptocurrency
        Futures Trader that helps up-and-coming, and intermediate traders reach
        consistency and trade like a professional.
      </p>
      <div className="sm:columns-2 gap-24 mt-6 mb-6 sm:mt-12 sm:mb-12">
        <div className="image-container">
          <Image
            src={profileImg}
            alt="Profile Image"
            className="rounded-full hidden sm:block"
          />
          <p className="text-center hidden sm:block">Life's unfiltered side.</p>
        </div>
        <div className="image-container">
          <Image src={tradingImg} alt="Trading Image" />
          <p className="text-center">At the charts.</p>
        </div>
      </div>

      <h2 className="text-xl mt-12">
        <strong>1-1 Mentoring. Who’s it for?</strong>
      </h2>
      <p>
        This Mentoring program is designed to give new and experienced Traders
        the lessons and tools necessary to reach consistency. It’s a
        personalized program. Meaning, we delve deep into the current trading
        struggles and blockages being faced, and formulate solutions that are
        implemented over the duration of the program.
      </p>
      <br></br>
      <p>Risk Free Guarantee 💸 - Get results, or your money back.</p>

      <h2 className="text-xl mt-12">
        <strong>Do I need Trading Experience?</strong>
      </h2>
      <p>
        While it is recommended to have some form of Trading Experience in the
        past. I also offer mentoring for fresh aspiring traders looking to get a
        start in the markets. This will include an Introduction to
        Trading/Markets, Finding the Best Trading Methods for your Lifestyle,
        Risk Management Principles, Journaling, and Support throughout the
        Journey as you delve deep into the exciting world of Trading.
      </p>

      <h2 className="text-xl mt-12">
        <strong>What’s Included?</strong>
      </h2>
      <ul className="list-disc list-inside">
        <li>3x 1-1 Live Coaching Sessions each Month (1 hour)</li>
        <li>
          Access a Private DM Channel for Questions, Follow Up, and Resources
        </li>
        <li>Personalized Video Lessons curated for you</li>
        <li>
          Learn cutting edge Trading Strategies I use and deploy in the Markets
        </li>
        <li>Customised Trading Journal, Accountability, and Software</li>
        <li>24/7 Technical Support from the Masterclass Team</li>
      </ul>
      <div className="hidden lg:block">
        <h2 className="text-xl mt-12">
          <strong>What members are saying</strong>
        </h2>
        <Image className="mt-4 w-full" src={Members1} alt="Member Review" />
        <Image className="mt-4 w-full" src={Members2} alt="Member Review" />
      </div>

      <h2 className="text-xl mt-12">
        <strong>How much will it cost?</strong>
      </h2>
      <p>Please contact us for direct pricing.</p>
      <Link href="mailto:hi@thomas-johnston.com">
        <p>
          <u>hi@thomas-johnston.com</u>
        </p>
      </Link>

      <h2 className="text-xl mt-12">
        <strong>How do I apply?</strong>
      </h2>
      <p>
        Click the ‘Apply Now’ buttons on this Page or reach out to our team at:
      </p>
      <Link href="mailto:hi@thomas-johnston.com">
        <p>
          <u>hi@thomas-johnston.com</u>
        </p>
      </Link>
      <div className="mt-12 mb-12">
        <OneCTAButton />
      </div>
    </div>
  );
}
