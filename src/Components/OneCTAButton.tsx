import Link from "next/link";

const OneCTAButton = () => {
  return (
    <>
      <p className="text-center lg:text-lg">
        Open Availability <strong className="animate-pulse">🟢</strong>. Limited
        spots left. (2)
      </p>
      <div className="flex justify-center">
        <Link
          href="https://buy.stripe.com/dR68zC1L21w7dXOaEI"
          className="mt-4 bg-green-500 pl-14 pr-14 pt-2 pb-2 rounded-lg"
        >
          <strong>APPLY NOW</strong>
        </Link>
      </div>
    </>
  );
};

export default OneCTAButton;
