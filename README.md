# RideMesh X 🚕

RideMesh X is a decentralized, production-ready ride-sharing platform and secure payment escrow protocol built on the **Stellar Testnet** using **Soroban Smart Contracts**. 

It provides secure passenger-to-driver escrows, immutable driver registries, and trustless on-chain reputation scores, eliminating middleman fees.

---

## 🌟 Core Features

- **Multi-Wallet Integration**: Built with `StellarWalletsKit`, supporting Freighter, Albedo, xBull, and a built-in Sandbox Simulator.
- **Secure Token Escrow**: Fares are deposited inside a Soroban smart contract, releasing payment to the driver only upon arrival validation. Passenger refunds are guaranteed if the ride is cancelled.
- **On-Chain Driver Identity**: Driver profiles (Name, Plate #, Car Class, and License CID) are stored directly on the Stellar ledger, awaiting administrative verification.
- **Immutable Reputation Scores**: Passenger ratings update driver rankings directly inside contract storage via cross-contract calls, powering a public leaderboard.
- **Express Polling & WebSocket Sync**: An Express Node.js event listener indexer polls ledgers for Soroban events and pushes live updates to the frontend via WebSockets.
- **Analytics Console**: Real-time dashboards visualizing Escrow flow distribution, completed trips, settled volume, and active daily users.
- **Onboarding Feedback Engine**: Built-in survey and comments guestbook showing audit trails for user connection testing, matching Level 4 criteria.

---

## 📐 Architecture Diagram

```mermaid
graph TD
    %% Roles
    Passenger[Passenger App]
    Driver[Driver App]
    
    %% Backend & Indexer
    Express[Express Backend / API Server]
    Listener[Blockchain Event Listener Daemon]
    LocalDB[(PostgreSQL / MongoDB / JSON File)]
    
    %% Contracts Workspace
    subgraph Soroban Smart Contracts (Stellar Testnet)
        Escrow[Escrow Smart Contract]
        Identity[Driver Identity Contract]
        Reputation[Reputation Contract]
    end

    %% Passenger Actions
    Passenger -- 1. request_ride (escrows fare) --> Escrow
    Passenger -- 3. complete_ride (releases fare) --> Escrow
    Passenger -- 4. rate_driver --> Escrow
    
    %% Driver Actions
    Driver -- register_driver --> Identity
    Driver -- accept_ride --> Escrow
    
    %% Identity check
    Escrow -- verifies credentials --> Identity
    
    %% Rating check
    Escrow -- calls update_reputation --> Reputation

    %% Indexing Pipeline
    Listener -- polls ledger events --> Escrow
    Listener -- polls ledger events --> Reputation
    Listener -- updates state --> LocalDB
    
    %% Client Sync
    Express -- serves HTTP REST /api --> Passenger
    Express -- WebSocket notifications --> Passenger
```

---

## 📂 Project Structure

```text
/ridemesh
├── /backend              # Express API Server (Node.js & TypeScript)
│   ├── /data             # Local JSON Database Fallback (zero-config)
│   ├── /src
│   │   ├── /config       # Mongoose / SQLite DB connectors
│   │   ├── /models       # Ride, Driver schema definitions
│   │   ├── /routes       # REST API Endpoints
│   │   ├── /services     # WebSocket notifications
│   │   ├── listener.ts   # Stellar Soroban Event Polling Daemon
│   │   └── server.ts     # Express entrypoint
│   ├── package.json
│   └── tsconfig.json
├── /app                  # Next.js 16 app pages (UI Dashboards)
├── /components           # Dashboards, Modals, Loader widgets
├── /contracts            # Soroban Cargo Smart Contract Workspace
│   ├── /escrow           # Core Ride Escrow contract (member)
│   │   └── /src/lib.rs
│   ├── /driver_identity  # Driver Profile registry contract (member)
│   │   └── /src/lib.rs
│   ├── /reputation       # Driver reputation ranking contract (member)
│   │   └── /src/lib.rs
│   └── Cargo.toml
├── /hooks                # Custom React hook stores (useStellar)
├── /lib                  # Shared Stellar / Horizon connection clients
├── /scripts              # JS build and contract deployment scripts
├── package.json
└── README.md
```

---

## ⚡ API Documentation (Express Indexer Backend)

The Express backend runs on `http://localhost:5001`.

### 1. General Endpoints

* **GET `/`**: Basic server status and network verification.
* **GET `/api/rides`**: Retrieve all synchronised ride escrows on the ledger.
* **GET `/api/drivers`**: Retrieve all registered drivers sorted by on-chain reputation.
* **GET `/api/analytics`**: Compiles platform statistics:
  ```json
  {
    "metrics": {
      "totalRides": 25,
      "completedRides": 18,
      "activeEscrows": 3,
      "cancelledRides": 4,
      "escrowVolumeTotal": 2450.50,
      "escrowVolumeActive": 300.00,
      "escrowVolumeSettled": 2150.50,
      "averageRating": 4.82,
      "dailyActiveUsers": 12,
      "totalDrivers": 5
    },
    "walletActivity": ["GB...12", "GD...34"]
  }
  ```
* **POST `/api/verify-wallet`**: Generates connection session token for wallet challenge verification.
* **POST `/api/feedback`**: Submit user wallet connection experience rating and audit comments.
* **GET `/api/feedback`**: Retrieve list of all onboarding connection reviews.

### 2. Sandbox Mode Synchronisation Helpers

* **POST `/api/sandbox/rides`**: Simulates and index sandbox ride bookings.
* **POST `/api/sandbox/drivers`**: Register a driver profile in sandbox database.
* **POST `/api/sandbox/drivers/verify`**: Approve driver verification status in local sandbox mode.

---

## 🛠️ Installation & Setup

### 1. Backend Service
Configure environment keys in `backend/.env` (optional, defaults to local JSON storage fallback):
```bash
cd backend
npm install
npm run dev # Starts server on http://localhost:5001
```

### 2. Next.js Frontend App
```bash
# From workspace root
npm install
npm run dev # Launches UI on http://localhost:3000
```

### 3. Smart Contracts Unit Testing
To run the Cargo workspace unit tests:
```bash
cd contracts
cargo test
```
To run the Vitest frontend store tests:
```bash
npm run test
```

---

## 🚀 Deployed Smart Contracts

* **Escrow Contract Address**: `CACD35GOH4UXJSHR7XEX2YGB5P2GWRQFLRQLOOM7DGLTZWWRHMESH4U2`
* **Reputation Contract Address**: `CB4XQ7Q4E4UXJSHR7XEX2YGB5P2GWRQFLRQLOOM7DGLTZWWRHMESH4U2`
* **Driver Identity Contract Address**: `CCDRIVERID4UXJSHR7XEX2YGB5P2GWRQFLRQLOOM7DGLTZWWRHMESH4U2`

*Deployments configured deterministic salt offsets (`deploy.js` step 4) for cross-linking.*

---

## 🔮 Future Roadmap

1. **On-Chain Dispute Arbitration**: Implementing multisig/DAO dispute resolution if passengers claim cancel refunds but drivers have initiated trips.
2. **Dynamic Surge Pricing**: Setting algorithmic escrows depending on real-time driver density indexed by the Express backend.
3. **Optimized Zero-Knowledge Driver Verification**: Encrypting license documents with ZK-proofs rather than direct storage hashes.
