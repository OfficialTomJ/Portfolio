import { StaticImport } from "next/dist/shared/lib/get-img-props";
import Image from "next/image"
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, PromiseLikeOfReactNode } from "react";
import { FaArrowRight } from "react-icons/fa";

export default function Card(props: { link: string | undefined; image: string | StaticImport; subheading: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | PromiseLikeOfReactNode | null | undefined; title: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | PromiseLikeOfReactNode | null | undefined; }) {
  return (
    <div className="flex items-end">
      <a href={props.link} target="_blank" rel="noopener noreferrer">
        <div className="relative group">
          <Image
            src={props.image}
            alt="Card"
            className="brightness-50 rounded-lg transition-all duration-300 hover:scale-[1.03]"
          />
          <div className="absolute bottom-8 left-8">
            <h2 className="text-white text-l uppercase">{props.subheading}</h2>
            <h1 className="text-white text-4xl max-w-[200px] sm:max-w-none">{props.title}</h1>
          </div>
          <div className="absolute bottom-8 right-8 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <FaArrowRight className="text-white text-2xl" />
          </div>
        </div>
      </a>
    </div>
  );
}
