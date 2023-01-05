import { Link } from "react-scroll";

//Props take a weight, size and text per Tailwinds specs. ALso includes a link prop for direction.
function MasterclassBtn(props) {
    return(

        props.link.includes("https://") ? <a href={props.link} className={`block bg-white w-fit text-center font-${props.weight} text-${props.size} pt-3 pb-3 pl-7 pr-7`}>{props.text}</a>
        : <Link activeClass="active" to={props.link} href={props.link.includes("https://") ? props.link : ""} spy={true} smooth={true} duration={500} className={`block bg-white w-fit text-center font-${props.weight} text-${props.size} pt-3 pb-3 pl-7 pr-7`}>{props.text}</Link>
    );
}
export default MasterclassBtn;