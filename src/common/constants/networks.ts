export interface NetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  nativeCurrency: {
    symbol: string;
    name: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
  isTestnet: boolean;
  supportedProtocols: string[];
}

export const SUPPORTED_NETWORKS: Record<number, NetworkConfig> = {
  1: {
    chainId: 1,
    name: "Ethereum Mainnet",
    shortName: "ethereum",
    nativeCurrency: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
    },
    blockExplorerUrls: ["https://etherscan.io"],
    isTestnet: false,
    supportedProtocols: [
      "aave",
      "lido",
      "compound",
      "curve",
      "uniswap",
      "yearn",
      "maker",
      "convex",
      "kiln",
    ],
  },
  11155111: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    shortName: "sepolia",
    nativeCurrency: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
    },
    blockExplorerUrls: ["https://sepolia.etherscan.io"],
    isTestnet: true,
    supportedProtocols: ["aave", "compound", "uniswap"],
  },
  31337: {
    chainId: 31337,
    name: "Hardhat Mainnet Fork",
    shortName: "hardhat",
    nativeCurrency: {
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
    },
    blockExplorerUrls: ["https://etherscan.io"],
    isTestnet: true,
    supportedProtocols: [
      "aave",
      "lido",
      "compound",
      "curve",
      "uniswap",
      "yearn",
      "maker",
      "convex",
      "kiln",
    ],
  },
} as const;

export const DEFAULT_CHAIN_ID = 1; // Ethereum Mainnet

export const getNetworkConfig = (
  chainId: number,
): NetworkConfig | undefined => {
  return SUPPORTED_NETWORKS[chainId];
};

export const getSupportedChainIds = (): number[] => {
  return Object.keys(SUPPORTED_NETWORKS).map(Number);
};

export const isChainSupported = (chainId: number): boolean => {
  return chainId in SUPPORTED_NETWORKS;
};

export const getMainnetChains = (): NetworkConfig[] => {
  return Object.values(SUPPORTED_NETWORKS).filter(
    (network) => !network.isTestnet,
  );
};

export const getTestnetChains = (): NetworkConfig[] => {
  return Object.values(SUPPORTED_NETWORKS).filter(
    (network) => network.isTestnet,
  );
};

export const getChainNativeCurrency = (
  chainId: number,
): { symbol: string; name: string; decimals: number } | undefined => {
  const network = getNetworkConfig(chainId);
  return network ? network.nativeCurrency : undefined;
};
