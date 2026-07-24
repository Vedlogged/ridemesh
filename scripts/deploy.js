const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { 
  Keypair, 
  rpc, 
  TransactionBuilder, 
  Networks, 
  BASE_FEE, 
  Operation, 
  xdr, 
  Address,
  StrKey
} = require("@stellar/stellar-sdk");

// Stellar Testnet Configuration
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const server = new rpc.Server(RPC_URL);
const PASSPHRASE = Networks.TESTNET;

// Path to compiled smart contract WASM
const WASM_PATH = path.join(__dirname, "../contracts/target/wasm32v1-none/release/ridemesh_contract.wasm");

async function deploy() {
  console.log("--------------------------------------------------");
  console.log(" RideMesh Smart Contract Deployment (Testnet)");
  console.log("--------------------------------------------------");

  // Ensure deployment secret key is configured
  const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
  if (!deployerSecret) {
    console.error("Error: DEPLOYER_SECRET_KEY environment variable is not set.");
    console.error("Please add it to your .env file.");
    process.exit(1);
  }

  const deployerKeypair = Keypair.fromSecret(deployerSecret);
  const deployerAddress = deployerKeypair.publicKey();
  console.log(`Deployer Address: ${deployerAddress}`);

  // 1. Verify WASM binary exists
  if (!fs.existsSync(WASM_PATH)) {
    console.error(`Error: WASM file not found at ${WASM_PATH}`);
    console.error("Please run the compilation command first:");
    console.error("  cd contracts && stellar contract build");
    process.exit(1);
  }

  const wasmBytes = fs.readFileSync(WASM_PATH);
  console.log(`WASM Size: ${(wasmBytes.length / 1024).toFixed(2)} KB`);

  // Load deployer account sequence
  console.log("Loading deployer account info...");
  let account;
  try {
    account = await server.getAccount(deployerAddress);
  } catch (error) {
    console.error("Error: Failed to load account. Is it funded on Testnet?");
    console.error(`Fund it here: https://friendbot.stellar.org/?addr=${deployerAddress}`);
    process.exit(1);
  }

  // 2. Upload / Install WASM bytecode
  console.log("1. Installing WASM bytecode on-chain...");
  const installOp = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeUploadContractWasm(wasmBytes),
    auth: []
  });

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(installOp)
    .setTimeout(60)
    .build();

  // Simulate to calculate fees and footprint
  let sim = await server.simulateTransaction(tx);
  if (sim.error) {
    console.error("Installation Simulation failed:", sim.error);
    process.exit(1);
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployerKeypair);

  console.log("Submitting Installation Transaction...");
  let sendResp = await server.sendTransaction(tx);
  if (sendResp.status === "ERROR") {
    console.error("Submission failed:", sendResp.errorResult);
    process.exit(1);
  }

  console.log(`Submitted. Hash: ${sendResp.hash}`);
  console.log("Waiting for confirmation...");
  let txResult = await pollTx(sendResp.hash);
  
  // Extract WASM Hash from events/result
  const wasmHash = txResult.resultMetaXdr
    .v3()
    .sorobanMeta()
    .returnValue()
    .bytes();
  
  const wasmHashHex = wasmHash.toString("hex");
  console.log(`✓ WASM installed successfully. WASM Hash: ${wasmHashHex}`);

  // Reload account sequence
  account = await server.getAccount(deployerAddress);

  // 3. Create / Instantiate Contract Instance
  console.log("\n2. Instantiating Contract Instance...");
  
  const constructorArgs = []; // Our contract does not have an init constructor
  
  const createOp = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeCreateContract(
      new xdr.CreateContractArgs({
        contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new xdr.ContractIdPreimageFromAddress({
            address: Address.fromString(deployerAddress).toScAddress(),
            salt: Buffer.alloc(32) // Use a 32-byte zero salt or random salt
          })
        ),
        executable: xdr.ContractExecutable.contractExecutableWasm(
          Buffer.from(wasmHashHex, "hex")
        )
      })
    ),
    auth: []
  });

  let instantiateTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(createOp)
    .setTimeout(60)
    .build();

  sim = await server.simulateTransaction(instantiateTx);
  if (sim.error) {
    console.error("Instantiation Simulation failed:", sim.error);
    process.exit(1);
  }

  instantiateTx = rpc.assembleTransaction(instantiateTx, sim).build();
  instantiateTx.sign(deployerKeypair);

  console.log("Submitting Instantiation Transaction...");
  sendResp = await server.sendTransaction(instantiateTx);
  if (sendResp.status === "ERROR") {
    console.error("Submission failed:", sendResp.errorResult);
    process.exit(1);
  }

  console.log(`Submitted. Hash: ${sendResp.hash}`);
  console.log("Waiting for confirmation...");
  txResult = await pollTx(sendResp.hash);

  // Extract Contract ID
  const contractAddressVal = txResult.resultMetaXdr
    .v3()
    .sorobanMeta()
    .returnValue();

  // Convert ScVal Address to string
  const contractId = Address.fromScVal(contractAddressVal).toString();
  console.log(`\n✓ Contract deployed successfully!`);
  console.log(`Contract ID: ${contractId}`);

  // 4. Store deployed Contract ID in env file
  updateEnvFile(contractId);
}

async function pollTx(hash) {
  const maxAttempts = 15;
  for (let i = 0; i < maxAttempts; i++) {
    const res = await server.getTransaction(hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return res;
    } else if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(`Transaction failed: ${JSON.stringify(res.resultXdr)}`);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error("Polling timed out");
}

function updateEnvFile(contractId) {
  const envPath = path.join(__dirname, "../.env");
  const envLocalPath = path.join(__dirname, "../.env.local");
  
  const content = `NEXT_PUBLIC_STELLAR_NETWORK="testnet"
NEXT_PUBLIC_RPC_URL="https://soroban-testnet.stellar.org"
NEXT_PUBLIC_HORIZON_URL="https://horizon-testnet.stellar.org"
NEXT_PUBLIC_CONTRACT_ID="${contractId}"
NEXT_PUBLIC_FARE_TOKEN_ID="CDLZFC3SYJYDZT7K67VZ75HPJSIZMAFRHGVKNECE6ALBHGLMTZW4NNKQ"
`;

  fs.writeFileSync(envLocalPath, content);
  console.log(`✓ Saved deployed contract config to .env.local`);
}

deploy().catch(err => {
  console.error("Deployment failed:", err);
});
