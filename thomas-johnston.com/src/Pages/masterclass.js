import MasterclassLanding from "../Layouts/MasterclassLanding";
import MasterclassInterviews from "../Layouts/MasterclassInterviews"
import MasterclassHistory from "../Layouts/MasterclassHistory"
import MasterclassBasicInfo from "../Layouts/MasterclassBasicInfo";
import MasterclassIncluded from "../Layouts/MasterclassIncluded";
import MasterclassProduct from "../Layouts/MasterclassProduct";

function Masterclass() {
  return (
    <>
    <MasterclassLanding></MasterclassLanding>
    <MasterclassInterviews></MasterclassInterviews>
    <MasterclassHistory></MasterclassHistory>
    <MasterclassBasicInfo></MasterclassBasicInfo>
    <MasterclassIncluded></MasterclassIncluded>
    <MasterclassProduct></MasterclassProduct>
    </>
  );
}

export default Masterclass;