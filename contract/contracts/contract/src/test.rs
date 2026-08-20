#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Env, String};

fn setup() -> (Env, Address, NameAnchorClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(NameAnchor, ());
    let client = NameAnchorClient::new(&env, &contract_id);
    (env, contract_id, client)
}

#[test]
fn test_register_domain() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    let record = client.register(&owner, &name, &target);
    assert_eq!(record.owner, owner);
    assert_eq!(record.target, target);
    assert_eq!(record.is_subdomain, false);
    assert!(record.expiry > 0);
}

#[test]
#[should_panic(expected = "domain already registered")]
fn test_register_duplicate_panics() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    client.register(&owner, &name, &target);
    client.register(&owner, &name, &target);
}

#[test]
fn test_resolve_domain() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    client.register(&owner, &name, &target);
    let resolved = client.resolve(&name);
    assert_eq!(resolved, target);
}

#[test]
#[should_panic(expected = "domain not found")]
fn test_resolve_nonexistent() {
    let (env, _, client) = setup();
    client.resolve(&String::from_str(&env, "nobody"));
}

#[test]
fn test_transfer_domain() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let new_owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    client.register(&owner, &name, &target);
    client.transfer(&owner, &name, &new_owner);

    let info = client.get_domain(&name);
    assert_eq!(info.owner, new_owner);
}

#[test]
#[should_panic(expected = "not domain owner")]
fn test_transfer_unauthorized() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    client.register(&owner, &name, &target);
    client.transfer(&attacker, &name, &attacker);
}

#[test]
fn test_renew_domain() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    client.register(&owner, &name, &target);
    let old_expiry = client.get_domain(&name).expiry;

    // Advance ledger so renew gives a later sequence
    env.ledger().with_sequence(100);
    client.renew(&owner, &name);
    let new_expiry = client.get_domain(&name).expiry;
    assert!(new_expiry > old_expiry);
}

#[test]
fn test_subdomain_register() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let parent_name = String::from_str(&env, "alice");
    let full_name = String::from_str(&env, "bob.alice");

    client.register(&owner, &parent_name, &target);
    let sub = client.subdomain_register(&owner, &parent_name, &full_name, &target);

    assert_eq!(sub.is_subdomain, true);
    assert_eq!(sub.parent, String::from_str(&env, "alice"));

    let info = client.get_domain(&String::from_str(&env, "bob.alice"));
    assert_eq!(info.target, target);
}

#[test]
#[should_panic(expected = "parent domain not found")]
fn test_subdomain_no_parent() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);

    client.subdomain_register(
        &owner,
        &String::from_str(&env, "nobody"),
        &String::from_str(&env, "orphan.nobody"),
        &target,
    );
}

#[test]
#[should_panic(expected = "not parent owner")]
fn test_subdomain_unauthorized() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let attacker = Address::generate(&env);
    let target = Address::generate(&env);
    let parent_name = String::from_str(&env, "alice");

    client.register(&owner, &parent_name, &target);
    client.subdomain_register(
        &attacker,
        &parent_name,
        &String::from_str(&env, "bob.alice"),
        &target,
    );
}

#[test]
fn test_is_available() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    assert!(client.is_available(&name));
    client.register(&owner, &name, &target);
    assert!(!client.is_available(&name));
}

#[test]
fn test_list_domains() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);

    client.register(&owner, &String::from_str(&env, "alice"), &target);
    client.register(&owner, &String::from_str(&env, "bob"), &target);

    let domains = client.list_domains(&owner);
    assert_eq!(domains.len(), 2);
    assert!(domains.contains(String::from_str(&env, "alice")));
    assert!(domains.contains(String::from_str(&env, "bob")));
}

#[test]
fn test_get_domain() {
    let (env, _, client) = setup();
    let owner = Address::generate(&env);
    let target = Address::generate(&env);
    let name = String::from_str(&env, "alice");

    client.register(&owner, &name, &target);
    let info = client.get_domain(&name);
    assert_eq!(info.owner, owner);
    assert_eq!(info.target, target);
    assert_eq!(info.is_subdomain, false);
    assert_eq!(info.parent, String::from_str(&env, ""));
}
