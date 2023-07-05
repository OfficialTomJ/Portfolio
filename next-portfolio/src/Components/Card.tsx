import Image from "next/image"

export default function Card(props) {
  return (
    <div className="flex items-end">
      <div className="relative">
        <Image src={props.image} alt="Image" className="brightness-50"/>
        <div className="absolute bottom-8 left-8">
          <h2 className="text-white text-l uppercase">{props.subheading}</h2>
          <h1 className="text-white text-4xl">{props.title}</h1>
        </div>
      </div>
    </div>
  );
}
