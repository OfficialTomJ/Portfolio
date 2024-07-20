import Link from "next/link";

const OneCTAButton = () => {
  return (
    <>
      <p className="text-center lg:text-lg">
        Open Availability <strong className="animate-pulse">🟢</strong>. By
        Application Only.
      </p>
      <div className="flex justify-center">
        <Link
          href="/apply"
          className="mt-4 bg-green-500 pl-14 pr-14 pt-2 pb-2 rounded-lg"
        >
          <strong>APPLY NOW</strong>
        </Link>
      </div>
    </>
  );
};

export default OneCTAButton;
