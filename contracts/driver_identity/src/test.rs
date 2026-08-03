#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

#[test]
fn test_driver_registration_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // Register contract
    let contract_id = env.register_contract(None, DriverIdentityContract);
    let client = DriverIdentityContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let driver = Address::generate(&env);

    // Initialize
    client.init(&admin);

    // Prepare mock inputs
    let name = String::from_str(&env, "Driver Alice");
    let vehicle_num = String::from_str(&env, "XYZ-1234");
    let vehicle_type = String::from_str(&env, "Tesla Model Y");
    let license_hash = String::from_str(&env, "hash_of_license_data_here");

    // Register driver
    let profile = client.register_driver(
        &driver,
        &name,
        &vehicle_num,
        &vehicle_type,
        &license_hash,
    );

    assert_eq!(profile.wallet, driver);
    assert_eq!(profile.name, name);
    assert_eq!(profile.vehicle_number, vehicle_num);
    assert_eq!(profile.is_verified, false); // Pending admin verification

    // Verify profile fetching
    let fetched = client.get_driver(&driver).unwrap();
    assert_eq!(fetched.wallet, driver);
    assert_eq!(fetched.is_verified, false);

    // Verify driver
    let updated_profile = client.verify_driver(&admin, &driver);
    assert_eq!(updated_profile.is_verified, true);

    // Verify profile fetching reflects verification
    let fetched_verified = client.get_driver(&driver).unwrap();
    assert_eq!(fetched_verified.is_verified, true);

    // Update vehicle details
    let new_vehicle_num = String::from_str(&env, "ABC-9876");
    let new_vehicle_type = String::from_str(&env, "Tesla Model 3");
    let updated_vehicle_profile = client.update_vehicle(&driver, &new_vehicle_num, &new_vehicle_type);
    
    assert_eq!(updated_vehicle_profile.vehicle_number, new_vehicle_num);
    assert_eq!(updated_vehicle_profile.vehicle_type, new_vehicle_type);

    let final_profile = client.get_driver(&driver).unwrap();
    assert_eq!(final_profile.vehicle_number, new_vehicle_num);
}

#[test]
#[should_panic(expected = "Driver already registered")]
fn test_duplicate_registration() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, DriverIdentityContract);
    let client = DriverIdentityContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let driver = Address::generate(&env);

    client.init(&admin);

    let name = String::from_str(&env, "Driver Alice");
    let vehicle_num = String::from_str(&env, "XYZ-1234");
    let vehicle_type = String::from_str(&env, "Tesla Model Y");
    let license_hash = String::from_str(&env, "hash");

    client.register_driver(
        &driver,
        &name,
        &vehicle_num,
        &vehicle_type,
        &license_hash,
    );

    // Should panic due to duplicate registration
    client.register_driver(
        &driver,
        &name,
        &vehicle_num,
        &vehicle_type,
        &license_hash,
    );
}
