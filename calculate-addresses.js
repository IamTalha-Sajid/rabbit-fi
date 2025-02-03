const { PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddress } = require('@solana/spl-token');

// Hardcoded values (replace with your actual values)
const PROGRAM_ID = new PublicKey('J9jLfFQbU3Qc3w7acyKrWpuDYEG7ZyxaBN9BdwoApciG');
const TOKEN_MINT = new PublicKey('HtQHxzicWcfi7UP4hnQ9UomeaViT8U3q9hjVDQ8GyVCW');
const ADMIN_WALLET = new PublicKey('FhSQ5Dnc7rvHfjpuYfTPLHpeXcXd1Noa6p54s2dWhxup');
const ICO_PDA_SEED = 'ico_pda'; // Adjusted to match on-chain
const PROGRAM_ATA_SEED = 'program_ata';

async function calculateAddresses() {
    try {
        // Calculate ICO PDA
        const [icoPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from(ICO_PDA_SEED),
                TOKEN_MINT.toBuffer(),
                ADMIN_WALLET.toBuffer(),
            ],
            PROGRAM_ID
        );

        // Calculate Program ATA
        const [programAta] = PublicKey.findProgramAddressSync(
            [
                Buffer.from(PROGRAM_ATA_SEED),
                TOKEN_MINT.toBuffer(),
                ADMIN_WALLET.toBuffer(),
            ],
            PROGRAM_ID
        );

        // Calculate Admin ATA
        const adminAta = await getAssociatedTokenAddress(
            TOKEN_MINT,
            ADMIN_WALLET
        );

        console.log('Calculated Addresses:');
        console.log('ICO PDA:', icoPda.toString());
        console.log('Program ATA:', programAta.toString());
        console.log('Admin ATA:', adminAta.toString());

    } catch (error) {
        console.error('Error calculating addresses:', error);
    }
}

calculateAddresses();