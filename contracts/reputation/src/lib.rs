#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Driver(Address),
    RideMeshContract,
    Initialized,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DriverProfile {
    pub address: Address,
    pub reputation_score: u32, // Average rating * 10 (e.g., 47 = 4.7 stars)
    pub total_rides: u32,
    pub rating_sum: u32,
}

#[contract]
pub struct ReputationContract;

#[contractimpl]
impl ReputationContract {
    // Initialize the contract with the authorized RideMesh contract address
    pub fn init(env: Env, ridemesh_contract: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::RideMeshContract, &ridemesh_contract);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    // Update reputation score of a driver (invoked by RideMeshContract)
    pub fn update_reputation(env: Env, caller: Address, driver: Address, rating: u32) -> DriverProfile {
        caller.require_auth();

        let ridemesh: Address = env.storage().instance().get(&DataKey::RideMeshContract)
            .expect("Reputation contract not initialized");

        if caller != ridemesh {
            panic!("Only the RideMesh contract can update driver reputation");
        }

        if rating < 1 || rating > 5 {
            panic!("Rating must be between 1 and 5");
        }

        let mut profile = env.storage().persistent().get(&DataKey::Driver(driver.clone()))
            .unwrap_or(DriverProfile {
                address: driver.clone(),
                reputation_score: 0,
                total_rides: 0,
                rating_sum: 0,
            });

        profile.total_rides += 1;
        profile.rating_sum += rating;
        profile.reputation_score = (profile.rating_sum * 10) / profile.total_rides;

        env.storage().persistent().set(&DataKey::Driver(driver), &profile);
        profile
    }

    // Get the reputation profile of a driver
    pub fn get_driver(env: Env, driver: Address) -> Option<DriverProfile> {
        env.storage().persistent().get(&DataKey::Driver(driver))
    }
}
