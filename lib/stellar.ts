import { 
  rpc, 
  Horizon, 
  Networks, 
  TransactionBuilder, 
  BASE_FEE, 
  Address, 
  Contract, 
  nativeToScVal, 
  scValToNative, 
  xdr,
  Account
} from "@stellar/stellar-sdk";

// Load configuration from environment variables with safe defaults
export const STELLAR_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
export const HORIZON_URL = process.env.NEXT_PUBLIC_HORIZON_URL || "https://horizon-testnet.stellar.org";
export const CONTRACT_ID = process.env.NEXT_PUBLIC_CONTRACT_ID || "CACD35GOH4UXJSHR7XEX2YGB5P2GWRQFLRQLOOM7DGLTZWWRHMESH4U2"; // Fallback placeholder
export const REPUTATION_CONTRACT_ID = process.env.NEXT_PUBLIC_REPUTATION_CONTRACT_ID || "CB4XQ7Q4E4UXJSHR7XEX2YGB5P2GWRQFLRQLOOM7DGLTZWWRHMESH4U2";
export const FARE_TOKEN_ID = process.env.NEXT_PUBLIC_FARE_TOKEN_ID || "CDLZFC3SYJYDZT7K67VZ75HPJSIZMAFRHGVKNECE6ALBHGLMTZW4NNKQ"; // Wrapped Native SAC (XLM) on Testnet

export const NETWORK_PASSPHRASE = STELLAR_NETWORK === "public" 
  ? Networks.PUBLIC 
  : Networks.TESTNET;

// Instantiate RPC Server
export const rpcServer = new rpc.Server(RPC_URL);

// Instantiate Horizon Server
export const horizonServer = new Horizon.Server(HORIZON_URL);

/**
 * Fetch native XLM balance for a public key
 */
export async function getXLMBalance(publicKey: string): Promise<string> {
  try {
    const account = await horizonServer.loadAccount(publicKey);
    const nativeBalance = account.balances.find(b => b.asset_type === "native");
    return nativeBalance ? nativeBalance.balance : "0.0";
  } catch (error) {
    console.error("Failed to load native balance from Horizon:", error);
    return "0.0";
  }
}

/**
 * Fetch custom token balance for an address
 */
export async function getTokenBalance(publicKey: string, tokenContractId: string): Promise<string> {
  try {
    const contract = new Contract(tokenContractId);
    const address = Address.fromString(publicKey);
    
    // Call token.balance_of(address)
    const result = await simulateCall(
      tokenContractId,
      "balance",
      [nativeToScVal(address)]
    );
    
    if (result) {
      // Balance is usually returned as i128 (BigInt)
      const rawBalance = scValToNative(result);
      const formattedBalance = (BigInt(rawBalance).toString());
      // Convert stroops to decimal (assuming 7 decimals, Stellar standard)
      return (Number(formattedBalance) / 10_000_000).toFixed(4);
    }
    return "0.0";
  } catch (error) {
    console.error("Failed to fetch token balance:", error);
    return "0.0";
  }
}

/**
 * Simulate a read-only smart contract call
 */
export async function simulateCall(
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = []
): Promise<xdr.ScVal | null> {
  try {
    const contract = new Contract(contractId);
    
    // We construct a mock transaction structure using a placeholder account for simulation
    // A placeholder account is needed since Soroban RPC requires a valid transaction envelope.
    // CDLZFC3SYJYDZT7K67VZ75HPJSIZMAFRHGVKNECE6ALBHGLMTZW4NNKQ is used as a dummy source.
    const dummySource = "GAAAAAAAABBBBBBBCCCCCCCCDDDDDDDDEEEEEEEEFFFFFFFFGHJKLMNT"; 
    const sourceAccount = new Account(dummySource, "1");

    const tx = new TransactionBuilder(sourceAccount, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(contract.call(functionName, ...args))
      .setTimeout(30)
      .build();

    const simulation = await rpcServer.simulateTransaction(tx);
    
    if (rpc.Api.isSimulationSuccess(simulation)) {
      // Extract result from simulation
      const resultVal = simulation.result?.retval;
      return resultVal || null;
    } else {
      console.warn("Simulation failed:", simulation.error);
      return null;
    }
  } catch (error) {
    console.error(`Simulation error calling ${functionName}:`, error);
    return null;
  }
}

/**
 * Build a transaction envelope for submission
 */
export async function buildTransaction(
  sourcePublicKey: string,
  contractId: string,
  functionName: string,
  args: xdr.ScVal[] = []
) {
  const account = await rpcServer.getAccount(sourcePublicKey);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(functionName, ...args))
    .setTimeout(60)
    .build();

  // Simulate to restore or set footprints automatically
  const simulation = await rpcServer.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(simulation)) {
    throw new Error(`Simulation failed: ${simulation.error || "unknown error"}`);
  }

  // Assemble transaction with simulation results
  return rpc.assembleTransaction(tx, simulation).build();
}

/**
 * Monitor transaction status until completion
 */
export async function pollTransaction(hash: string): Promise<rpc.Api.GetTransactionResponse> {
  const maxAttempts = 12;
  const delayMs = 2000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await rpcServer.getTransaction(hash);
    
    if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return response;
    } else if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${JSON.stringify(response.resultXdr)}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error("Transaction polling timed out");
}

/**
 * Helper to convert double-stroops (standard 7 decimal place scale)
 */
export function toStroops(amount: number | string): bigint {
  return BigInt(Math.round(Number(amount) * 10_000_000));
}

export function fromStroops(amount: bigint | string): number {
  return Number(amount) / 10_000_000;
}
