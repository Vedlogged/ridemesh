/* eslint-disable */
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
  nativeToScVal,
  Contract
} = require("@stellar/stellar-sdk");

// Stellar Testnet Configuration
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const server = new rpc.Server(RPC_URL);
const PASSPHRASE = Networks.TESTNET;

// Paths to compiled smart contract WASM binaries
const DRIVER_IDENTITY_WASM_PATH = path.join(__dirname, "../contracts/target/wasm32v1-none/release/driver_identity_contract.wasm");
const REPUTATION_WASM_PATH = path.join(__dirname, "../contracts/target/wasm32v1-none/release/reputation_contract.wasm");
const ESCROW_WASM_PATH = path.join(__dirname, "../contracts/target/wasm32v1-none/release/escrow_contract.wasm");

async function deploy() {
  console.log("----------------------------------------------------------------");
  console.log(" RideMesh X Smart Contracts Deployment (Stellar Testnet)");
  console.log("----------------------------------------------------------------");

  const deployerSecret = process.env.DEPLOYER_SECRET_KEY;
  if (!deployerSecret) {
    console.error("Error: DEPLOYER_SECRET_KEY environment variable is not set.");
    console.error("Please add it to your .env.local file.");
    process.exit(1);
  }

  const deployerKeypair = Keypair.fromSecret(deployerSecret);
  const deployerAddress = deployerKeypair.publicKey();
  console.log(`Deployer Address: ${deployerAddress}`);

  // Check account existence
  console.log("Loading deployer account info...");
  try {
    await server.getAccount(deployerAddress);
  } catch (error) {
    console.error("Error: Failed to load account. Is it funded on Testnet?");
    console.error(`Fund it here: https://friendbot.stellar.org/?addr=${deployerAddress}`);
    process.exit(1);
  }

  // 1. Install & Deploy Driver Identity Contract
  console.log("\n>>> Step 1: Uploading & Deploying Driver Identity Contract...");
  const driverIdentityWasmHash = await installWasm(DRIVER_IDENTITY_WASM_PATH, deployerKeypair, deployerAddress);
  const driverIdentityContractId = await instantiateContract(driverIdentityWasmHash, deployerKeypair, deployerAddress, 1);
  console.log(`✓ Driver Identity Contract Deployed at: ${driverIdentityContractId}`);

  // 2. Install & Deploy Reputation Contract
  console.log("\n>>> Step 2: Uploading & Deploying Reputation Contract...");
  const reputationWasmHash = await installWasm(REPUTATION_WASM_PATH, deployerKeypair, deployerAddress);
  const reputationContractId = await instantiateContract(reputationWasmHash, deployerKeypair, deployerAddress, 2);
  console.log(`✓ Reputation Contract Deployed at: ${reputationContractId}`);

  // 3. Install & Deploy Escrow Contract
  console.log("\n>>> Step 3: Uploading & Deploying Escrow Contract...");
  const escrowWasmHash = await installWasm(ESCROW_WASM_PATH, deployerKeypair, deployerAddress);
  const escrowContractId = await instantiateContract(escrowWasmHash, deployerKeypair, deployerAddress, 3);
  console.log(`✓ Escrow Contract Deployed at: ${escrowContractId}`);

  // 4. Cross-linking contracts on-chain
  console.log("\n>>> Step 4: Cross-Linking & Initializing Contracts...");
  
  // Call init(deployerAddress) on driver identity contract
  await callContractInitSingle(driverIdentityContractId, deployerAddress, deployerKeypair, deployerAddress);

  // Call init(escrowContractId) on reputation contract
  await callContractInitSingle(reputationContractId, escrowContractId, deployerKeypair, deployerAddress);

  // Call init(reputationContractId, driverIdentityContractId) on escrow contract
  await callEscrowContractInit(escrowContractId, reputationContractId, driverIdentityContractId, deployerKeypair, deployerAddress);

  // 5. Save deployed IDs to env config
  updateEnvFile(escrowContractId, reputationContractId, driverIdentityContractId);

  console.log("\n----------------------------------------------------------------");
  console.log("✓ All deployments and cross-linking initialization complete!");
  console.log(`- Escrow Contract ID: ${escrowContractId}`);
  console.log(`- Reputation Contract ID: ${reputationContractId}`);
  console.log(`- Driver Identity Contract ID: ${driverIdentityContractId}`);
  console.log("----------------------------------------------------------------");
}

async function installWasm(wasmPath, deployerKeypair, deployerAddress) {
  if (!fs.existsSync(wasmPath)) {
    console.error(`Error: WASM file not found at ${wasmPath}`);
    console.error("Please run the compilation command first:");
    console.error("  cd contracts && cargo build --target wasm32-unknown-unknown --release");
    process.exit(1);
  }

  const wasmBytes = fs.readFileSync(wasmPath);
  console.log(`Installing WASM: ${path.basename(wasmPath)} (${(wasmBytes.length / 1024).toFixed(2)} KB)...`);

  let account = await server.getAccount(deployerAddress);
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

  let sim = await server.simulateTransaction(tx);
  if (sim.error) {
    throw new Error(`WASM Installation Simulation failed: ${JSON.stringify(sim.error)}`);
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployerKeypair);

  let sendResp = await server.sendTransaction(tx);
  if (sendResp.status === "ERROR") {
    throw new Error(`Submission failed: ${JSON.stringify(sendResp.errorResult)}`);
  }

  console.log(`Submitted install tx. Hash: ${sendResp.hash}. Waiting for confirmation...`);
  let txResult = await pollTx(sendResp.hash);
  const wasmHash = txResult.resultMetaXdr
    .v3()
    .sorobanMeta()
    .returnValue()
    .bytes();
  
  return wasmHash.toString("hex");
}

async function instantiateContract(wasmHashHex, deployerKeypair, deployerAddress, saltOffset) {
  console.log(`Instantiating contract with salt offset ${saltOffset}...`);
  let account = await server.getAccount(deployerAddress);

  // Deterministic 32-byte salt
  const salt = Buffer.alloc(32);
  salt.writeUInt32BE(saltOffset, 28);

  const createOp = Operation.invokeHostFunction({
    func: xdr.HostFunction.hostFunctionTypeCreateContract(
      new xdr.CreateContractArgs({
        contractIdPreimage: xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new xdr.ContractIdPreimageFromAddress({
            address: Address.fromString(deployerAddress).toScAddress(),
            salt: salt
          })
        ),
        executable: xdr.ContractExecutable.contractExecutableWasm(
          Buffer.from(wasmHashHex, "hex")
        )
      })
    ),
    auth: []
  });

  let tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(createOp)
    .setTimeout(60)
    .build();

  let sim = await server.simulateTransaction(tx);
  if (sim.error) {
    throw new Error(`Instantiation Simulation failed: ${JSON.stringify(sim.error)}`);
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployerKeypair);

  let sendResp = await server.sendTransaction(tx);
  if (sendResp.status === "ERROR") {
    throw new Error(`Submission failed: ${JSON.stringify(sendResp.errorResult)}`);
  }

  console.log(`Submitted instantiate tx. Hash: ${sendResp.hash}. Waiting for confirmation...`);
  let txResult = await pollTx(sendResp.hash);
  const contractAddressVal = txResult.resultMetaXdr
    .v3()
    .sorobanMeta()
    .returnValue();

  return Address.fromScVal(contractAddressVal).toString();
}

async function callContractInitSingle(contractId, addressArg, deployerKeypair, deployerAddress) {
  console.log(`Calling init() on contract ${contractId} with address ${addressArg}...`);
  let account = await server.getAccount(deployerAddress);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      contract.call("init", nativeToScVal(Address.fromString(addressArg)))
    )
    .setTimeout(60)
    .build();

  let sim = await server.simulateTransaction(tx);
  if (sim.error) {
    throw new Error(`Call to init() simulation failed: ${JSON.stringify(sim.error)}`);
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployerKeypair);

  let sendResp = await server.sendTransaction(tx);
  if (sendResp.status === "ERROR") {
    throw new Error(`Submission failed: ${JSON.stringify(sendResp.errorResult)}`);
  }

  console.log(`Submitted init call. Hash: ${sendResp.hash}. Waiting...`);
  await pollTx(sendResp.hash);
  console.log(`✓ Initialized contract ${contractId}`);
}

async function callEscrowContractInit(escrowId, reputationId, identityId, deployerKeypair, deployerAddress) {
  console.log(`Calling init(${reputationId}, ${identityId}) on Escrow Contract ${escrowId}...`);
  let account = await server.getAccount(deployerAddress);
  const contract = new Contract(escrowId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "init", 
        nativeToScVal(Address.fromString(reputationId)),
        nativeToScVal(Address.fromString(identityId))
      )
    )
    .setTimeout(60)
    .build();

  let sim = await server.simulateTransaction(tx);
  if (sim.error) {
    throw new Error(`Call to escrow init() simulation failed: ${JSON.stringify(sim.error)}`);
  }

  tx = rpc.assembleTransaction(tx, sim).build();
  tx.sign(deployerKeypair);

  let sendResp = await server.sendTransaction(tx);
  if (sendResp.status === "ERROR") {
    throw new Error(`Submission failed: ${JSON.stringify(sendResp.errorResult)}`);
  }

  console.log(`Submitted escrow init call. Hash: ${sendResp.hash}. Waiting...`);
  await pollTx(sendResp.hash);
  console.log(`✓ Initialized Escrow Contract ${escrowId}`);
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

function updateEnvFile(escrowId, reputationId, identityId) {
  const envLocalPath = path.join(__dirname, "../.env.local");
  
  const content = `NEXT_PUBLIC_STELLAR_NETWORK="testnet"
NEXT_PUBLIC_RPC_URL="https://soroban-testnet.stellar.org"
NEXT_PUBLIC_HORIZON_URL="https://horizon-testnet.stellar.org"
NEXT_PUBLIC_CONTRACT_ID="${escrowId}"
NEXT_PUBLIC_REPUTATION_CONTRACT_ID="${reputationId}"
NEXT_PUBLIC_DRIVER_IDENTITY_CONTRACT_ID="${identityId}"
NEXT_PUBLIC_FARE_TOKEN_ID="CDLZFC3SYJYDZT7K67VZ75HPJSIZMAFRHGVKNECE6ALBHGLMTZW4NNKQ"
NEXT_PUBLIC_BACKEND_URL="http://localhost:5001"
`;

  fs.writeFileSync(envLocalPath, content);
  console.log(`✓ Saved deployed contract configs to .env.local`);
}

deploy().catch(err => {
  console.error("Deployment failed:", err);
});
