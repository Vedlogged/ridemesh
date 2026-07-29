#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec, String, contractclient
};

use soroban_sdk::token::Client as TokenClient;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Ride(u32),
    RideCounter,
    ReputationContract,
    Initialized,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Ride {
    pub id: u32,
    pub passenger: Address,
    pub driver: Address,
    pub fare: i128,
    pub status: u32, // 0 = Requested, 1 = Accepted, 2 = Completed, 3 = Cancelled
    pub rating: u32, // 0 = Unrated, 1-5 = Rated
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DriverProfile {
    pub address: Address,
    pub reputation_score: u32, // Average rating * 10
    pub total_rides: u32,
    pub rating_sum: u32,
}

// Client definition for the Reputation contract to enable inter-contract communication
#[contractclient(name = "ReputationClient")]
pub trait ReputationContractTrait {
    fn init(env: Env, ridemesh_contract: Address);
    fn update_reputation(env: Env, caller: Address, driver: Address, rating: u32) -> DriverProfile;
    fn get_driver(env: Env, driver: Address) -> Option<DriverProfile>;
}

#[contract]
pub struct RideMeshContract;

#[contractimpl]
impl RideMeshContract {
    // Initialize the contract with the reputation contract address
    pub fn init(env: Env, reputation_contract: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::ReputationContract, &reputation_contract);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    // Request a ride by escrowing the fare
    pub fn request_ride(env: Env, passenger: Address, token: Address, fare: i128) -> u32 {
        passenger.require_auth();

        // Get and increment the ride counter
        let mut ride_id: u32 = env.storage().instance().get(&DataKey::RideCounter).unwrap_or(0);
        ride_id += 1;
        env.storage().instance().set(&DataKey::RideCounter, &ride_id);

        // Lock funds in escrow (transfer from passenger to this contract)
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&passenger, &env.current_contract_address(), &fare);

        let timestamp = env.ledger().timestamp();

        // Create the Ride struct
        let ride = Ride {
            id: ride_id,
            passenger: passenger.clone(),
            // Initially, the driver is set to the passenger as a placeholder address
            driver: passenger.clone(), 
            fare,
            status: 0, // Requested
            rating: 0,
            timestamp,
        };

        // Save the ride
        env.storage().persistent().set(&DataKey::Ride(ride_id), &ride);

        // Emit event
        env.events().publish(
            (symbol_short!("ride_req"), passenger, ride_id),
            fare
        );

        ride_id
    }

    // A driver accepts the requested ride
    pub fn accept_ride(env: Env, ride_id: u32, driver: Address) {
        driver.require_auth();

        let mut ride: Ride = env.storage().persistent().get(&DataKey::Ride(ride_id))
            .expect("Ride not found");

        if ride.status != 0 {
            panic!("Ride is not in Requested state");
        }

        ride.driver = driver.clone();
        ride.status = 1; // Accepted

        env.storage().persistent().set(&DataKey::Ride(ride_id), &ride);

        // Emit event
        env.events().publish(
            (symbol_short!("ride_acc"), driver, ride_id),
            ride.fare
        );
    }

    // Complete the ride and release the fare to the driver
    pub fn complete_ride(env: Env, ride_id: u32, token: Address) {
        let mut ride: Ride = env.storage().persistent().get(&DataKey::Ride(ride_id))
            .expect("Ride not found");

        ride.passenger.require_auth();

        if ride.status != 1 {
            panic!("Ride is not in Accepted state");
        }

        ride.status = 2; // Completed

        // Release escrowed funds to the driver
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &ride.driver, &ride.fare);

        env.storage().persistent().set(&DataKey::Ride(ride_id), &ride);

        // Emit event
        env.events().publish(
            (symbol_short!("ride_comp"), ride.driver.clone(), ride_id),
            ride.fare
        );
    }

    // Cancel a ride and refund the passenger
    pub fn cancel_ride(env: Env, ride_id: u32, token: Address, requester: Address) {
        requester.require_auth();

        let mut ride: Ride = env.storage().persistent().get(&DataKey::Ride(ride_id))
            .expect("Ride not found");

        if requester != ride.passenger && requester != ride.driver {
            panic!("Unauthorized to cancel this ride");
        }

        // Only allow cancel if Requested (0) or Accepted (1)
        if ride.status > 1 {
            panic!("Ride cannot be cancelled at this stage");
        }

        ride.status = 3; // Cancelled

        // Refund passenger
        let token_client = TokenClient::new(&env, &token);
        token_client.transfer(&env.current_contract_address(), &ride.passenger, &ride.fare);

        env.storage().persistent().set(&DataKey::Ride(ride_id), &ride);

        // Emit event
        env.events().publish(
            (symbol_short!("ride_canc"), requester, ride_id),
            ride.fare
        );
    }

    // Passenger rates the driver and updates their reputation score
    pub fn rate_driver(env: Env, ride_id: u32, rating: u32) {
        let mut ride: Ride = env.storage().persistent().get(&DataKey::Ride(ride_id))
            .expect("Ride not found");

        ride.passenger.require_auth();

        if ride.status != 2 {
            panic!("Ride is not completed yet");
        }

        if ride.rating != 0 {
            panic!("Driver already rated for this ride");
        }

        if rating < 1 || rating > 5 {
            panic!("Rating must be between 1 and 5");
        }

        ride.rating = rating;
        env.storage().persistent().set(&DataKey::Ride(ride_id), &ride);

        // Update driver profile in Reputation Contract via inter-contract call
        let reputation_contract_address: Address = env.storage().instance().get(&DataKey::ReputationContract)
            .expect("Reputation contract address not set");

        let reputation_client = ReputationClient::new(&env, &reputation_contract_address);
        reputation_client.update_reputation(&env.current_contract_address(), &ride.driver, &rating);

        // Emit event
        env.events().publish(
            (symbol_short!("driver_rt"), ride.driver, ride_id),
            rating
        );
    }

    // View functions
    pub fn get_ride(env: Env, ride_id: u32) -> Option<Ride> {
        env.storage().persistent().get(&DataKey::Ride(ride_id))
    }

    // Query reputation details from Reputation contract (read-only cross-contract delegation)
    pub fn get_driver(env: Env, driver: Address) -> Option<DriverProfile> {
        let reputation_contract_address: Address = env.storage().instance().get(&DataKey::ReputationContract)
            .expect("Reputation contract address not set");
        let reputation_client = ReputationClient::new(&env, &reputation_contract_address);
        reputation_client.get_driver(&driver)
    }

    pub fn get_ride_counter(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::RideCounter).unwrap_or(0)
    }
}

mod test;
