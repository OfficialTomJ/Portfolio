import { StaticImport } from "next/dist/shared/lib/get-img-props";
import Image from "next/image"
import { ReactElement, JSXElementConstructor, ReactNode, ReactPortal, PromiseLikeOfReactNode } from "react";

export default function CardExp(props: { image: string | StaticImport; logo: string | StaticImport; subheading: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | PromiseLikeOfReactNode | null | undefined; title: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | PromiseLikeOfReactNode | null | undefined; }) {
  return (
    <div className="flex items-end">
      <div className="relative">
        <div className="relative">
          <Image src={props.image} alt="Card" className="" />
          <div className="absolute top-8 left-8">
            <Image src={props.logo} alt="Logo" className="h-12 w-auto" />
          </div>
        </div>
        <div className="absolute bottom-8 left-8">
          <h2 className="text-white text-l uppercase">{props.subheading}</h2>
          <h1 className="text-white text-4xl">{props.title}</h1>
        </div>
      </div>
    </div>
  );
}
