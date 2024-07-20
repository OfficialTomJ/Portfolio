import Link from "next/link";
import Image from "next/image";
import Logo from "../../public/logo.png";

const PortfolioNavbar = () => {
  return (
    <nav className="bg-zinc-800 py-4">
      <div className="container mx-auto flex justify-between items-center">
        <div>
          <Link href="/">
            <Image src={Logo} alt="Logo" className="h-16 w-auto" />
          </Link>
        </div>
        <div className="flex gap-4 text-white">
          <Link href="/">Portfolio</Link>
          <Link href="/one">Mentoring</Link>
          <Link
            target="_blank"
            href="https://www.linkedin.com/in/thomas-johnston3301ab/"
          >
            LinkedIn
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default PortfolioNavbar;
