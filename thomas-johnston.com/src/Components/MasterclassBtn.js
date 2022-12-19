
//Props take a weight, size and text per Tailwinds specs. ALso includes a link prop for direction.
function MasterclassBtn(props) {
    return(
        <a className={`block bg-white w-fit text-center font-${props.weight} text-${props.size} pt-3 pb-3 pl-7 pr-7`} href={props.link}>{props.text}</a>
    );
}
export default MasterclassBtn;