import Link from "next/link";

const OneCTAButton = () => {
  return (
    <>
      <p className="text-center lg:text-lg">
        Open Availability <strong className="animate-pulse">🟢</strong>. Limited
        spots left.
      </p>
      <div className="flex justify-center">
        <Link
          href="https://buy.stripe.com/dR68zC1L21w7dXOaEI"
          className="mt-4 bg-green-500 pl-14 pr-14 pt-2 pb-2 rounded-lg text-xl"
        >
          <strong>APPLY NOW</strong>
        </Link>
      </div>
      <Link
        href="https://docs.google.com/forms/d/e/1FAIpQLSddqm6j8B8sJDEL8tXuKAVqa7DDI7XAFEof3CefREYaHiqF9Q/viewform?usp=sf_link"
        target="none"
        className="block text-center mt-4"
      >
        <strong>
          <u>Have questions? Chat with the team here.</u>
        </strong>
      </Link>
    </>
  );
};

export default OneCTAButton;
