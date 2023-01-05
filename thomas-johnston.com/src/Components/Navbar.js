import Logo from '../Assets/logo.png'
import Sidebar from './Sidebar';

function Navbar() {
    return(
        <>
        <img src={Logo} alt="Logo" className="relative ml-auto mr-auto auto w-40 mt-4 sm:ml-4 sm:absolute"></img>
        <div className="hidden">
            <Sidebar pageWrapId={'page-wrap'} outerContainerId={'outer-container'} />
        </div>
        </>
    );
}

 export default Navbar;