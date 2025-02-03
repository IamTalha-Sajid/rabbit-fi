import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";

const useWalletMultiButton = () => {
  const wallet = useWallet();
  const [buttonState, setButtonState] = useState("no-wallet");

  useEffect(() => {
    if (wallet.connected) {
      setButtonState("connected");
    } else if (wallet.connecting) {
      setButtonState("connecting");
    } else {
      setButtonState("no-wallet");
    }
  }, [wallet.connected, wallet.connecting]);

  const onDisconnect = () => {
    wallet.disconnect();
  };

  return { buttonState, onDisconnect };
};

export default useWalletMultiButton;