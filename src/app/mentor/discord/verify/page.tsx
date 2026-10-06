import CommunityVerification from "@/Components/CommunityVerification";
export const metadata = { title: "Verify your Discord | The Blueprint", robots: { index: false, follow: false } };
export default function Page() { return <CommunityVerification purpose="connect" />; }
