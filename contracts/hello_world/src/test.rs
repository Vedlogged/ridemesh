#![cfg(test)]

use super::*;
use reputation_contract::ReputationContract;
use soroban_sdk::{
    testutils::Address as _, token, Address, Env, IntoVal
};

#[test]
fn test_ride_sharing_complete_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Register Reputation contract
    let reputation_id = env.register_contract(None, ReputationContract);
    let reputation_client = ReputationClient::new(&env, &reputation_id);

    // 2. Register RideMesh contract
    let ridemesh_id = env.register_contract(None, RideMeshContract);
    let ridemesh_client = RideMeshContractClient::new(&env, &ridemesh_id);

    // 3. Initialize both contracts (cross-link them)
    reputation_client.init(&ridemesh_id);
    ridemesh_client.init(&reputation_id);

    // 4. Create passenger and driver
    let passenger = Address::generate(&env);
    let driver = Address::generate(&env);

    // Register token contract mock
    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(admin.clone());
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    // Mint tokens to passenger
    let fare = 100_000_000i128; // e.g. 10.0 tokens
    token_admin_client.mint(&passenger, &fare);
    assert_eq!(token_client.balance(&passenger), fare);

    // 5. Test requesting a ride
    let ride_id = ridemesh_client.request_ride(&passenger, &token_id, &fare);
    assert_eq!(ride_id, 1);
    assert_eq!(token_client.balance(&passenger), 0);
    assert_eq!(token_client.balance(&ridemesh_id), fare);

    let ride = ridemesh_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.passenger, passenger);
    assert_eq!(ride.fare, fare);
    assert_eq!(ride.status, 0); // Requested

    // 6. Test accepting a ride
    ridemesh_client.accept_ride(&ride_id, &driver);
    let ride = ridemesh_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.driver, driver);
    assert_eq!(ride.status, 1); // Accepted

    // 7. Test completing a ride (release fare escrow to driver)
    ridemesh_client.complete_ride(&ride_id, &token_id);
    let ride = ridemesh_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.status, 2); // Completed
    assert_eq!(token_client.balance(&ridemesh_id), 0);
    assert_eq!(token_client.balance(&driver), fare);

    // 8. Test rating a driver (triggers inter-contract call)
    ridemesh_client.rate_driver(&ride_id, &5);
    
    // Verify reputation through get_driver call in RideMesh which forwards to Reputation
    let profile = ridemesh_client.get_driver(&driver).unwrap();
    assert_eq!(profile.address, driver);
    assert_eq!(profile.reputation_score, 50); // 5.0 * 10
    assert_eq!(profile.total_rides, 1);
    assert_eq!(profile.rating_sum, 5);
}

#[test]
fn test_reputation_unauthorized_direct_call() {
    let env = Env::default();
    env.mock_all_auths();

    let reputation_id = env.register_contract(None, ReputationContract);
    let reputation_client = ReputationClient::new(&env, &reputation_id);

    let ridemesh_id = env.register_contract(None, RideMeshContract);
    
    // Initialize Reputation with RideMesh address
    reputation_client.init(&ridemesh_id);

    let driver = Address::generate(&env);
    
    // Direct call should panic as the caller parameter passed is random, but even if we claim to be RideMesh,
    // the actual caller signature is checked under Soroban auth framework or verified matching the parameter auth.
    // In our update_reputation implementation:
    // `caller.require_auth()` validates that `caller` authorized the operation.
    // If we pass `ridemesh_id` as caller, it will fail because the random caller cannot auth on behalf of the RideMesh contract ID.
    // If we pass `random_caller`, the auth succeeds for `random_caller` but fails the check `caller == ridemesh_contract`.
    let random_caller = Address::generate(&env);
    let result = reputation_client.try_update_reputation(&random_caller, &driver, &5);
    assert!(result.is_err());
}

#[test]
fn test_cancel_and_refund_ride() {
    let env = Env::default();
    env.mock_all_auths();

    let reputation_id = env.register_contract(None, ReputationContract);
    let ridemesh_id = env.register_contract(None, RideMeshContract);
    
    let ridemesh_client = RideMeshContractClient::new(&env, &ridemesh_id);
    ridemesh_client.init(&reputation_id);

    let passenger = Address::generate(&env);
    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(admin);
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let fare = 50_000_000i128;
    token_admin_client.mint(&passenger, &fare);

    let ride_id = ridemesh_client.request_ride(&passenger, &token_id, &fare);
    assert_eq!(token_client.balance(&passenger), 0);

    // Cancel ride by passenger
    ridemesh_client.cancel_ride(&ride_id, &token_id, &passenger);
    
    let ride = ridemesh_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.status, 3); // Cancelled
    assert_eq!(token_client.balance(&passenger), fare); // Refunded
}
