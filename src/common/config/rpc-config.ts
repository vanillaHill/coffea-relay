export const getRpcUrlsByChainId = (chainId: number) => {
  const config = {
    ALCHEMY_RPC_URL: "",
    INFURA_RPC_URL: "",
    ETHEREUM_RPC_URL: "",
  };

  switch (chainId) {
    case 1: // Ethereum Mainnet
      config.ALCHEMY_RPC_URL =
        process.env.ALCHEMY_MAINNET_RPC_URL ||
        "https://eth-mainnet.alchemyapi.io/v2/your-api-key";
      config.INFURA_RPC_URL =
        process.env.INFURA_MAINNET_RPC_URL ||
        "https://mainnet.infura.io/v3/your-api-key";
      config.ETHEREUM_RPC_URL =
        process.env.ETHEREUM_MAINNET_RPC_URL ||
        "https://ethereum.publicnode.com";
      break;
    case 11155111: // Sepolia Testnet
      config.ALCHEMY_RPC_URL =
        process.env.ALCHEMY_SEPOLIA_RPC_URL ||
        "https://eth-sepolia.alchemyapi.io/v2/your-api-key";
      config.INFURA_RPC_URL =
        process.env.INFURA_SEPOLIA_RPC_URL ||
        "https://sepolia.infura.io/v3/your-api-key";
      config.ETHEREUM_RPC_URL =
        process.env.INFURA_SEPOLIA_RPC_URL ||
        "https://sepolia.infura.io/v3/your-api-key";
      break;
    case 31337: // Hardhat Mainnet Fork
      config.ALCHEMY_RPC_URL =
        process.env.HARDHAT_MAINNET_RPC_URL || "http://localhost:8545";
      config.INFURA_RPC_URL =
        process.env.HARDHAT_MAINNET_RPC_URL || "http://localhost:8545";
      config.ETHEREUM_RPC_URL =
        process.env.HARDHAT_MAINNET_RPC_URL || "http://localhost:8545";
      break;
    default:
      // Default to mainnet
      config.ALCHEMY_RPC_URL = process.env.ALCHEMY_MAINNET_RPC_URL || "";
      config.INFURA_RPC_URL = process.env.INFURA_MAINNET_RPC_URL || "";
      config.ETHEREUM_RPC_URL = process.env.ETHEREUM_MAINNET_RPC_URL || "";
  }

  return config;
};

export const getAlchemyRpcUrl = (chainId: number): string => {
  return getRpcUrlsByChainId(chainId).ALCHEMY_RPC_URL;
};

export const getInfuraRpcUrl = (chainId: number): string => {
  return getRpcUrlsByChainId(chainId).INFURA_RPC_URL;
};

export const getEthereumRpcUrl = (chainId: number): string => {
  return getRpcUrlsByChainId(chainId).ETHEREUM_RPC_URL;
};
