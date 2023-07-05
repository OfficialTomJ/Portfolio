import Logo from '../../public/logo.png';

function Navbar() {
    return(
        <>
        <img src={Logo} alt="Logo" className="relative ml-auto mr-auto auto w-40 mt-4 sm:ml-4 sm:absolute"></img>
        </>
    );
}

 export default Navbar;