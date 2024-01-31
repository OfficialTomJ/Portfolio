import OneBanner from "../../Sections/OneBanner";
import OneAbout from "../../Sections/OneAbout";
import PortfolioFooter from "../../Sections/PortfolioFooter";
import Navbar from "../../Components/PortfolioNavbar"

export default function One() {
  return (
    <>
      <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
        <div className="container max-w-5xl">
          <Navbar/>
          <OneBanner/>
          <OneAbout/>
        </div>
      </main>
      <PortfolioFooter />
    </>
  );
}
