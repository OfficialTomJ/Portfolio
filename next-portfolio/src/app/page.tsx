import Image from 'next/image'
import PortfolioHead from '../Sections/PortfolioHead'
import PortfolioProjects from '../Sections/PortfolioProjects'
import PortfolioExperience from '../Sections/PortfolioExperience'
import PortfolioMedia from '../Sections/PortfolioMedia'
import PortfolioFooter from '../Sections/PortfolioFooter'

export default function Home() {
  return (
    <>
      <main className="bg-zinc-800 min-h-screen flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
        <div className="container max-w-5xl">
          <PortfolioHead />
          <PortfolioProjects />
          <PortfolioExperience />
          <PortfolioMedia />
        </div>
      </main>
      <PortfolioFooter />
    </>
  );
}
