#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Address, Env, String};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    DriverAlreadyRegistered = 2,
    NotAuthorized = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Driver(Address),
    Admin,
    Initialized,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DriverProfile {
    pub wallet: Address,
    pub name: String,
    pub vehicle_number: String,
    pub vehicle_type: String,
    pub license_hash: String,
    pub is_verified: bool,
    pub registration_date: u64,
}

#[contract]
pub struct DriverIdentityContract;

#[contractimpl]
impl DriverIdentityContract {
    // Initialize the contract with the administrator address
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Initialized) {
            env.panic_with_error(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Initialized, &true);
    }

    // Register a driver (called by the driver, requires auth)
    pub fn register_driver(
        env: Env,
        driver: Address,
        name: String,
        vehicle_num: String,
        vehicle_type: String,
        license_hash: String,
    ) -> DriverProfile {
        driver.require_auth();

        let profile_key = DataKey::Driver(driver.clone());
        if env.storage().persistent().has(&profile_key) {
            env.panic_with_error(Error::DriverAlreadyRegistered);
        }

        let timestamp = env.ledger().timestamp();
        let profile = DriverProfile {
            wallet: driver.clone(),
            name,
            vehicle_number: vehicle_num,
            vehicle_type,
            license_hash,
            is_verified: false, // verification is done by admin later
            registration_date: timestamp,
        };

        env.storage().persistent().set(&profile_key, &profile);
        profile
    }

    // Verify a driver (called by admin, requires admin auth)
    pub fn verify_driver(env: Env, admin: Address, driver: Address) -> DriverProfile {
        admin.require_auth();

        let contract_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("Admin not set");

        if admin != contract_admin {
            env.panic_with_error(Error::NotAuthorized);
        }

        let profile_key = DataKey::Driver(driver.clone());
        let mut profile: DriverProfile = env
            .storage()
            .persistent()
            .get(&profile_key)
            .expect("Driver not registered");

        profile.is_verified = true;
        env.storage().persistent().set(&profile_key, &profile);
        profile
    }

    // Update vehicle details (called by driver, requires auth)
    pub fn update_vehicle(
        env: Env,
        driver: Address,
        vehicle_num: String,
        vehicle_type: String,
    ) -> DriverProfile {
        driver.require_auth();

        let profile_key = DataKey::Driver(driver.clone());
        let mut profile: DriverProfile = env
            .storage()
            .persistent()
            .get(&profile_key)
            .expect("Driver profile not found");

        profile.vehicle_number = vehicle_num;
        profile.vehicle_type = vehicle_type;

        env.storage().persistent().set(&profile_key, &profile);
        profile
    }

    // Get the driver profile
    pub fn get_driver(env: Env, driver: Address) -> Option<DriverProfile> {
        env.storage().persistent().get(&DataKey::Driver(driver))
    }
}

mod test;
