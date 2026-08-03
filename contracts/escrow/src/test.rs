#![cfg(test)]

use super::*;
use reputation_contract::ReputationContract;
use driver_identity_contract::DriverIdentityContract;
use soroban_sdk::{
    testutils::Address as _, token, Address, Env, String
};

#[test]
fn test_escrow_sharing_complete_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Register Reputation contract
    let reputation_id = env.register_contract(None, ReputationContract);
    let reputation_client = ReputationClient::new(&env, &reputation_id);

    // 2. Register Driver Identity contract
    let identity_id = env.register_contract(None, DriverIdentityContract);
    let identity_client = DriverIdentityClient::new(&env, &identity_id);

    // 3. Register Escrow contract
    let escrow_id = env.register_contract(None, RideMeshEscrowContract);
    let escrow_client = RideMeshEscrowContractClient::new(&env, &escrow_id);

    // Initialize contracts
    reputation_client.init(&escrow_id);
    identity_client.init(&escrow_id); // set admin to escrow address for testing simplicity
    escrow_client.init(&reputation_id, &identity_id);

    // 4. Create passenger and driver
    let passenger = Address::generate(&env);
    let driver = Address::generate(&env);

    // 5. Register and Verify Driver in Driver Identity contract
    let name = String::from_str(&env, "Driver Bob");
    let vehicle_num = String::from_str(&env, "CAR-7890");
    let vehicle_type = String::from_str(&env, "UberX Custom");
    let license_hash = String::from_str(&env, "license_file_hash");

    // Register driver
    identity_client.register_driver(&driver, &name, &vehicle_num, &vehicle_type, &license_hash);
    
    // Verify driver (using escrow_id as mock admin auth)
    identity_client.verify_driver(&escrow_id, &driver);

    // 6. Set up Stellar Asset token
    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(admin.clone());
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let fare = 150_000_000i128; // 15.0 tokens
    token_admin_client.mint(&passenger, &fare);
    assert_eq!(token_client.balance(&passenger), fare);

    // 7. Request a ride (funds locked in Escrow)
    let ride_id = escrow_client.request_ride(&passenger, &token_id, &fare);
    assert_eq!(ride_id, 1);
    assert_eq!(token_client.balance(&passenger), 0);
    assert_eq!(token_client.balance(&escrow_id), fare);

    let ride = escrow_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.status, 0); // Requested

    // 8. Accept Ride
    escrow_client.accept_ride(&ride_id, &driver);
    let ride = escrow_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.driver, driver);
    assert_eq!(ride.status, 1); // Accepted

    // 9. Complete Ride (funds released to driver)
    escrow_client.complete_ride(&ride_id, &token_id);
    assert_eq!(token_client.balance(&escrow_id), 0);
    assert_eq!(token_client.balance(&driver), fare);

    let ride = escrow_client.get_ride(&ride_id).unwrap();
    assert_eq!(ride.status, 2); // Completed

    // 10. Rate Driver (updates reputation score)
    escrow_client.rate_driver(&ride_id, &4);
    let profile = escrow_client.get_driver(&driver).unwrap();
    assert_eq!(profile.reputation_score, 40); // 4.0 * 10
}

#[test]
#[should_panic(expected = "Driver profile not registered on-chain")]
fn test_unregistered_driver_cannot_accept() {
    let env = Env::default();
    env.mock_all_auths();

    let reputation_id = env.register_contract(None, ReputationContract);
    let identity_id = env.register_contract(None, DriverIdentityContract);
    let identity_client = DriverIdentityClient::new(&env, &identity_id);
    let escrow_id = env.register_contract(None, RideMeshEscrowContract);
    let escrow_client = RideMeshEscrowContractClient::new(&env, &escrow_id);

    identity_client.init(&escrow_id);
    escrow_client.init(&reputation_id, &identity_id);

    let passenger = Address::generate(&env);
    let driver = Address::generate(&env); // Unregistered driver

    let admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract(admin);
    let token_client = token::Client::new(&env, &token_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_id);

    let fare = 100_000_000i128;
    token_admin_client.mint(&passenger, &fare);

    let ride_id = escrow_client.request_ride(&passenger, &token_id, &fare);

    // Should panic since driver is not registered
    escrow_client.accept_ride(&ride_id, &driver);
}
