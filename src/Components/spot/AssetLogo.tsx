import type { IconType } from "react-icons";
import { SiBitcoin, SiEthereum, SiSolana, SiTether } from "react-icons/si";
import { spotColour } from "@/lib/spot/view";

const icons: Record<string, IconType> = { BTC: SiBitcoin, ETH: SiEthereum, SOL: SiSolana, USDT: SiTether };

/** Decorative, local marks: adjacent ticker text remains the accessible label. */
export default function AssetLogo({ asset, size = 16 }: { asset: string; size?: number }) {
  const Icon = icons[asset];
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center opacity-70" style={{ width: size, height: size, color: spotColour(asset) }}>
      {Icon ? <Icon size={size} focusable="false" /> : asset === "HYPE" ? (
        // Official mark: https://app.hyperliquid.xyz/coins/HYPE.svg
        <svg width={size} height={size} viewBox="0 0 144 144" fill="currentColor" focusable="false">
          <path d="M144 71.6991C144 119.306 114.866 134.582 99.5156 120.98C86.8804 109.889 83.1211 86.4521 64.116 84.0456C39.9942 81.0113 37.9057 113.133 22.0334 113.133C3.5504 113.133 0 86.2428 0 72.4315C0 58.3063 3.96809 39.0542 19.736 39.0542C38.1146 39.0542 39.1588 66.5722 62.132 65.1073C85.0007 63.5379 85.4184 34.8689 100.247 22.6271C113.195 12.0593 144 23.4641 144 71.6991Z" />
        </svg>
      ) : <span className="h-2 w-2 rounded-full bg-current" />}
    </span>
  );
}
