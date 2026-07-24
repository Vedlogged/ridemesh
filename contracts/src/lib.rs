#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, Vec, String, log
};

use soroban_sdk::token::Client as TokenClient;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Ride(u32),
    Driver(Address),
    RideCounter,
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
    pub reputation_score: u32, // Average rating * 10 (e.g., 47 = 4.7 stars)
    pub total_rides: u32,
    pub rating_sum: u32,
}

#[contract]
pub struct RideMeshContract;

#[contractimpl]
impl RideMeshContract {
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

        // Update driver profile
        let driver_address = ride.driver.clone();
        let mut profile = env.storage().persistent().get(&DataKey::Driver(driver_address.clone()))
            .unwrap_or(DriverProfile {
                address: driver_address.clone(),
                reputation_score: 0,
                total_rides: 0,
                rating_sum: 0,
            });

        profile.total_rides += 1;
        profile.rating_sum += rating;
        profile.reputation_score = (profile.rating_sum * 10) / profile.total_rides;

        env.storage().persistent().set(&DataKey::Driver(driver_address.clone()), &profile);

        // Emit event
        env.events().publish(
            (symbol_short!("driver_rt"), driver_address, ride_id),
            rating
        );
    }

    // View functions
    pub fn get_ride(env: Env, ride_id: u32) -> Option<Ride> {
        env.storage().persistent().get(&DataKey::Ride(ride_id))
    }

    pub fn get_driver(env: Env, driver: Address) -> Option<DriverProfile> {
        env.storage().persistent().get(&DataKey::Driver(driver))
    }

    pub fn get_ride_counter(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::RideCounter).unwrap_or(0)
    }
}
