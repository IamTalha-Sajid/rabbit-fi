import React from "react";
import WalletModal from "@/components/WalletModal";
import { useWallet } from "@solana/wallet-adapter-react";
import { useAppContext } from "@/contexts/AppContext";
import useWalletMultiButton from "@/hooks/useWalletMultiButton";
import { useState, useEffect, useCallback } from "react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toast, Toaster } from 'react-hot-toast';
import "./HomePage.css";
import { Program, BN, Provider } from "@project-serum/anchor";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import icoIdl from "@/components/idl/ico_program.json";
import Image from 'next/image';

const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID);
const TOKEN_MINT = new PublicKey(process.env.NEXT_PUBLIC_TOKEN_MINT);
const ADMIN_WALLET = new PublicKey(process.env.NEXT_PUBLIC_ADMIN_WALLET);
const RECEIVER_ADDRESS = new PublicKey(process.env.NEXT_PUBLIC_RECEIVER_ADDRESS);
const ICO_PDA_SEED = process.env.NEXT_PUBLIC_ICO_PDA_SEED;
const PROGRAM_ATA_SEED = process.env.NEXT_PUBLIC_PROGRAM_ATA_SEED;

const HomePage = () => {
    const wallet = useWallet();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isSigned, setIsSigned } = useAppContext();
    const { buttonState, onDisconnect } = useWalletMultiButton({});
    const [inputAmount, setInputAmount] = useState("");
    const [outputAmount, setOutputAmount] = useState("");
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });
    const [presaleProgress, setPresaleProgress] = useState(0);
    const [totalTokens, setTotalTokens] = useState(0);
    const [activeAccordion, setActiveAccordion] = useState(0);

    //Timer Logic
    useEffect(() => {
        const targetDate = new Date(process.env.NEXT_PUBLIC_PRESALE_END_DATE).getTime();
        const timer = setInterval(() => {
            const now = new Date().getTime();
            const difference = targetDate - now;

            const absDiff = Math.abs(difference);
            setTimeLeft({
                days: Math.floor(absDiff / (1000 * 60 * 60 * 24)),
                hours: Math.floor((absDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                minutes: Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((absDiff % (1000 * 60)) / 1000),
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    //Wallet Modal Logic
    const openModal = () => setIsModalOpen(true);
    const closeModal = () => {
        setIsModalOpen(false);
    };

    //Sign In Logic
    const signInUser = useCallback(async () => {
        if (isSigned) return;
        if (buttonState === "connected") {
            const response = await signIn(wallet);
            setIsSigned(response.isSigned);
        }
    }, [isSigned, buttonState, wallet, setIsSigned]);

    //Input Logic
    const handleSolInput = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) { // Only allow numbers and decimals
            setInputAmount(value);
            // Logic to convert to output amount can go here
        }
    };

    const calculateRHFI = (solAmount) => {
        const amount = (solAmount * LAMPORTS_PER_SOL) / 600; // Convert SOL to tokens based on contract price
        return Number(amount).toFixed(2);
    };

    const calculateSOL = (rhfiAmount) => {
        const amount = (rhfiAmount * 600) / LAMPORTS_PER_SOL; // Convert tokens to SOL based on contract price
        return Number(amount).toFixed(9);
    };

    const handleRHFIInput = (e) => {
        const value = e.target.value;
        if (value === '' || /^\d*\.?\d*$/.test(value)) {
            setOutputAmount(value);
            // Calculate corresponding SOL amount
            if (value) {
                setInputAmount(calculateSOL(value));
            } else {
                setInputAmount('');
            }
        }
    };

    //Wallet Change Logic
    const handleWalletChange = () => {
        if (buttonState === "connected") {
            onDisconnect();
        } else {
            openModal();
        }
    };

    //Output Logic
    useEffect(() => {
        if (inputAmount) {
            setOutputAmount(calculateRHFI(parseFloat(inputAmount)));
        } else {
            setOutputAmount('');
        }
    }, [inputAmount]);

    const fetchIcoData = useCallback(async () => {
        if (!wallet.connected) return;

        try {
            const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
            const provider = {
                connection,
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions,
            };

            const program = new Program(icoIdl, PROGRAM_ID, provider);

            const [icoPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(ICO_PDA_SEED), TOKEN_MINT.toBuffer(), ADMIN_WALLET.toBuffer()],
                PROGRAM_ID
            );

            const icoData = await program.account.icoDataPda.fetch(icoPda);

            // Convert BN to strings for safe calculations
            const tokensBalance = icoData.tokensBalance.toString();
            const totalSold = icoData.totalSold.toString();

            // Convert strings to BigInt for calculations
            const totalSupplyBigInt = BigInt(tokensBalance) + BigInt(totalSold);
            const totalSoldBigInt = BigInt(totalSold);

            // Calculate progress as a number between 0-100
            const progress = Number((totalSoldBigInt * BigInt(100)) / totalSupplyBigInt);

            setPresaleProgress(progress);
            setTotalTokens(totalSupplyBigInt.toString());

        } catch (error) {
            console.error("Error fetching ICO data:", error);
            toast.error("Failed to fetch presale progress");
        }
    }, [wallet.connected]);

    useEffect(() => {
        fetchIcoData();
    }, [fetchIcoData]);

    const buyTokens = async () => {
        if (!wallet.connected || !inputAmount) return;

        const loadingToast = toast.loading("Processing transaction...");

        try {
            const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL, "confirmed");
            const provider = {
                connection,
                publicKey: wallet.publicKey,
                signTransaction: wallet.signTransaction,
                signAllTransactions: wallet.signAllTransactions,
            };

            const program = new Program(icoIdl, PROGRAM_ID, provider);

            // Updated lamports calculation
            const lamports = parseFloat(inputAmount) * LAMPORTS_PER_SOL;
            const solAmount = new BN(lamports);
            const buyerAta = await getAssociatedTokenAddress(
                TOKEN_MINT,
                wallet.publicKey
            );

            const [icoPda] = PublicKey.findProgramAddressSync(
                [Buffer.from(ICO_PDA_SEED), TOKEN_MINT.toBuffer(), ADMIN_WALLET.toBuffer()],
                PROGRAM_ID
            );

            const [programAta] = PublicKey.findProgramAddressSync(
                [Buffer.from(PROGRAM_ATA_SEED), TOKEN_MINT.toBuffer(), ADMIN_WALLET.toBuffer()],
                PROGRAM_ID
            );

            console.log("wallet.publicKey", wallet.publicKey.toString());
            console.log("buyerAta", buyerAta.toString());
            console.log("RECEIVER_ADDRESS", RECEIVER_ADDRESS.toString());
            console.log("Program ID", PROGRAM_ID.toString());
            console.log("Token Mint", TOKEN_MINT.toString());
            console.log("Admin Wallet", ADMIN_WALLET.toString());
            console.log("Buyer Address", wallet.publicKey.toString());
            console.log("Buyer ATA", buyerAta.toString());
            console.log("Program ATA", programAta.toString());
            console.log("ICO PDA", icoPda.toString());
            console.log("Token Program", TOKEN_PROGRAM_ID.toString());
            console.log("System Program", SystemProgram.programId.toString());
            console.log("Lamports", lamports.toString());

            const getOrCreateUserAtaInstruction = async (mint, owner) => {
                const associatedToken = getAssociatedTokenAddressSync(
                    mint,
                    owner,
                    false,
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                );
                let account;
                try {
                    account = await getAccount(
                        connection,
                        associatedToken,
                        undefined,
                        TOKEN_PROGRAM_ID
                    );
                } catch (error) {
                    if (error) {
                        const ataTx = new Transaction().add(
                            createAssociatedTokenAccountInstruction(
                                owner,
                                associatedToken,
                                owner,
                                mint,
                                TOKEN_PROGRAM_ID,
                                ASSOCIATED_TOKEN_PROGRAM_ID
                            )
                        );
                        return { account: associatedToken, ataTx };
                    }
                }
                return { account: account.address };
            };

            const { account, ataTx } = await getOrCreateUserAtaInstruction(
                new PublicKey(TOKEN_MINT),
                wallet.publicKey
            );

            let tx = await program.methods
                .buyWithSol(solAmount)  // Using solAmount instead of lamports
                .accounts({
                    buyer: wallet.publicKey.toString(),
                    receiver: RECEIVER_ADDRESS,
                    buyerAta: account.toString(),
                    programAta: programAta.toString(),
                    icoPda: icoPda.toString(),
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();


            const txSig = await wallet.sendTransaction(
                ataTx ? ataTx.add(tx) : tx,
                connection
            );
            console.log({ txSig });

            const latestBlockHash = await connection.getLatestBlockhash();
            await connection.confirmTransaction({
                blockhash: latestBlockHash.blockhash,
                lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
                signature: txSig,
            });

            toast.dismiss(loadingToast);
            toast.success("Purchase successful!");

            setInputAmount("");
            setOutputAmount("");

        } catch (error) {
            console.error("Error buying tokens:", error);
            toast.dismiss(loadingToast);
            toast.error(`Failed to buy tokens: ${error.message}`);
        }
    };

    // Add accordion toggle handler
    const toggleAccordion = (index) => {
        setActiveAccordion(activeAccordion === index ? -1 : index);
    };

    return (
        <>
        <div className="container">
            <Toaster
                position="top-center"
                toastOptions={{
                    success: {
                        style: {
                            background: '#10B981',
                            color: 'white',
                        },
                    },
                    error: {
                        style: {
                            background: '#EF4444',
                            color: 'white',
                        },
                    },
                    loading: {
                        style: {
                            background: '#3B82F6',
                            color: 'white',
                        },
                    },
                }}
            />
                <WalletModal isOpen={isModalOpen} onClose={closeModal} />
            <header>
                <nav className="navbar">
                    <div className="logo">
                        <a href="#top">
                                <img src="images/logo.png" alt="rabbitholes finance" />
                        </a>
                    </div>
                    <ul className="nav-links">
                        <li>
                                <a href="#top">home</a>
                        </li>
                        <li>
                                <a href="#what-we-do">about us</a>
                        </li>
                        <li>
                                <a href="#tokenomics">tokenomics</a>
                        </li>
                        <li>
                                <a href="#roadmap">roadmap</a>
                        </li>
                        <li>
                                <a href="#faq">faq</a>
                        </li>
                    </ul>
                        <button className="cta-button">buy $RHFI</button>
                </nav>
            </header>

            {/* Hero Section */}
            <section className="hero">
                <div className="hero-text">
                    <h1 id="hover-text" className="hover-effect">
                            follow the white rabbit
                        <br />
                        to financial liberation
                    </h1>
                    <button
                        className="cta-button"
                        onClick={() => {
                            document.getElementById('buy-token').scrollIntoView({
                                behavior: 'smooth'
                            });
                        }}
                    >
                            read the whitepaper
                    </button>
                </div>
                <div className="hero-graphic">
                    <img className="dog-running" src="./images/rabbit-outer-img.png" alt="Rabbit" />
                </div>
            </section>

            {/* Buy Token Section */}
            <section id="buy-token">
                    <h2 id="hover-text-buy">welcome to rabbitholes finance</h2>
                    <p>$RHFI is your gateway to a new era of decentralized finance, merging the worlds of crypto and social networking. buy now and be part of a revolution that aims for financial freedom with a vibrant, community-driven-and-owned social network and defi protocol.</p>
                <div className="buy-token-info">
                    <div className="tok-right">
                        <div className="presale-widget">
                                <h4><strong><span>.</span> buy $RHFI now <span>.</span></strong></h4>
                            <div className="countdown-container">
                                <div className="countdown-item">
                                    <div className="circle">
                                        <span id="days">{timeLeft.days}</span>
                                            <p>days</p>
                                        </div>
                                </div>
                                <div className="countdown-item">
                                    <div className="circle">
                                        <span id="hours">{timeLeft.hours}</span>
                                            <p>hours</p>
                                        </div>
                                </div>
                                <div className="countdown-item">
                                    <div className="circle">
                                        <span id="minutes">{timeLeft.minutes}</span>
                                            <p>min</p>
                                        </div>
                                </div>
                                <div className="countdown-item">
                                    <div className="circle">
                                        <span id="seconds">{timeLeft.seconds}</span>
                                            <p>sec</p>
                                        </div>
                                </div>
                            </div>
                        </div>
                        <div className="cus-fea">
                            <div className="top-line-flex">
                                    <p>token name:</p>
                                    <p>$RHFI</p>
                                </div>
                                <div className="top-line-flex">
                                    <p>presale price:</p>
                                    <p>${process.env.NEXT_PUBLIC_PRESALE_PRICE} per RHFI</p>
                                </div>
                                <div className="top-line-flex">
                                    <p>launch price:</p>
                                    <p>${process.env.NEXT_PUBLIC_LAUNCH_PRICE} per RHFI</p>
                                </div>
                                <div className="progress-container">
                                    <div className="progress-label">
                                        <span>presale sold:</span>
                                        <span className="progress-percentage">{presaleProgress.toFixed(2)}%</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{
                                                width: `${presaleProgress}%`
                                            }}
                                        ></div>
                                    </div>
                                </div>
                                <div className="top-line-flex">
                                    <p>amount in SOL you pay:</p>
                                    <p>{inputAmount || "0.00"} SOL</p>
                            </div>
                            <div className="input-container">
                                <input
                                    type="text"
                                    className="styled-input"
                                    placeholder="0"
                                    value={inputAmount}
                                    onChange={handleSolInput}
                                />
                            </div>
                            <div className="top-line-flex">
                                    <p>amount of $RHFI you receive:</p>
                                    <p>{outputAmount || "0"} $RHFI</p>
                            </div>
                            <div className="input-container">
                                <input
                                    type="text"
                                    className="styled-input"
                                    placeholder="0"
                                    value={outputAmount}
                                        readOnly
                                    />
                                </div>
                            </div>
                            {wallet.connected ? (
                                <button
                                    className="cta-button"
                                    onClick={async () => {
                                        await buyTokens();
                                    }}
                                    disabled={!wallet.connected || !inputAmount || parseFloat(inputAmount) <= 0}
                                    style={{
                                        opacity: !wallet.connected || !inputAmount || parseFloat(inputAmount) <= 0 ? 0.6 : 1,
                                        cursor: !wallet.connected || !inputAmount || parseFloat(inputAmount) <= 0 ? "not-allowed" : "pointer"
                                    }}
                                >
                                    buy $RHFI
                                </button>
                            ) : (
                                <button className="cta-button" onClick={handleWalletChange}>
                                    connect wallet
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Add text scramble effect */}
                    <script dangerouslySetInnerHTML={{
                        __html: `
                        document.addEventListener('DOMContentLoaded', () => {
                            const textElement = document.getElementById('hover-text-buy');
                            const originalText = textElement.textContent;
                        
                            textElement.addEventListener('mouseover', () => {
                                let scrambledText = '';
                                let index = 0;
                                let mouseOnText = true;
                                let showMarker = true;
                        
                                const interval = setInterval(() => {
                                    if (index < originalText.length) {
                                        scrambledText += String.fromCharCode(Math.floor(Math.random() * (126 - 33) + 33));
                                        textElement.textContent = scrambledText + (showMarker ? '|' : '');
                                        showMarker = !showMarker;
                                        index++;
                                    } else {
                                        clearInterval(interval);
                                        if (mouseOnText) {
                                            textElement.textContent = originalText;
                                        }
                                    }
                                }, 50);
                        
                                textElement.addEventListener('mouseout', () => {
                                    mouseOnText = false;
                                    textElement.textContent = originalText;
                                    clearInterval(interval);
                                });
                            });
                        });
                    `
                    }} />
                </section>

                {/* What We Do Section */}
                <section id="what-we-do">
                    <h2 id="hover-text-what">about us</h2>
                    <p>welcome to the future of socialfi</p>
                    <p>we are creating a community-driven platform built on solana that celebrates the excitement and possibilities of decentralization. anyone interested in crypto, from degens and memecoin traders to conspiracy theorists, is welcome to join our user-owned and operated social network where users can earn, explore and connect.</p>

                    {/* Add text scramble effect */}
                    <script dangerouslySetInnerHTML={{
                        __html: `
                        document.addEventListener('DOMContentLoaded', () => {
                            const textElement = document.getElementById('hover-text-what');
                            const originalText = textElement.textContent;
                        
                            textElement.addEventListener('mouseover', () => {
                                let scrambledText = '';
                                let index = 0;
                                let mouseOnText = true;
                                let showMarker = true;
                        
                                const interval = setInterval(() => {
                                    if (index < originalText.length) {
                                        scrambledText += String.fromCharCode(Math.floor(Math.random() * (126 - 33) + 33));
                                        textElement.textContent = scrambledText + (showMarker ? '|' : '');
                                        showMarker = !showMarker;
                                        index++;
                                    } else {
                                        clearInterval(interval);
                                        if (mouseOnText) {
                                            textElement.textContent = originalText;
                                        }
                                    }
                                }, 50);
                        
                                textElement.addEventListener('mouseout', () => {
                                    mouseOnText = false;
                                    textElement.textContent = originalText;
                                    clearInterval(interval);
                                });
                            });
                        });
                    `
                    }} />
                </section>

                {/* Tokenomics Section */}
                <section id="tokenomics">
                    <h2 id="hover-text-to">tokenomics</h2>
                    <p>
                        our platform integrates a native utility and governance token, $RHFI. this token is
                        central to facilitating platform transactions, granting user incentives and participating
                        in the platform's governance. users can earn $RHFI through various activities, which may
                        include completing quests, staking, or otherwise contributing to the platform's ecosystem.
                    </p>
                    <div className="token-chart">
                        <img src="./images/tokenomics-img.png" alt="Tokenomics" id="zoomable-image" />
                </div>

                    {/* Add text scramble effect */}
                    <script dangerouslySetInnerHTML={{
                        __html: `
                        document.addEventListener('DOMContentLoaded', () => {
                            const tokenomicsElement = document.getElementById('hover-text-to');
                            const tokenomicsText = tokenomicsElement.textContent;
                        
                            tokenomicsElement.addEventListener('mouseover', () => {
                                let scrambledText = '';
                                let index = 0;
                                let mouseOnText = true;
                                let showMarker = true;
                        
                                const interval = setInterval(() => {
                                    if (index < tokenomicsText.length) {
                                        scrambledText += String.fromCharCode(Math.floor(Math.random() * (126 - 33) + 33));
                                        tokenomicsElement.textContent = scrambledText + (showMarker ? '|' : '');
                                        showMarker = !showMarker;
                                        index++;
                                    } else {
                                        clearInterval(interval);
                                        if (mouseOnText) {
                                            tokenomicsElement.textContent = tokenomicsText;
                                        }
                                    }
                                }, 50);
                        
                                tokenomicsElement.addEventListener('mouseout', () => {
                                    mouseOnText = false;
                                    tokenomicsElement.textContent = tokenomicsText;
                                    clearInterval(interval);
                                });
                            });
                        });
                    `
                    }} />
            </section>

            {/* Roadmap Section */}
            <section id="roadmap">
                <h2 id="hover-text-road">roadmap</h2>
                <div className="test-sec">
                    <div className="timeline-container">
                        <div className="timeline">
                            {/* Phase 1 */}
                            <div className="phase">
                                <div className="speech-bubble">
                                    <p>q4 2024:</p>
                                    <p className="cus-line-he"><span>pre-launch and community building</span></p>
                                </div>
                                <div className="description">
                                    <p><span style={{ fontWeight: "bolder" }}>objective:</span> create hype, set up core community, onboard early adopters.</p>
                                    <p><span style={{ fontWeight: "bolder" }}>key actions:</span> initial pre-seed sale for fundraising and development, social media marketing of the platform</p>
                                </div>
                            </div>

                            {/* Phase 2 */}
                            <div className="phase">
                                <div className="speech-bubble">
                                    <p>q1 2025:</p>
                                    <p className="cus-line-he"><span>official nft collection launch</span></p>
                                </div>
                                <div className="description">
                                    <p><span style={{ fontWeight: "bolder" }}>objective:</span> launch the official nft collection.</p>
                                    <p><span style={{ fontWeight: "bolder" }}>key actions:</span> a unique nft collection that includes special pieces that give the holder special rights and privileges including a share of the platform's revenue.</p>
                                </div>
                            </div>

                            {/* Phase 3 */}
                            <div className="phase">
                                <div className="speech-bubble">
                                    <p>q2 2025:</p>
                                    <p className="cus-line-he"><span>official beta launch of platform</span></p>
                                </div>
                                <div className="description">
                                    <p><span style={{ fontWeight: "bolder" }}>objective:</span> launch the platform with socialfi functionalities, focusing on user engagement.</p>
                                    <p><span style={{ fontWeight: "bolder" }}>key actions:</span> unveil the platform, activate tokenized engagement, launch staking and defi features, integrate the decentralized exchange (dex) and liquidity pools for token swapping and earning fees, launch nft marketplace for trading nfts, implement yield farming to reward liquidity providers, enable social token creation for community engagement, and organize special nft drop campaigns with gamified nfts unlocking hidden content</p>
                                </div>
                            </div>

                            {/* Phase 4 */}
                            <div className="phase">
                                <div className="speech-bubble">
                                    <p>q3 2025:</p>
                                    <p className="cus-line-he"><span>community growth and global outreach</span></p>
                                </div>
                                <div className="description">
                                    <p><span style={{ fontWeight: "bolder" }}>objective:</span> grow the user base globally</p>
                                    <p><span style={{ fontWeight: "bolder" }}>key actions:</span> expand the platform with localized communities in multiple languages to cater to international users, partner with web3 projects for cross-promotional events and quests, organize regular nft and token airdrops to reward active users,and encourage users to create engaging communities and viral content, with rewards in tokens or nfts</p>
                                </div>
                            </div>

                            {/* Phase 5 */}
                            <div className="phase">
                                <div className="speech-bubble">
                                    <p>q4 2025:</p>
                                    <p className="cus-line-he"><span>full platform expansion, dao launch</span></p>
                                </div>
                                <div className="description">
                                    <p><span style={{ fontWeight: "bolder" }}>objective:</span> launch decentralized governance and establish long-term sustainability through a thriving community and decentralized economy.</p>
                                    <p><span style={{ fontWeight: "bolder" }}>key actions:</span> introduce governance features where token holders can vote on platform upgrades and community guidelines, allow creators to monetize content through subscriptions, token-gated access, and decentralized crowdfunding, launch a global marketing campaign with web3 media and influencers to drive platform adoption, generate sustainable revenue through defi transaction and staking fees along with royalties from the nft marketplace, regularly release new features, quests, and defi opportunities to maintain user engagement, expand ecosystem partnerships with gaming, web3, and entertainment platforms to build a network of interconnected communities</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Add text scramble effect */}
                <script dangerouslySetInnerHTML={{
                    __html: `
                    document.addEventListener('DOMContentLoaded', () => {
                        const textElement = document.getElementById('hover-text-road');
                        const originalText = textElement.textContent;
                    
                        textElement.addEventListener('mouseover', () => {
                            let scrambledText = '';
                            let index = 0;
                            let mouseOnText = true;
                            let showMarker = true;
                    
                            const interval = setInterval(() => {
                                if (index < originalText.length) {
                                    scrambledText += String.fromCharCode(Math.floor(Math.random() * (126 - 33) + 33));
                                    textElement.textContent = scrambledText + (showMarker ? '|' : '');
                                    showMarker = !showMarker;
                                    index++;
                                } else {
                                    clearInterval(interval);
                                    if (mouseOnText) {
                                        textElement.textContent = originalText;
                                    }
                                }
                            }, 50);
                    
                            textElement.addEventListener('mouseout', () => {
                                mouseOnText = false;
                                textElement.textContent = originalText;
                                clearInterval(interval);
                            });
                        });
                    });
                `
                }} />
            </section>

            {/* FAQ Section */}
            <section id="faq">
                    <h2 id="hover-text-faq">frequently asked questions</h2>
                <div className="accordion">
                    <div className="accordion-item">
                            <button
                                className={`accordion-header ${activeAccordion === 0 ? 'open-header' : ''}`}
                                onClick={() => toggleAccordion(0)}
                            >
                                what is rabbitholes finance?
                                <span className="arrow">{activeAccordion === 0 ? '▲' : '▼'}</span>
                        </button>
                            <div className={`accordion-content ${activeAccordion === 0 ? 'open' : ''}`}>
                                <p>rabbitholes finance is a decentralized, community-owned socialfi platform for those who believe in the promise of the blockchain to reshape our society</p>
                            </div>
                        </div>

                    <div className="accordion-item">
                            <button
                                className={`accordion-header ${activeAccordion === 1 ? 'open-header' : ''}`}
                                onClick={() => toggleAccordion(1)}
                            >
                                what is $RHFI?
                                <span className="arrow">{activeAccordion === 1 ? '▲' : '▼'}</span>
                        </button>
                            <div className={`accordion-content ${activeAccordion === 1 ? 'open' : ''}`}>
                                <p>$RHFI is our platform's native utility and governance token. holders of $RHFI can participate in governance, voting on proposals that shape the platform's future. $RHFI is designed to reward engagement and power the platform by enabling token swaps, staking, yield farming, and access to premium features</p>
                            </div>
                        </div>

                    <div className="accordion-item">
                            <button
                                className={`accordion-header ${activeAccordion === 2 ? 'open-header' : ''}`}
                                onClick={() => toggleAccordion(2)}
                            >
                                how do i get $RHFI?
                                <span className="arrow">{activeAccordion === 2 ? '▲' : '▼'}</span>
                        </button>
                            <div className={`accordion-content ${activeAccordion === 2 ? 'open' : ''}`}>
                                <p>users can purchase $RHFI through the presale widget on rabbitholes.fi</p>
                    </div>
                        </div>

                    <div className="accordion-item">
                            <button
                                className={`accordion-header ${activeAccordion === 3 ? 'open-header' : ''}`}
                                onClick={() => toggleAccordion(3)}
                            >
                                how can i stay updated?
                                <span className="arrow">{activeAccordion === 3 ? '▲' : '▼'}</span>
                        </button>
                            <div className={`accordion-content ${activeAccordion === 3 ? 'open' : ''}`}>
                                <p>follow us on x, discord and telegram</p>
                    </div>
                        </div>
                    </div>

                    {/* Add text scramble effect */}
                    <script dangerouslySetInnerHTML={{
                        __html: `
                        document.addEventListener('DOMContentLoaded', () => {
                            const textElement = document.getElementById('hover-text-faq');
                            const originalText = textElement.textContent;
                        
                            textElement.addEventListener('mouseover', () => {
                                let scrambledText = '';
                                let index = 0;
                                let mouseOnText = true;
                                let showMarker = true;
                        
                                const interval = setInterval(() => {
                                    if (index < originalText.length) {
                                        scrambledText += String.fromCharCode(Math.floor(Math.random() * (126 - 33) + 33));
                                        textElement.textContent = scrambledText + (showMarker ? '|' : '');
                                        showMarker = !showMarker;
                                        index++;
                                    } else {
                                        clearInterval(interval);
                                        if (mouseOnText) {
                                            textElement.textContent = originalText;
                                        }
                                    }
                                }, 50);
                        
                                textElement.addEventListener('mouseout', () => {
                                    mouseOnText = false;
                                    textElement.textContent = originalText;
                                    clearInterval(interval);
                                });
                            });
                        });
                    `
                    }} />
                </section>
                </div>
            <div className="footer">
            <footer>
                <div className="foot-img">
                    <div className="container">
                        <img src="./images/logo-bottom.png" alt="Rabbit" />
                    </div>
                </div>
                <div className="social-icons">
                    <div className="container">
                            <p>follow us on:</p>
                            <p className="flex justify-end gap-2">
                                <a href="https://discord.gg/KJUGdzhFKr"><img src="./images/social-icon-1.png" alt="" /></a>
                                <a href="https://x.com/rabbitholesfi"><img src="./images/social-icon-2.png" alt="" /></a>
                                <a href="https://t.me/+ZpP7y0apqu01ZThk"><img src="./images/social-icon-3.png" alt="" /></a>
                        </p>
                    </div>
                </div>
            </footer>
        </div>
        </>
    );
};

export default HomePage;