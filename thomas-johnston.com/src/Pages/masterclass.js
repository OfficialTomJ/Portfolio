import Navbar from "../Components/Navbar";
import MasterclassLanding from "../Layouts/MasterclassLanding";
import MasterclassInterviews from "../Layouts/MasterclassInterviews"
import MasterclassHistory from "../Layouts/MasterclassHistory"
import MasterclassBasicInfo from "../Layouts/MasterclassBasicInfo";
import MasterclassIncluded from "../Layouts/MasterclassIncluded";
import MasterclassProduct from "../Layouts/MasterclassProduct";
import MasterclassDiscord from "../Layouts/MasterclassDiscord";
import Footer from "../Layouts/footer";
import CTAMobileBar from "../Components/CTAMobileBar";

import { useInView } from "react-intersection-observer";

function Masterclass() {

  const [landing, inViewLanding] = useInView({
    /* Optional options */
    triggerOnce: false,
    rootMargin: '0px 0px',
  });
  const [product, inViewProduct] = useInView({
    /* Optional options */
    triggerOnce: false,
    rootMargin: '0px 0px',
  });
  let isInView = inViewLanding || inViewProduct;

  return (
    <>
      <nav className="absolute w-full">
        <Navbar></Navbar>
      </nav>
      <main className="bg-zinc-800">
        <div ref={landing}>
          <MasterclassLanding></MasterclassLanding>
        </div>
          <MasterclassInterviews></MasterclassInterviews>
          <CTAMobileBar inView={isInView}></CTAMobileBar>
          <MasterclassHistory></MasterclassHistory>
          <MasterclassBasicInfo></MasterclassBasicInfo>
          <MasterclassIncluded></MasterclassIncluded>
          <div ref={product}>
            <MasterclassProduct></MasterclassProduct>
          </div>
          <MasterclassDiscord></MasterclassDiscord>
        <Footer></Footer>
      </main>
    </>
  );
}

export default Masterclass;