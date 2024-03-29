"use client"
import Navbar from "../../Components/Navbar";
import MasterclassLanding from "../../Sections/MasterclassLanding";
import MasterclassInterviews from "../../Sections/MasterclassInterviews"
import MasterclassHistory from "../../Sections/MasterclassHistory"
import MasterclassBasicInfo from "../../Sections/MasterclassBasicInfo";
import MasterclassIncluded from "../../Sections/MasterclassIncluded";
import MasterclassProduct from "../../Sections/MasterclassProduct";
import MasterclassDiscord from "../../Sections/MasterclassDiscord";
import Footer from "../../Sections/footer";
import CTAMobileBar from "../../Components/CTAMobileBar";

import { useInView } from "react-intersection-observer";

import MasterClassLayout from './MasterclassLayout';

export default function Masterclass() {
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
    <MasterClassLayout>
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
    </MasterClassLayout>
  )
}
