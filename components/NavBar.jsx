"use client";

import { useState, useEffect, useCallback } from "react";
import { useWalletMultiButton } from "@solana/wallet-adapter-base-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import WalletModal from "@/components/WalletModal";
import { useAppContext } from "@/contexts/AppContext";
import { signIn } from "@/action";

export default function NavBar({ className }) {
  const wallet = useWallet();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const {
    buttonState,
    onDisconnect,
  } = useWalletMultiButton({});

  const openModal = () => {
    setIsModalOpen(true);
  };

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  useEffect(() => {
    if (buttonState === "connected") {
      closeModal();
    } else if (buttonState === "no-wallet") {
      setIsSigned(false);
    }
  }, [buttonState, closeModal]);

  const handleWalletChange = useCallback(() => {
    if (buttonState === "connected") {
      onDisconnect();
    }
  }, [buttonState, onDisconnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect();
  }, [onDisconnect]);

  return (
    <>
      <nav
        className={`${className} fixed w-full flex justify-end border-border items-center py-4 px-8 backdrop-blur-sm bg-primary-background/30`}
      >
        <div className="flex gap-2">
          <button
            onClick={handleWalletChange}
            className="h-[52px] rounded-[6px] border-0 py-[8px] px-[16px]"
          >
            {buttonState == "no-wallet" ? "Connect" : "Disconnect"}
          </button>
        </div>
      </nav>
      <WalletModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
}
