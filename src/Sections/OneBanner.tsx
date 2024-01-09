export default function OneBanner() {
  return (
    <div className="pt-12">
      <h1 className="text-3xl text-center">
        Master the Markets and Realise Your Potential with{" "}
        <strong>Masterclass One.</strong>
      </h1>
      <p className="mt-4 text-center">
        Masterclass One is a personalised 1-1 Mentoring Program that spans over
        a 3 Month Period to teach you how to trade financial markets and achieve
        consistency.
      </p>

      <iframe
        src="https://player.vimeo.com/video/524933864?h=1ac4fd9fb4&autoplay=1&title=0&byline=0&portrait=0"
        className="w-full aspect-video mt-4"
        frameborder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
      ></iframe>

      <p className="mt-4 text-center">
        Open Availability <strong className="animate-pulse">🟢</strong>. By
        Application Only.
      </p>
      <div className="flex justify-center">
        <button className="mt-2 bg-green-500 pl-8 pr-8 pt-2 pb-2 rounded-lg">
          <strong>APPLY NOW</strong>
        </button>
      </div>
    </div>
  );
}
