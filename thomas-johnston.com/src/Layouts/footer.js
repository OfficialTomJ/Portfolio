import footerLogo from "../Assets/logo.png"

function footer() {
    return(
        <footer className="bg-[#1E1E1E] pb-10 pt-10">
                <img src={footerLogo} alt="Thomas Johnston footer logo" className="w-40 ml-auto mr-auto"></img>
                <p className="text-white text-center mt-4 mb-4">Copyright 2021</p>
        </footer>
    );
}

export default footer;