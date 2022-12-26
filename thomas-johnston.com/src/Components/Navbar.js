import Logo from '../Assets/logo.png'
import Sidebar from './Sidebar';

function Navbar() {
    return(
        <>
        <img src={Logo} className="w-50"></img>
        <Sidebar pageWrapId={'page-wrap'} outerContainerId={'outer-container'} />
        </>
    );
}

 export default Navbar;