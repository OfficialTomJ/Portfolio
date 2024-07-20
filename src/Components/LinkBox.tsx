import PropTypes from "prop-types";
import Link from "next/link";

type LinkBoxProps = {
  title: string;
  href: string;
};

const LinkBox: React.FC<LinkBoxProps> = ({ title, href }) => {
  return (
    <Link href={href} passHref>
      <div className="w-full transition-all duration-300 hover:scale-[1.03]">
        <div className="space-y-6 mb-6 w-full">
          <div className="bg-slate-50 rounded-full pt-5 pb-5 pl-5 pr-5 w-full cursor-pointer">
            <p className="text-black text-center font-semibold text-md">
              {title}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
};

LinkBox.propTypes = {
  title: PropTypes.string.isRequired,
  href: PropTypes.string.isRequired,
};

export default LinkBox;
