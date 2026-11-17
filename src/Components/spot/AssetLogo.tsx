import { FiCircle, FiDollarSign } from "react-icons/fi";

// Reviewed, locally hosted assets. Source revision and MIT notice accompany them.
const logos: Record<string, string> = {
  BTC: "btc", ETH: "eth", SOL: "sol", HYPE: "hype", USDT: "usdt", FARTCOIN: "fartcoin.jpg",
};

/** Decorative marks; adjacent asset text supplies the accessible label. */
export default function AssetLogo({ asset, size = 16 }: { asset: string; size?: number }) {
  const name = logos[asset.toUpperCase()];
  return <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
    {name ? (
      // Local images avoid third-party requests from visitors' browsers.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={`/asset-icons/${name.includes(".") ? name : name + ".png"}`} alt="" width={size} height={size} loading="lazy" decoding="async" className="h-full w-full object-contain"/>
    ) : asset === "CASH" || asset === "USD" ? <FiDollarSign size={size} className="text-zinc-400"/> : <FiCircle size={size} className="text-zinc-500"/>}
  </span>;
}
