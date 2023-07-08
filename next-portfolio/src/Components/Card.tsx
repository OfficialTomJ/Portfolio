import Image from "next/image"
import { FaArrowRight } from "react-icons/fa";

export default function Card(props) {
  return (
    <div className="flex items-end">
      <a href={props.link} target="_blank" rel="noopener noreferrer">
        <div className="relative group">
          <Image
            src={props.image}
            alt="Image"
            className="brightness-50 rounded-lg transition-all duration-300 hover:scale-[1.03]"
          />
          <div className="absolute bottom-8 left-8">
            <h2 className="text-white text-l uppercase">{props.subheading}</h2>
            <h1 className="text-white text-4xl">{props.title}</h1>
          </div>
          <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <FaArrowRight className="text-white text-2xl" />
          </div>
        </div>
      </a>
    </div>
  );
}
