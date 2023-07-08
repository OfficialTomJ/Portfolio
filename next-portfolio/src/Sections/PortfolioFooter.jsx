import { FaInstagram, FaLinkedin } from "react-icons/fa";

export default function PortfolioFooter() {
    return (
        <footer className="bg-[#1E1E1E] pt-24 pb-24 lg:pt-36 lg:pb-36 flex align-middle justify-center text-white pl-4 pr-4 lg:pl-0 lg:pr-0">
  <div className="container max-w-5xl">
    <h1 className="text-lg">
      I’m most active on
      <a href="https://www.instagram.com/officialtomj/" target="_blank" rel="noopener noreferrer" className="ml-2 mr-2">
        <FaInstagram className="h-6 w-6 inline-block hover:animate-spin-fast" />
      </a>
      and
      <a href="https://www.linkedin.com/in/thomas-johnston3301ab/" target="_blank" rel="noopener noreferrer" className="ml-2 mr-2">
        <FaLinkedin className="h-6 w-6 inline-block" />
      </a>.
      For contact, please email
    </h1>
    <h2 className="text-3xl lg:text-4xl underline">
      <a href="mailto:tomwritescode@proton.me" target="_blank" rel="noopener noreferrer">
        tomwritescode@proton.me
      </a>
    </h2>
  </div>
</footer>

    )
}