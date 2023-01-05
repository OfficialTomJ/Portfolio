import { Link } from "react-scroll";

function CTAMobileBar(props) {
    return(
        <div className="md:hidden fixed top-[-50px] w-full flex justify-center pb-2 pt-2 bg-zinc-800 transition-[top] ease-in-out" style={{ top: props.inView === true ? "-50px" : "0px"}}>
        <Link activeClass="active" to="MasterclassProduct" spy={true} smooth={true} duration={500} className="bg-green-500 text-white w-1/2 rounded-md pt-2 pb-2 w-full text-center"><strong>Sign Up!</strong></Link>
      </div>
    );
}

export default CTAMobileBar;