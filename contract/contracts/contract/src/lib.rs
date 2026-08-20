#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DomainRecord {
    pub owner: Address,
    pub target: Address,
    pub expiry: u32,
    pub created_at: u64,
    pub is_subdomain: bool,
    pub parent: String,
}

#[contracttype]
pub enum DataKey {
    Domain(String),
    OwnerDomains(Address),
}

#[contract]
pub struct NameAnchor;

const YEAR_IN_LEDGERS: u32 = 525_600; // ~1 year at 5 min/ledger

#[contractimpl]
impl NameAnchor {
    pub fn register(env: Env, caller: Address, name: String, target: Address) -> DomainRecord {
        caller.require_auth();
        assert!(
            !env.storage().persistent().has(&DataKey::Domain(name.clone())),
            "domain already registered"
        );
        let record = DomainRecord {
            owner: caller.clone(),
            target,
            expiry: env.ledger().sequence() + YEAR_IN_LEDGERS,
            created_at: env.ledger().timestamp(),
            is_subdomain: false,
            parent: String::from_str(&env, ""),
        };
        env.storage()
            .persistent()
            .set(&DataKey::Domain(name.clone()), &record);
        Self::add_to_owner(&env, &caller, &name);
        record
    }

    pub fn subdomain_register(
        env: Env,
        caller: Address,
        parent_name: String,
        full_name: String,
        target: Address,
    ) -> DomainRecord {
        caller.require_auth();
        let parent_key = DataKey::Domain(parent_name.clone());
        let parent_rec: DomainRecord = env
            .storage()
            .persistent()
            .get(&parent_key)
            .expect("parent domain not found");
        assert_eq!(parent_rec.owner, caller, "not parent owner");

        assert!(
            !env.storage().persistent().has(&DataKey::Domain(full_name.clone())),
            "domain already registered"
        );
        let record = DomainRecord {
            owner: caller.clone(),
            target,
            expiry: env.ledger().sequence() + YEAR_IN_LEDGERS,
            created_at: env.ledger().timestamp(),
            is_subdomain: true,
            parent: parent_name,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Domain(full_name.clone()), &record);
        Self::add_to_owner(&env, &caller, &full_name);
        record
    }

    pub fn transfer(env: Env, caller: Address, name: String, new_owner: Address) {
        caller.require_auth();
        let key = DataKey::Domain(name.clone());
        let mut rec: DomainRecord = env
            .storage()
            .persistent()
            .get(&key)
            .expect("domain not found");
        assert_eq!(rec.owner, caller, "not domain owner");
        rec.owner = new_owner.clone();
        env.storage().persistent().set(&key, &rec);
        Self::remove_from_owner(&env, &caller, &name);
        Self::add_to_owner(&env, &new_owner, &name);
    }

    pub fn renew(env: Env, caller: Address, name: String) {
        caller.require_auth();
        let key = DataKey::Domain(name);
        let mut rec: DomainRecord = env
            .storage()
            .persistent()
            .get(&key)
            .expect("domain not found");
        assert_eq!(rec.owner, caller, "not domain owner");
        rec.expiry = env.ledger().sequence() + YEAR_IN_LEDGERS;
        env.storage().persistent().set(&key, &rec);
        env.storage()
            .persistent()
            .extend_ttl(&key, YEAR_IN_LEDGERS, YEAR_IN_LEDGERS * 2);
    }

    pub fn resolve(env: Env, name: String) -> Address {
        let rec: DomainRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Domain(name))
            .expect("domain not found");
        assert!(
            rec.expiry > env.ledger().sequence(),
            "domain expired"
        );
        rec.target
    }

    pub fn is_available(env: Env, name: String) -> bool {
        !env.storage().persistent().has(&DataKey::Domain(name))
    }

    pub fn get_domain(env: Env, name: String) -> DomainRecord {
        env.storage()
            .persistent()
            .get(&DataKey::Domain(name))
            .expect("domain not found")
    }

    pub fn list_domains(env: Env, owner: Address) -> Vec<String> {
        env.storage()
            .persistent()
            .get(&DataKey::OwnerDomains(owner))
            .unwrap_or(Vec::new(&env))
    }

    fn add_to_owner(env: &Env, owner: &Address, name: &String) {
        let key = DataKey::OwnerDomains(owner.clone());
        let mut list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        list.push_back(name.clone());
        env.storage().persistent().set(&key, &list);
    }

    fn remove_from_owner(env: &Env, owner: &Address, name: &String) {
        let key = DataKey::OwnerDomains(owner.clone());
        let list: Vec<String> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(env));
        let mut filtered = Vec::new(env);
        for i in 0..list.len() {
            if let Some(d) = list.get(i) {
                if d != *name {
                    filtered.push_back(d);
                }
            }
        }
        env.storage().persistent().set(&key, &filtered);
    }
}

mod test;
